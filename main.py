import os
import shutil
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import Response, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import threading

from analyzer import PhotoAnalyzer, HAS_YOLO
from watcher import PhotoWatcher, IMAGE_EXTENSIONS

app = FastAPI(title="Photo Culler API")

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App State
state = {
    "watch_dir": "",
    "db_file": "photo_culler_db.json",
    "photos": {},  # file_path -> analysis_result
    "previews": {}, # file_path -> preview_bytes
    "active_connections": set(),
    "watcher": None,
    "loop": None,
    "culling_mode": "portrait",  # default mode
    "analysis_paused": False,
    "analysis_queue": [],
    "processing_thread_active": False
}

# Lock for database operations
db_lock = threading.Lock()

analyzer = PhotoAnalyzer()

class ConfigUpdate(BaseModel):
    watch_dir: str

class ModeUpdate(BaseModel):
    mode: str

class BudgetUpdate(BaseModel):
    target_budget: int

class EngineUpdate(BaseModel):
    engine: str

class RecommendationUpdate(BaseModel):
    filepath: str
    recommendation: str


def load_db():
    with db_lock:
        if os.path.exists(state["db_file"]):
            try:
                with open(state["db_file"], "r") as f:
                    state["photos"] = json.load(f)
            except Exception as e:
                print(f"Error loading database: {e}")
                state["photos"] = {}
        else:
            state["photos"] = {}


def save_db():
    with db_lock:
        try:
            with open(state["db_file"], "w") as f:
                json.dump(state["photos"], f, indent=2)
        except Exception as e:
            print(f"Error saving database: {e}")


async def broadcast(message: dict):
    if state["active_connections"]:
        tasks = []
        for connection in state["active_connections"]:
            tasks.append(connection.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


def update_session_clustering():
    """
    Triggers Stage 3 (Clustering) and Stage 4 (Temporal Eye Smoothing) on the entire session
    and saves/broadcasts the updated photos database.
    """
    with db_lock:
        photos_list = list(state["photos"].values())
        if not photos_list:
            return

        try:
            # Step 1: Run DBSCAN scene clustering
            cluster_map = analyzer.cluster_session_photos(photos_list)
            for p in photos_list:
                fp = p["filepath"]
                if fp in cluster_map:
                    p["cluster_id"] = cluster_map[fp]
            
            # Step 2: Apply temporal eye smoothing for blinking correction
            smoothed_list = analyzer.apply_temporal_smoothing(photos_list)
            
            # Step 3: Write back to database state
            for p in smoothed_list:
                fp = p["filepath"]
                state["photos"][fp] = p
        except Exception as e:
            print(f"[ERROR] Session clustering update failed: {e}")


def re_score_all_photos():
    """
    Re-calculates composite score and recommendation for all photos in the database
    based on the current culling_mode.
    """
    with db_lock:
        mode = state.get("culling_mode", "portrait")
        for fp, p in state["photos"].items():
            try:
                focus_score = p["focus"]["sharpness_score"]
                faces_detected = p.get("faces_detected", 0)
                
                ear_score = 100.0
                smile_score = 100.0
                if faces_detected > 0:
                    ear_score = min(f.get("eye_score", 100.0) for f in p["faces"])
                    smile_score = sum(f.get("smile_score", 100.0) for f in p["faces"]) / faces_detected
                
                aesthetic_score = p.get("aesthetics", {}).get("clip_score", 5.0)
                
                composite_score = analyzer.compute_composite_score(
                    focus_score=focus_score,
                    ear_score=ear_score,
                    smile_score=smile_score,
                    aesthetic_score=aesthetic_score,
                    mode=mode
                )
                
                # Check closed eye penalty
                if faces_detected > 0 and p.get("any_eyes_closed", False):
                    composite_score *= 0.5
                    
                p["overall_score"] = float(round(composite_score, 1))
                
                recommendation = "Review"
                if composite_score >= 72.0:
                    recommendation = "Keep"
                elif composite_score < 45.0 or (faces_detected > 0 and p.get("any_eyes_closed", False) and composite_score < 55.0):
                    recommendation = "Reject"
                    
                p["recommendation"] = recommendation
                
                # Re-write Lightroom XMP
                analyzer.write_xmp_sidecar(fp, recommendation)
            except Exception as e:
                print(f"[ERROR] Failed to re-score photo {fp}: {e}")


def run_analysis_in_thread(file_path: str):
    """
    Run the photo analysis sync pipeline.
    """
    try:
        print(f"Analyzing: {file_path}")
        mode = state.get("culling_mode", "portrait")
        result, preview_bytes = analyzer.analyze(file_path, mode=mode)
        if result:
            if preview_bytes:
                state["previews"][file_path] = preview_bytes
            
            state["photos"][file_path] = result
            
            # Perform session-wide clustering update
            update_session_clustering()
            save_db()
            
            # Send message to all WebSockets
            if state["loop"]:
                asyncio.run_coroutine_threadsafe(
                    broadcast({
                        "type": "PHOTO_ANALYZED",
                        "data": state["photos"][file_path]
                    }),
                    state["loop"]
                )
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")


def on_new_photo_detected(file_path: str):
    # Ignore if already analyzed
    if file_path in state["photos"]:
        return
    
    with db_lock:
        if file_path not in state["analysis_queue"]:
            state["analysis_queue"].append(file_path)
        
        paused = state.get("analysis_paused", False)
        
        # Broadcast queue status update
        if state["loop"]:
            asyncio.run_coroutine_threadsafe(
                broadcast({
                    "type": "QUEUE_STATUS",
                    "paused": paused,
                    "queue_len": len(state["analysis_queue"])
                }),
                state["loop"]
            )
            
    if not paused:
        # Start processing queue in a background thread if not already active
        threading.Thread(target=process_analysis_queue, daemon=True).start()


def restart_watcher(new_dir: str):
    normalized_dir = os.path.normpath(os.path.abspath(new_dir))
    if state["watcher"]:
        state["watcher"].stop()
    
    state["watch_dir"] = normalized_dir
    state["watcher"] = PhotoWatcher(normalized_dir, on_new_photo_detected)
    state["watcher"].start()


@app.on_event("startup")
async def startup_event():
    state["loop"] = asyncio.get_running_loop()
    load_db()
    
    config_file = "config.json"
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                cfg = json.load(f)
                watch_dir = cfg.get("watch_dir", "")
                if watch_dir and os.path.exists(watch_dir):
                    restart_watcher(watch_dir)
                
                saved_engine = cfg.get("engine", "standard")
                if saved_engine in {"standard", "yolov8"}:
                    analyzer.engine = saved_engine
                    
                state["culling_mode"] = cfg.get("culling_mode", "portrait")
        except Exception as e:
            print(f"Error loading config file: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    if state["watcher"]:
        state["watcher"].stop()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state["active_connections"].add(websocket)
    try:
        # Send initial config, mode & photo list
        await websocket.send_json({
            "type": "INIT",
            "watch_dir": state["watch_dir"],
            "culling_mode": state["culling_mode"],
            "photos": list(state["photos"].values()),
            "analysis_paused": state.get("analysis_paused", False),
            "analysis_queue_len": len(state["analysis_queue"])
        })
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state["active_connections"].remove(websocket)


@app.get("/api/config")
async def get_config():
    return {
        "watch_dir": state["watch_dir"],
        "culling_mode": state["culling_mode"],
        "analysis_paused": state.get("analysis_paused", False),
        "analysis_queue_len": len(state["analysis_queue"])
    }


@app.post("/api/config")
async def update_config(cfg: ConfigUpdate):
    watch_dir = os.path.abspath(cfg.watch_dir)
    if not os.path.exists(watch_dir):
        try:
            os.makedirs(watch_dir, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid directory path: {str(e)}")
    
    config_file = "config.json"
    cfg_data = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                cfg_data = json.load(f)
        except:
            pass
            
    cfg_data["watch_dir"] = watch_dir
    with open(config_file, "w") as f:
        json.dump(cfg_data, f)
        
    restart_watcher(watch_dir)
    return {"status": "success", "watch_dir": watch_dir}


@app.post("/api/config/mode")
async def update_culling_mode(cfg: ModeUpdate):
    """
    Sets the active culling mode weights and re-scores the database items.
    """
    if cfg.mode not in {"portrait", "landscape", "action_sport"}:
        raise HTTPException(status_code=400, detail="Invalid culling mode configuration.")
        
    state["culling_mode"] = cfg.mode
    
    config_file = "config.json"
    cfg_data = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                cfg_data = json.load(f)
        except:
            pass
            
    cfg_data["culling_mode"] = cfg.mode
    with open(config_file, "w") as f:
        json.dump(cfg_data, f)
        
    # Recalculate scores and recommendations for the whole session
    re_score_all_photos()
    
    # Broadcast update
    await broadcast({
        "type": "LIST_UPDATED",
        "photos": list(state["photos"].values())
    })
    
    return {"status": "success", "culling_mode": state["culling_mode"]}


@app.get("/api/engine")
async def get_engine():
    return {
        "engine": analyzer.engine,
        "has_yolo": HAS_YOLO
    }


@app.post("/api/engine")
async def update_engine(cfg: EngineUpdate):
    if cfg.engine not in {"standard", "yolov8"}:
        raise HTTPException(status_code=400, detail="Invalid engine choice. Choose 'standard' or 'yolov8'")
    
    if cfg.engine == "yolov8" and not HAS_YOLO:
        raise HTTPException(status_code=400, detail="YOLOv8/PyTorch packages not installed on the system.")
        
    analyzer.engine = cfg.engine
    
    config_file = "config.json"
    cfg_data = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                cfg_data = json.load(f)
        except:
            pass
            
    cfg_data["engine"] = cfg.engine
    with open(config_file, "w") as f:
        json.dump(cfg_data, f)
        
    return {"status": "success", "engine": analyzer.engine}


def process_analysis_queue():
    """
    Runs in a background thread to process queued files sequentially.
    """
    with db_lock:
        if state.get("processing_thread_active", False):
            return
        state["processing_thread_active"] = True

    try:
        while True:
            file_path = None
            with db_lock:
                if state.get("analysis_paused", False) or not state["analysis_queue"]:
                    state["processing_thread_active"] = False
                    # Broadcast final queue status update
                    if state["loop"]:
                        asyncio.run_coroutine_threadsafe(
                            broadcast({
                                "type": "QUEUE_STATUS",
                                "paused": state.get("analysis_paused", False),
                                "queue_len": len(state["analysis_queue"])
                            }),
                            state["loop"]
                        )
                    break
                
                file_path = state["analysis_queue"].pop(0)
                
                # Broadcast queue status update (length decreased)
                if state["loop"]:
                    asyncio.run_coroutine_threadsafe(
                        broadcast({
                            "type": "QUEUE_STATUS",
                            "paused": False,
                            "queue_len": len(state["analysis_queue"])
                        }),
                        state["loop"]
                    )
                    
            if file_path:
                # Broadcast start of analysis for this file
                if state["loop"]:
                    asyncio.run_coroutine_threadsafe(
                        broadcast({
                            "type": "PHOTO_DETECTED",
                            "filename": os.path.basename(file_path),
                            "filepath": file_path
                        }),
                        state["loop"]
                    )
                try:
                    run_analysis_in_thread(file_path)
                except Exception as e:
                    print(f"Error processing queued file {file_path}: {e}")
    finally:
        with db_lock:
            state["processing_thread_active"] = False


@app.get("/api/analysis/status")
async def get_analysis_status():
    with db_lock:
        return {
            "paused": state.get("analysis_paused", False),
            "queue_len": len(state["analysis_queue"])
        }


@app.post("/api/analysis/pause")
async def pause_analysis():
    with db_lock:
        state["analysis_paused"] = True
        if state["loop"]:
            asyncio.run_coroutine_threadsafe(
                broadcast({
                    "type": "QUEUE_STATUS",
                    "paused": True,
                    "queue_len": len(state["analysis_queue"])
                }),
                state["loop"]
            )
    return {"status": "success", "paused": True}


@app.post("/api/analysis/resume")
async def resume_analysis():
    with db_lock:
        state["analysis_paused"] = False
        
    # Start background processing thread
    threading.Thread(target=process_analysis_queue, daemon=True).start()
    return {"status": "success", "paused": False}


@app.get("/api/photos")
async def get_photos():
    return list(state["photos"].values())


@app.post("/api/photos/scan")
async def scan_directory():
    """
    Scans the current watch directory for existing photos that haven't been analyzed yet.
    """
    watch_dir = state["watch_dir"]
    if not watch_dir or not os.path.exists(watch_dir):
        raise HTTPException(status_code=400, detail="No active watch directory configured")
    
    # Detect RAW+JPEG pairs to avoid processing RAW if a JPEG exists
    paired_manifest = analyzer.pair_raw_and_jpeg(watch_dir)
    
    files_to_analyze = []
    
    # Prioritize JPEG files, but if a base name only has RAW, analyze the RAW.
    for base_name, pair in paired_manifest.items():
        if pair['jpeg']:
            files_to_analyze.append(pair['jpeg'])
        elif pair['raw']:
            files_to_analyze.append(pair['raw'])
            
    new_files = [f for f in files_to_analyze if f not in state["photos"]]
    
    with db_lock:
        for file_path in new_files:
            if file_path not in state["analysis_queue"]:
                state["analysis_queue"].append(file_path)
                
        paused = state.get("analysis_paused", False)
        
        # Broadcast queue status update
        if state["loop"]:
            asyncio.run_coroutine_threadsafe(
                broadcast({
                    "type": "QUEUE_STATUS",
                    "paused": paused,
                    "queue_len": len(state["analysis_queue"])
                }),
                state["loop"]
            )
            
    if not paused and new_files:
        threading.Thread(target=process_analysis_queue, daemon=True).start()
        
    return {"status": "success", "found_total": len(files_to_analyze), "added_to_queue": len(new_files), "paused": paused}


@app.post("/api/photos/budget")
async def budget_target(cfg: BudgetUpdate):
    """
    Target-Count budget allocation matching. Downsamples/upsamples keepers chronologically.
    """
    target_budget = cfg.target_budget
    photos_list = list(state["photos"].values())
    if not photos_list:
        raise HTTPException(status_code=400, detail="No photos analyzed in database to budget.")
        
    if target_budget <= 0:
        raise HTTPException(status_code=400, detail="Target budget must be a positive integer.")
        
    # Sort chronologically using DateTimeOriginal or filename
    def get_dt(x):
        dt = x.get("metadata", {}).get("datetime_original")
        return dt if dt else x.get("filename", "")
    
    sorted_photos = sorted(photos_list, key=get_dt)
    
    # Group by cluster_id
    from collections import defaultdict
    clusters = defaultdict(list)
    for p in sorted_photos:
        cid = p.get("cluster_id")
        if cid is None:
            cid = -1
        clusters[cid].append(p)
        
    # Extract highest scoring photo from each cluster as base keepers
    keepers = []
    for cid, items in clusters.items():
        best = max(items, key=lambda x: x.get("overall_score", 0))
        keepers.append(best)
        
    current_count = len(keepers)
    
    if current_count == target_budget:
        selected_keepers = keepers
    elif current_count > target_budget:
        # Downsample: select highest scoring keepers
        selected_keepers = sorted(keepers, key=lambda x: x.get("overall_score", 0), reverse=True)[:target_budget]
    else:
        # Upsample: select runners-up
        deficit = target_budget - current_count
        keeper_paths = {p["filepath"] for p in keepers}
        remaining_pool = [p for p in sorted_photos if p["filepath"] not in keeper_paths]
        
        runner_ups = sorted(remaining_pool, key=lambda x: x.get("overall_score", 0), reverse=True)[:deficit]
        selected_keepers = keepers + runner_ups
        
    # Update recommendation in database: keepers -> Keep, others -> Reject
    selected_paths = {p["filepath"] for p in selected_keepers}
    
    with db_lock:
        for fp, p in state["photos"].items():
            if fp in selected_paths:
                p["recommendation"] = "Keep"
            else:
                p["recommendation"] = "Reject"
                
            # Write Lightroom XMP
            analyzer.write_xmp_sidecar(fp, p["recommendation"])
            
    save_db()
    
    # Broadcast list update
    await broadcast({
        "type": "LIST_UPDATED",
        "photos": list(state["photos"].values())
    })
    
    return {"status": "success", "budgeted_count": len(selected_paths)}


@app.get("/api/photo/preview")
async def get_photo_preview(filepath: str):
    """
    Returns a web-friendly JPEG preview of the image, including RAW support.
    """
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
        
    if filepath in state["previews"]:
        return Response(content=state["previews"][filepath], media_type="image/jpeg")
        
    try:
        _, _, preview_bytes = analyzer.load_image(filepath)
        if preview_bytes:
            state["previews"][filepath] = preview_bytes
            return Response(content=preview_bytes, media_type="image/jpeg")
        else:
            ext = os.path.splitext(filepath)[1].lower()
            if ext in {'.jpg', '.jpeg', '.png', '.webp'}:
                return FileResponse(filepath)
            else:
                raise HTTPException(status_code=400, detail="Cannot render preview for this file format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating preview: {str(e)}")


@app.post("/api/photos/organize")
async def organize_photos(selections: Dict[str, str]):
    """
    Organizes photos into subfolders under the watch directory.
    Additionally, RAW+JPEG pairing ensures that when JPEGs are organized, their paired RAW files follow.
    """
    watch_dir = state["watch_dir"]
    if not watch_dir or not os.path.exists(watch_dir):
        raise HTTPException(status_code=400, detail="No active watch directory")

    organized_counts = {"Keep": 0, "Reject": 0, "Review": 0, "Errors": 0}
    
    # Prioritize analyzing which RAW files are paired with JPEGs in this watch dir
    paired_manifest = analyzer.pair_raw_and_jpeg(watch_dir)
    
    # Map jpeg path -> raw path
    jpeg_to_raw = {}
    for base_name, pair in paired_manifest.items():
        if pair['jpeg'] and pair['raw']:
            jpeg_to_raw[pair['jpeg']] = pair['raw']
            
    for filepath, target in selections.items():
        if target not in {"Keep", "Reject", "Review"}:
            continue
            
        if not os.path.exists(filepath):
            organized_counts["Errors"] += 1
            continue
            
        try:
            target_dir = os.path.join(watch_dir, target)
            os.makedirs(target_dir, exist_ok=True)
            
            # 1. Move JPEG file
            filename = os.path.basename(filepath)
            dest_path = os.path.join(target_dir, filename)
            shutil.move(filepath, dest_path)
            
            # Update database state for JPEG
            if filepath in state["photos"]:
                item = state["photos"].pop(filepath)
                item["filepath"] = dest_path
                state["photos"][dest_path] = item
                
            if filepath in state["previews"]:
                state["previews"][dest_path] = state["previews"].pop(filepath)
                
            # 2. Check for paired RAW file and move it
            paired_raw = jpeg_to_raw.get(filepath)
            if paired_raw and os.path.exists(paired_raw):
                raw_filename = os.path.basename(paired_raw)
                dest_raw_path = os.path.join(target_dir, raw_filename)
                shutil.move(paired_raw, dest_raw_path)
                
                # Update database state for RAW if it was present
                if paired_raw in state["photos"]:
                    item_raw = state["photos"].pop(paired_raw)
                    item_raw["filepath"] = dest_raw_path
                    state["photos"][dest_raw_path] = item_raw
                    
                if paired_raw in state["previews"]:
                    state["previews"][dest_raw_path] = state["previews"].pop(paired_raw)

            organized_counts[target] += 1
        except Exception as e:
            print(f"Error organizing {filepath} to {target}: {e}")
            organized_counts["Errors"] += 1
            
    save_db()
    
    await broadcast({
        "type": "LIST_UPDATED",
        "photos": list(state["photos"].values())
    })
    
    return {"status": "success", "counts": organized_counts}


@app.post("/api/photo/recommendation")
async def update_recommendation(cfg: RecommendationUpdate):
    filepath = cfg.filepath
    if filepath not in state["photos"]:
        raise HTTPException(status_code=404, detail="Photo not found in database")
    
    if cfg.recommendation not in {"Keep", "Reject", "Review"}:
        raise HTTPException(status_code=400, detail="Invalid recommendation")
        
    state["photos"][filepath]["recommendation"] = cfg.recommendation
    
    # Update XMP
    analyzer.write_xmp_sidecar(filepath, cfg.recommendation)
    
    save_db()
    
    # Broadcast to all websockets
    await broadcast({
        "type": "RECOMMENDATION_UPDATED",
        "filepath": filepath,
        "recommendation": cfg.recommendation
    })
    
    return {"status": "success"}


@app.post("/api/photos/redo")
async def redo_culling():
    """
    Undoes the organization of photos: Moves all photos and their sidecars from Keep, Reject, Review
    subfolders back into the watch folder, clears the culling DB, and restarts watch.
    """
    watch_dir = state["watch_dir"]
    if not watch_dir or not os.path.exists(watch_dir):
        raise HTTPException(status_code=400, detail="No active watch directory")
        
    subfolders = ["Keep", "Reject", "Review"]
    moved_count = 0
    
    if state["watcher"]:
        state["watcher"].stop()
        
    try:
        for sub in subfolders:
            sub_path = os.path.join(watch_dir, sub)
            if os.path.exists(sub_path):
                for f in os.listdir(sub_path):
                    src_file = os.path.join(sub_path, f)
                    dest_file = os.path.join(watch_dir, f)
                    if os.path.isfile(src_file):
                        if os.path.exists(dest_file):
                            base, ext = os.path.splitext(f)
                            dest_file = os.path.join(watch_dir, f"{base}_redo{ext}")
                        
                        shutil.move(src_file, dest_file)
                        moved_count += 1
                
                try:
                    os.rmdir(sub_path)
                except OSError:
                    pass
                    
        state["photos"] = {}
        state["previews"] = {}
        save_db()
        
    finally:
        if watch_dir:
            restart_watcher(watch_dir)
            
    await broadcast({
        "type": "LIST_UPDATED",
        "photos": []
    })
    
    return {"status": "success", "moved_count": moved_count}


@app.get("/api/photos/export")
async def export_culling():
    with db_lock:
        data = list(state["photos"].values())
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=culling_session.json"}
    )


@app.post("/api/photos/import")
async def import_culling(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        imported_data = json.loads(contents)
        
        if not isinstance(imported_data, list):
            raise HTTPException(status_code=400, detail="Import file must contain a JSON list.")
            
        with db_lock:
            valid_photos = {}
            for item in imported_data:
                filepath = item.get("filepath")
                if filepath:
                    valid_photos[filepath] = item
            
            state["photos"] = valid_photos
            save_db()
            
        await broadcast({
            "type": "LIST_UPDATED",
            "photos": list(state["photos"].values())
        })
        
        return {"status": "success", "imported_count": len(valid_photos)}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file format.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing session: {str(e)}")


frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")


@app.get("/", response_class=HTMLResponse)
async def read_index():
    index_path = os.path.join(frontend_dist, "index.html") if os.path.exists(frontend_dist) else None
    if index_path and os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h3>Frontend not built. Run: cd frontend && npm run build</h3>"
