import os
import sys
import argparse
import shutil
from analyzer import PhotoAnalyzer

def format_summary_table(photos):
    """Prints a beautiful ASCII table of analyzed photos."""
    header = f"{'Filename':<35} | {'Cluster':<8} | {'Score':<6} | {'Focus':<6} | {'Faces':<5} | {'Aesthetics':<10} | {'Decision':<8}"
    separator = "-" * len(header)
    print(separator)
    print(header)
    print(separator)
    
    # Sort by cluster_id, then score descending
    sorted_photos = sorted(
        photos, 
        key=lambda x: (x.get("cluster_id") if x.get("cluster_id") is not None else -1, -x.get("overall_score", 0))
    )
    
    for p in sorted_photos:
        filename = p.get("filename", "")
        if len(filename) > 32:
            filename = filename[:29] + "..."
            
        cid = p.get("cluster_id")
        cluster_str = str(cid) if cid is not None else "None"
        score = f"{p.get('overall_score', 0.0):.1f}"
        focus = f"{p.get('focus', {}).get('sharpness_score', 0.0):.1f}"
        faces = str(p.get("faces_detected", 0))
        aes = f"{p.get('aesthetics', {}).get('clip_score', 0.0):.2f}"
        decision = p.get("recommendation", "Review")
        
        # Color coding decisions in terminal if supported
        if decision == "Keep":
            dec_str = f"\033[92m{decision:<8}\033[0m" if sys.stdout.isatty() else f"{decision:<8}"
        elif decision == "Reject":
            dec_str = f"\033[91m{decision:<8}\033[0m" if sys.stdout.isatty() else f"{decision:<8}"
        else:
            dec_str = f"\033[93m{decision:<8}\033[0m" if sys.stdout.isatty() else f"{decision:<8}"
            
        print(f"{filename:<35} | {cluster_str:<8} | {score:<6} | {focus:<6} | {faces:<5} | {aes:<10} | {dec_str}")
    print(separator)

def main():
    parser = argparse.ArgumentParser(
        description="CineCull Local AI Photo Culling Pipeline",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--dir", required=True, help="Target directory containing photos to analyze.")
    parser.add_argument("--mode", default="portrait", choices=["portrait", "landscape", "action_sport"],
                        help="Culling optimization mode preset.")
    parser.add_argument("--similarity", type=float, default=0.85,
                        help="Cosine similarity threshold for near-duplicate clustering.")
    parser.add_argument("--budget", type=int, default=None,
                        help="Target count budget for Keepers. If specified, culling will optimize to fit this target.")
    parser.add_argument("--organize", action="store_true",
                        help="Physically move organized photos into 'Keep', 'Reject', and 'Review' subdirectories.")
    
    args = parser.parse_args()
    
    target_dir = os.path.abspath(args.dir)
    if not os.path.exists(target_dir):
        print(f"[ERROR] Target directory does not exist: {target_dir}")
        sys.exit(1)
        
    print("=" * 60)
    print(" CineCull Standalone Culling Pipeline")
    print("=" * 60)
    print(f"Target Directory: {target_dir}")
    print(f"Culling Mode    : {args.mode.upper()}")
    print(f"Clustering Sim  : {args.similarity}")
    
    # 1. Initialize Analyzer and Probe Hardware
    analyzer = PhotoAnalyzer()
    
    # 2. Discover and Pair RAW + JPEG
    print("\nScanning folder for RAW+JPEG file pairs...")
    paired_manifest = analyzer.pair_raw_and_jpeg(target_dir)
    active_paths = []
    
    # Prioritize JPEG for fast visual scoring, fall back to RAW if no JPEG pair
    for base_name, pair in paired_manifest.items():
        if pair['jpeg']:
            active_paths.append(pair['jpeg'])
        elif pair['raw']:
            active_paths.append(pair['raw'])
            
    if not active_paths:
        print("[WARN] No valid image files found in target folder.")
        sys.exit(0)
        
    print(f"Found {len(paired_manifest)} logical assets ({len(active_paths)} files selected for scoring).")
    
    # 3. Analyze Each Photo
    print("\nAnalyzing files (Focus, Exposure, Faces, Aesthetics)...")
    analyzed_photos = []
    for idx, filepath in enumerate(active_paths):
        filename = os.path.basename(filepath)
        print(f" [{idx+1}/{len(active_paths)}] Analyzing {filename}...", end="\r", flush=True)
        try:
            result, _ = analyzer.analyze(filepath, mode=args.mode)
            if result:
                analyzed_photos.append(result)
        except Exception as e:
            print(f"\n[ERROR] Failed to analyze {filename}: {e}")
            
    print(f"\nAnalysis complete. Successfully scored {len(analyzed_photos)} photos.")
    
    if not analyzed_photos:
        print("[ERROR] No photos were successfully analyzed.")
        sys.exit(1)
        
    # 4. Two-Tier Visual Clustering
    print("\nRunning two-tier duplicate and burst clustering...")
    try:
        cluster_map = analyzer.cluster_session_photos(analyzed_photos, similarity_threshold=args.similarity)
        for p in analyzed_photos:
            fp = p["filepath"]
            if fp in cluster_map:
                p["cluster_id"] = cluster_map[fp]
    except Exception as e:
        print(f"[ERROR] Scene clustering failed: {e}")
        
    # 5. Apply Temporal Eye Smoothing
    print("Applying temporal eye smoothing (blink correction)...")
    try:
        analyzed_photos = analyzer.apply_temporal_smoothing(analyzed_photos)
    except Exception as e:
        print(f"[ERROR] Temporal eye smoothing failed: {e}")
        
    # 6. Select Keepers and Runners Up
    # Group by cluster ID
    from collections import defaultdict
    clusters = defaultdict(list)
    for p in analyzed_photos:
        cid = p.get("cluster_id")
        if cid is None:
            cid = -1
        clusters[cid].append(p)
        
    keepers = []
    rejects = []
    
    # Base Keep / Reject decision inside each cluster
    for cid, items in clusters.items():
        if len(items) == 1:
            # Single photo scene, decide based on threshold
            p = items[0]
            if p["overall_score"] >= 65.0 and not p.get("any_eyes_closed", False):
                p["recommendation"] = "Keep"
            elif p["overall_score"] < 45.0:
                p["recommendation"] = "Reject"
            else:
                p["recommendation"] = "Review"
        else:
            # Burst sequence: find the best one
            best = max(items, key=lambda x: x.get("overall_score", 0))
            for p in items:
                if p["filepath"] == best["filepath"]:
                    # Best in burst is Keeper (Keep if score is good, else Review)
                    if p["overall_score"] >= 60.0:
                        p["recommendation"] = "Keep"
                    else:
                        p["recommendation"] = "Review"
                else:
                    # Others are flagged as Reject/Review
                    if p["overall_score"] < 45.0 or p.get("any_eyes_closed", False):
                        p["recommendation"] = "Reject"
                    else:
                        p["recommendation"] = "Review"
                        
    # 7. Apply Budget Constraint (if requested)
    if args.budget is not None:
        target_budget = args.budget
        print(f"\nAdjusting recommendations to fit target budget of {target_budget} Keepers...")
        
        # Sort all photos by overall_score descending
        sorted_by_score = sorted(analyzed_photos, key=lambda x: x.get("overall_score", 0), reverse=True)
        
        # Take top N as Keep, rest as Reject/Review
        selected_keeps = set()
        for i, p in enumerate(sorted_by_score):
            if i < target_budget:
                p["recommendation"] = "Keep"
                selected_keeps.add(p["filepath"])
            else:
                p["recommendation"] = "Reject" if p["overall_score"] < 50.0 else "Review"
                
    # 8. Write XMP Sidecars
    print("Writing metadata and ratings to Lightroom XMP sidecars...")
    for p in analyzed_photos:
        analyzer.write_xmp_sidecar(p["filepath"], p["recommendation"])
        
    # 9. Format and Print Results Table
    print("\nCulling Results Summary:")
    format_summary_table(analyzed_photos)
    
    keeps_count = sum(1 for p in analyzed_photos if p["recommendation"] == "Keep")
    review_count = sum(1 for p in analyzed_photos if p["recommendation"] == "Review")
    rejects_count = sum(1 for p in analyzed_photos if p["recommendation"] == "Reject")
    
    print(f"\nStats: Keepers: {keeps_count} | Reviews: {review_count} | Rejects: {rejects_count}")
    
    # 10. Physically Organize (if requested)
    if args.organize:
        print(f"\nOrganizing files into subdirectories under {target_dir}...")
        # Map JPEGs to RAW files in the watch folder
        jpeg_to_raw = {}
        for base_name, pair in paired_manifest.items():
            if pair['jpeg'] and pair['raw']:
                jpeg_to_raw[pair['jpeg']] = pair['raw']
                
        moved_count = 0
        for p in analyzed_photos:
            filepath = p["filepath"]
            target = p["recommendation"]
            if not os.path.exists(filepath):
                continue
                
            try:
                dest_dir = os.path.join(target_dir, target)
                os.makedirs(dest_dir, exist_ok=True)
                
                # Move main file and write xmp there
                filename = os.path.basename(filepath)
                dest_path = os.path.join(dest_dir, filename)
                shutil.move(filepath, dest_path)
                
                # Move XMP sidecar
                xmp_path = os.path.splitext(filepath)[0] + ".xmp"
                if os.path.exists(xmp_path):
                    shutil.move(xmp_path, os.path.join(dest_dir, os.path.basename(xmp_path)))
                    
                # Move paired RAW if JPEG was moved
                paired_raw = jpeg_to_raw.get(filepath)
                if paired_raw and os.path.exists(paired_raw):
                    shutil.move(paired_raw, os.path.join(dest_dir, os.path.basename(paired_raw)))
                    raw_xmp = os.path.splitext(paired_raw)[0] + ".xmp"
                    if os.path.exists(raw_xmp):
                        shutil.move(raw_xmp, os.path.join(dest_dir, os.path.basename(raw_xmp)))
                
                moved_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to move {filename} to {target}: {e}")
                
        print(f"Successfully organized and moved {moved_count} assets.")
    
    print("\nDone!")

if __name__ == "__main__":
    main()
