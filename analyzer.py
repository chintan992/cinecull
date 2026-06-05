import os
import glob
import cv2
import numpy as np
import rawpy
from PIL import Image, ImageOps
import io
import math
import json
import threading

# Try optional dependencies
try:
    import mediapipe as mp
    HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except (ImportError, AttributeError):
    HAS_MEDIAPIPE = False

try:
    from ultralytics import YOLO
    import torch
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False

try:
    import exifread
    HAS_EXIFREAD = True
except ImportError:
    HAS_EXIFREAD = False

try:
    import onnxruntime as ort
    HAS_ORT = True
except ImportError:
    HAS_ORT = False

try:
    from sklearn.cluster import DBSCAN
    HAS_SKLEARN_DBSCAN = True
except ImportError:
    HAS_SKLEARN_DBSCAN = False


# ==========================================
# Disjoint-Set (Union-Find) with Rank & Path Compression
# ==========================================
class UnionFind:
    def __init__(self, elements):
        self.parent = {el: el for el in elements}
        self.rank = {el: 0 for el in elements}

    def find(self, el):
        if self.parent[el] != el:
            self.parent[el] = self.find(self.parent[el])  # Path compression
        return self.parent[el]

    def union(self, el1, el2):
        root1 = self.find(el1)
        root2 = self.find(el2)
        if root1 != root2:
            if self.rank[root1] > self.rank[root2]:
                self.parent[root2] = root1
            elif self.rank[root1] < self.rank[root2]:
                self.parent[root1] = root2
            else:
                self.parent[root2] = root1
                self.rank[root1] += 1


# ==========================================
# Pure NumPy Fallback for DBSCAN
# ==========================================
def custom_dbscan(embeddings, eps, min_samples=1):
    """
    Custom DBSCAN implementation using Cosine Distance.
    Avoids requiring scikit-learn in all environments.
    """
    n = len(embeddings)
    if n == 0:
        return []

    # L2 normalize embeddings first for easy cosine distance
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1e-10
    norm_embeddings = embeddings / norms

    # Compute cosine similarity matrix
    similarity_matrix = np.dot(norm_embeddings, norm_embeddings.T)
    # Cosine distance = 1 - Cosine similarity
    distance_matrix = 1.0 - similarity_matrix

    labels = -np.ones(n, dtype=int)
    cluster_id = 0

    visited = np.zeros(n, dtype=bool)

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True

        # Find neighbors within eps
        neighbors = np.where(distance_matrix[i] <= eps)[0].tolist()

        if len(neighbors) < min_samples:
            # Mark as noise (already labeled -1)
            continue
        
        # Start new cluster
        labels[i] = cluster_id
        
        # Process neighbors queue
        queue = [x for x in neighbors if x != i]
        for idx in queue:
            if not visited[idx]:
                visited[idx] = True
                new_neighbors = np.where(distance_matrix[idx] <= eps)[0].tolist()
                if len(new_neighbors) >= min_samples:
                    # Extend queue
                    for nn in new_neighbors:
                        if nn not in queue:
                            queue.append(nn)
            if labels[idx] == -1:
                labels[idx] = cluster_id
        
        cluster_id += 1

    return labels.tolist()


# ==========================================
# PhotoAnalyzer: Production-Grade Engine
# ==========================================
class PhotoAnalyzer:
    def __init__(self):
        self.engine = "standard"  # "standard" or "yolov8"
        self.yolo_model = None
        self.mp_face_mesh = None
        self.face_mesh = None
        self.ort_providers = []
        self.orientation_session = None
        self.dinov2_session = None
        self.clip_session = None
        self.nima_session = None

        # Setup MediaPipe Face Mesh
        if HAS_MEDIAPIPE:
            try:
                self.mp_face_mesh = mp.solutions.face_mesh
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=10,
                    refine_landmarks=True,
                    min_detection_confidence=0.5
                )
                print("[INFO] MediaPipe Face Mesh initialized successfully.")
            except Exception as e:
                print(f"[WARN] MediaPipe Face Mesh failed to initialize: {e}")
                self.face_mesh = None
        else:
            print("[WARN] MediaPipe Face Mesh NOT available. Facial analysis will use basic cascading.")

        # Stage 0: Hardware Probing Engine & Setup
        self._probe_hardware()

    def _probe_hardware(self):
        """
        Probes execution providers and prioritizes hardware acceleration.
        Decouples initialization from underlying hardware.
        """
        if not HAS_ORT:
            print("[WARN] ONNX Runtime is not available. Deep learning stages will use fallback math heuristics.")
            self.ort_providers = ["CPUExecutionProvider"]
            return

        available = ort.get_available_providers()
        print(f"[INFO] Available ONNX Runtime execution providers: {available}")

        prioritized = []
        
        # 1. CUDA
        if "CUDAExecutionProvider" in available:
            # Configure CUDA memory and kernel compilation options
            cuda_options = {
                "arena_extend_strategy": "kNextPowerOfTwo",
                "cudnn_conv_algo_search": "HEURISTIC",
                "gpu_mem_limit": str(4 * 1024 * 1024 * 1024)  # Limit to 4GB to avoid system starvation
            }
            prioritized.append(("CUDAExecutionProvider", cuda_options))

        # 2. DirectML (Windows)
        if "DmlExecutionProvider" in available:
            prioritized.append("DmlExecutionProvider")

        # 3. CoreML (macOS Neural Engine)
        if "CoreMLExecutionProvider" in available:
            prioritized.append("CoreMLExecutionProvider")

        # 4. CPU (Fallback)
        prioritized.append("CPUExecutionProvider")

        self.ort_providers = prioritized
        print(f"[INFO] Configured ONNX Runtime providers list: {self.ort_providers}")

        # Initialize models lazily when first needed
        self._init_onnx_models()

    def _init_onnx_models(self):
        """
        Attemps to initialize the ONNX models. Loads them if local files exist.
        If files are missing, the analyzer relies on fallback heuristics.
        """
        models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
        os.makedirs(models_dir, exist_ok=True)

        # 1. EfficientNetV2 Orientation Model
        orientation_path = os.path.join(models_dir, "orientation_efficientnetv2.onnx")
        if os.path.exists(orientation_path) and HAS_ORT:
            try:
                self.orientation_session = ort.InferenceSession(orientation_path, providers=self.ort_providers)
                print("[INFO] ONNX Orientation Model loaded successfully.")
            except Exception as e:
                print(f"[WARN] Failed to load ONNX Orientation Model: {e}")

        # 2. DINOv2 Semantic Model
        dinov2_path = os.path.join(models_dir, "dinov2_small.onnx")
        if os.path.exists(dinov2_path) and HAS_ORT:
            try:
                self.dinov2_session = ort.InferenceSession(dinov2_path, providers=self.ort_providers)
                print("[INFO] ONNX DINOv2 Model loaded successfully.")
            except Exception as e:
                print(f"[WARN] Failed to load ONNX DINOv2 Model: {e}")

        # 3. CLIP+MLP Aesthetic Model
        clip_path = os.path.join(models_dir, "clip_aesthetic.onnx")
        if os.path.exists(clip_path) and HAS_ORT:
            try:
                self.clip_session = ort.InferenceSession(clip_path, providers=self.ort_providers)
                print("[INFO] ONNX CLIP Aesthetic Model loaded successfully.")
            except Exception as e:
                print(f"[WARN] Failed to load ONNX CLIP Aesthetic Model: {e}")

        # 4. NIMA Model
        nima_path = os.path.join(models_dir, "nima.onnx")
        if os.path.exists(nima_path) and HAS_ORT:
            try:
                self.nima_session = ort.InferenceSession(nima_path, providers=self.ort_providers)
                print("[INFO] ONNX NIMA Model loaded successfully.")
            except Exception as e:
                print(f"[WARN] Failed to load ONNX NIMA Model: {e}")

    # ==========================================
    # Stage 1: Ingestion & Metadata Parsing
    # ==========================================
    def pair_raw_and_jpeg(self, directory: str, raw_extensions: list = None) -> dict:
        """
        Ingestion optimization: Pairs RAW and JPEG files under the directory.
        Deletes or reject actions on JPEGs will sync to paired RAW files.
        """
        if raw_extensions is None:
            raw_extensions = ['.CR2', '.CR3', '.NEF', '.ARW', '.DNG', '.ORF', '.RW2', '.PEF', '.RAF']
        
        paired_assets = {}
        normalized_raw_exts = {ext.upper() for ext in raw_extensions}
        
        try:
            # Use os.scandir for high efficiency and robust Windows path handling (no glob bugs)
            with os.scandir(directory) as entries:
                for entry in entries:
                    if entry.is_file():
                        file_path = entry.path
                        base_name, extension = os.path.splitext(file_path)
                        normalized_ext = extension.upper()
                        
                        if normalized_ext in ['.JPG', '.JPEG']:
                            if base_name not in paired_assets:
                                paired_assets[base_name] = {'jpeg': file_path, 'raw': None}
                            else:
                                paired_assets[base_name]['jpeg'] = file_path
                        elif normalized_ext in normalized_raw_exts:
                            if base_name not in paired_assets:
                                paired_assets[base_name] = {'jpeg': None, 'raw': file_path}
                            else:
                                paired_assets[base_name]['raw'] = file_path
        except Exception as e:
            print(f"[ERROR] Failed to scan directory {directory}: {e}")
            
        return paired_assets

    def parse_exif(self, file_path):
        """
        Extracts EXIF metadata using exifread, falling back to PIL.
        Reads: DateTimeOriginal, ISO, Aperture, FocalLength, Lens, Make, Model, FocusPoint
        """
        metadata = {
            "datetime_original": None,
            "iso": None,
            "aperture": None,
            "focal_length": None,
            "lens": None,
            "camera_make": None,
            "camera_model": None,
            "focus_point": None
        }

        # Try ExifRead
        if HAS_EXIFREAD:
            try:
                with open(file_path, 'rb') as f:
                    tags = exifread.process_file(f, details=False)
                    metadata["datetime_original"] = str(tags.get("EXIF DateTimeOriginal", "")) or str(tags.get("Image DateTime", ""))
                    metadata["iso"] = str(tags.get("EXIF ISOSpeedRatings", ""))
                    metadata["aperture"] = str(tags.get("EXIF FNumber", ""))
                    metadata["focal_length"] = str(tags.get("EXIF FocalLength", ""))
                    metadata["lens"] = str(tags.get("EXIF LensModel", "")) or str(tags.get("Image LensModel", ""))
                    metadata["camera_make"] = str(tags.get("Image Make", ""))
                    metadata["camera_model"] = str(tags.get("Image Model", ""))
                    metadata["focus_point"] = str(tags.get("MakerNote FocusMode", "")) or str(tags.get("MakerNote FocusPoint", ""))
            except Exception as e:
                print(f"[WARN] ExifRead parsing failed for {file_path}: {e}")

        # Fallback to Pillow EXIF
        if not metadata["datetime_original"]:
            try:
                with Image.open(file_path) as img:
                    exif_data = img._getexif()
                    if exif_data:
                        from PIL.ExifTags import TAGS
                        for tag_id, value in exif_data.items():
                            tag_name = TAGS.get(tag_id, tag_id)
                            if tag_name == "DateTimeOriginal":
                                metadata["datetime_original"] = str(value)
                            elif tag_name == "ISOSpeedRatings":
                                metadata["iso"] = str(value)
                            elif tag_name == "FNumber":
                                metadata["aperture"] = str(value)
                            elif tag_name == "FocalLength":
                                metadata["focal_length"] = str(value)
                            elif tag_name == "LensModel":
                                metadata["lens"] = str(value)
                            elif tag_name == "Make":
                                metadata["camera_make"] = str(value)
                            elif tag_name == "Model":
                                metadata["camera_model"] = str(value)
            except Exception as e:
                pass

        # Cleanup empty/default strings
        for k, v in metadata.items():
            if v == "" or v == "None":
                metadata[k] = None

        # Clean datetime string format
        if metadata["datetime_original"]:
            # Try to format string standardly e.g. "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DD HH:MM:SS"
            metadata["datetime_original"] = metadata["datetime_original"].replace(':', '-', 2)
            
        return metadata

    def load_image(self, file_path):
        """
        Loads image. Supports RAW files by extracting embedded thumbnails
        via rawpy for 10x faster I/O.
        """
        ext = os.path.splitext(file_path)[1].lower()
        raw_extensions = {'.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.pef', '.raf'}
        
        rgb_image = None
        preview_bytes = None

        if ext in raw_extensions:
            try:
                with rawpy.imread(file_path) as raw:
                    try:
                        thumb = raw.extract_thumb()
                        if thumb.format == rawpy.ThumbFormat.JPEG:
                            preview_bytes = thumb.data
                            nparr = np.frombuffer(preview_bytes, np.uint8)
                            rgb_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                            rgb_image = cv2.cvtColor(rgb_image, cv2.COLOR_BGR2RGB)
                    except Exception:
                        pass

                    if rgb_image is None:
                        # Fallback: postprocess RAW image at half size for speed
                        rgb_image = raw.postprocess(use_camera_wb=True, half_size=True)
            except Exception as e:
                print(f"[ERROR] rawpy failed to read RAW file {file_path}: {e}")
                return None, None, None
        else:
            try:
                pil_img = Image.open(file_path)
                pil_img = ImageOps.exif_transpose(pil_img)
                rgb_image = np.array(pil_img.convert('RGB'))
            except Exception as e:
                print(f"[WARN] PIL failed to read image {file_path}: {e}. Falling back to cv2.")
                try:
                    # Read using raw binary stream and decode to bypass Windows path space/Unicode bugs in cv2.imread
                    with open(file_path, 'rb') as f:
                        file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
                        bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
                except Exception as read_err:
                    print(f"[ERROR] cv2 fallback failed to read {file_path}: {read_err}")
                    bgr = None
                if bgr is not None:
                    rgb_image = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        if rgb_image is None:
            return None, None, None

        # Generate preview bytes for UI if not extracted from RAW
        if preview_bytes is None:
            h, w = rgb_image.shape[:2]
            max_size = 1200
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                preview_img = cv2.resize(rgb_image, (new_w, new_h), interpolation=cv2.INTER_AREA)
            else:
                preview_img = rgb_image
            
            success, encoded_img = cv2.imencode('.jpg', cv2.cvtColor(preview_img, cv2.COLOR_RGB2BGR))
            if success:
                preview_bytes = encoded_img.tobytes()

        bgr_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        return rgb_image, bgr_image, preview_bytes

    # ==========================================
    # Stage 2: Spatial Orientation Correction
    # ==========================================
    def correct_orientation(self, rgb_image, exif_orientation=None):
        """
        Uses EfficientNetV2 ONNX model to classify visual orientation.
        Fallback uses traditional EXIF header rotation.
        """
        if self.orientation_session is None:
            # Fallback already handled during image loading by PIL ImageOps.exif_transpose
            return rgb_image, 0

        try:
            # Preprocess image for EfficientNetV2 (usually 224x224, normalized)
            resized = cv2.resize(rgb_image, (224, 224))
            inp = resized.astype(np.float32) / 255.0
            # Normalize with ImageNet mean/std
            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            inp = (inp - mean) / std
            inp = inp.transpose(2, 0, 1)  # HWC -> CHW
            inp = np.expand_dims(inp, axis=0)  # Add batch dim

            # Run inference
            inputs = {self.orientation_session.get_inputs()[0].name: inp}
            outputs = self.orientation_session.run(None, inputs)
            probs = outputs[0][0]
            
            # Predict angles: 0 -> 0°, 1 -> 90°, 2 -> 180°, 3 -> 270°
            pred_class = np.argmax(probs)
            angles = [0, 90, 180, 270]
            detected_angle = angles[pred_class]

            # Rotate tensor if needed
            if detected_angle == 90:
                rotated = cv2.rotate(rgb_image, cv2.ROTATE_90_CLOCKWISE)
            elif detected_angle == 180:
                rotated = cv2.rotate(rgb_image, cv2.ROTATE_180)
            elif detected_angle == 270:
                rotated = cv2.rotate(rgb_image, cv2.ROTATE_90_COUNTERCLOCKWISE)
            else:
                rotated = rgb_image

            return rotated, detected_angle
        except Exception as e:
            print(f"[WARN] ONNX Orientation classification failed: {e}. Using input image.")
            return rgb_image, 0

    # ==========================================
    # Stage 3: Near-Duplicate Clustering
    # ==========================================
    def calculate_dhash(self, image) -> int:
        """
        Computes 64-bit difference hash (dHash) evaluates localized pixel luminance gradients.
        Grayscale -> 9x8 matrix -> Column differences.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Downsample to 9x8
        resized = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
        # Compare columns
        diff = resized[:, :-1] > resized[:, 1:]
        
        # Serialize bits to a 64-bit integer
        hash_val = 0
        for bit in diff.flatten():
            hash_val = (hash_val << 1) | int(bit)
        return hash_val

    def get_semantic_embedding(self, rgb_image):
        """
        Extracts 768-dimensional visual embedding using facebook/dinov2 ONNX.
        Heuristics fallback: HSV color histogram + Laplacian gradient descriptor.
        """
        if self.dinov2_session is not None:
            try:
                # Preprocess: DINOv2 expects 224x224
                resized = cv2.resize(rgb_image, (224, 224))
                inp = resized.astype(np.float32) / 255.0
                mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
                std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
                inp = (inp - mean) / std
                inp = inp.transpose(2, 0, 1)  # HWC -> CHW
                inp = np.expand_dims(inp, axis=0)  # Batch dimension
                
                inputs = {self.dinov2_session.get_inputs()[0].name: inp}
                outputs = self.dinov2_session.run(None, inputs)
                embedding = outputs[0][0]  # Shape: (768,)
                return embedding / (np.linalg.norm(embedding) + 1e-10)
            except Exception as e:
                print(f"[WARN] ONNX DINOv2 inference failed: {e}. Falling back to color histogram.")

        # Robust Visual Heuristic Fallback: 256-bin HSV color histogram + 256-bin Sobel magnitude hist = 512 dimensions
        try:
            hsv = cv2.cvtColor(cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)
            h_hist = cv2.calcHist([hsv], [0], None, [128], [0, 180])
            s_hist = cv2.calcHist([hsv], [1], None, [64], [0, 256])
            v_hist = cv2.calcHist([hsv], [2], None, [64], [0, 256])
            
            # Grayscale texture histogram
            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            mag = cv2.magnitude(sobelx, sobely)
            mag_hist = cv2.calcHist([mag.astype(np.float32)], [0], None, [256], [0, 500])

            # Concat and L2 normalize
            feat = np.concatenate([h_hist.flatten(), s_hist.flatten(), v_hist.flatten(), mag_hist.flatten()])
            return feat / (np.linalg.norm(feat) + 1e-10)
        except Exception as e:
            print(f"[ERROR] Visual embedding heuristic extraction failed: {e}")
            return np.zeros(512)

    def cluster_session_photos(self, photos_metadata: list, similarity_threshold=0.85, min_samples=1):
        """
        Two-tier clustering:
        1. Run DBSCAN globally on all session embeddings to classify scenes.
        2. Within each scene cluster, run dHash Union-Find to group identical bursts.
        Returns: A dict mapping filepath -> cluster_id (int)
        """
        if not photos_metadata:
            return {}

        paths = [item["filepath"] for item in photos_metadata]
        dhashes = {}
        embeddings = {}

        # 1. Ingest hashes and embeddings
        for item in photos_metadata:
            fp = item["filepath"]
            
            # If embedding/hash is not computed, load and compute it
            dhash_val = item.get("dhash")
            embedding_val = item.get("embedding")
            
            if dhash_val is None or embedding_val is None:
                rgb, bgr, _ = self.load_image(fp)
                if bgr is not None:
                    dhash_val = self.calculate_dhash(bgr)
                    embedding_val = self.get_semantic_embedding(rgb).tolist()
                else:
                    dhash_val = 0
                    embedding_val = np.zeros(512).tolist()

            dhashes[fp] = dhash_val
            embeddings[fp] = np.array(embedding_val)

        # 2. Run DBSCAN globally on all session embeddings to classify scenes
        eps = 1.0 - similarity_threshold
        group_paths = list(embeddings.keys())
        
        if not group_paths:
            return {}
            
        group_embeddings = np.array([embeddings[p] for p in group_paths])
        
        if HAS_SKLEARN_DBSCAN:
            try:
                db = DBSCAN(eps=eps, min_samples=min_samples, metric='cosine')
                labels = db.fit_predict(group_embeddings).tolist()
            except Exception:
                labels = custom_dbscan(group_embeddings, eps=eps, min_samples=min_samples)
        else:
            labels = custom_dbscan(group_embeddings, eps=eps, min_samples=min_samples)

        # Group paths by DBSCAN scene labels
        scenes = {}
        for path, label in zip(group_paths, labels):
            if label not in scenes:
                scenes[label] = []
            scenes[label].append(path)

        cluster_assignment = {}
        global_cluster_counter = 0

        # 3. Process each scene
        for label, scene_paths in scenes.items():
            if label == -1 or len(scene_paths) == 1:
                # Noise/Anomaly or single-photo scene: assign each path a unique cluster ID
                for p in scene_paths:
                    cluster_assignment[p] = global_cluster_counter
                    global_cluster_counter += 1
                continue

            # Within this scene group, run dHash Union-Find to group identical bursts
            uf = UnionFind(scene_paths)
            m = len(scene_paths)
            for i in range(m):
                for j in range(i + 1, m):
                    p1, p2 = scene_paths[i], scene_paths[j]
                    dist = bin(dhashes[p1] ^ dhashes[p2]).count('1')
                    if dist <= 10:
                        uf.union(p1, p2)

            # Retrieve burst groups from Union-Find inside the scene
            burst_groups = {}
            for p in scene_paths:
                root = uf.find(p)
                if root not in burst_groups:
                    burst_groups[root] = []
                burst_groups[root].append(p)

            # Assign each burst group a unique cluster ID
            for root, burst_paths in burst_groups.items():
                for p in burst_paths:
                    cluster_assignment[p] = global_cluster_counter
                global_cluster_counter += 1

        return cluster_assignment

    # ==========================================
    # Stage 4: Objective Quality Assessment
    # ==========================================
    def analyze_focus(self, bgr_image):
        """
        Grayscale-Normalized Laplacian Focus Estimation.
        Normalizes Laplacian variance by squared mean intensity: var / (mean**2).
        Prevents exposure and sensor noise from skewing focus score.
        """
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        mean_val = np.mean(gray)
        if mean_val == 0:
            mean_val = 1.0

        # Compute Discrete Laplacian convolved response
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian_var = laplacian.var()

        # Normalize metrics
        normalized_var = laplacian_var / (mean_val ** 2)

        # Scale normalized focus metric to 0-100 rating
        # Sharp images typically have normalized variance values > 0.015.
        # Let's calibrate: 0 -> 0, 0.005 -> 40, 0.02 -> 80, 0.05+ -> 100
        if normalized_var <= 0.0005:
            sharpness_score = 0.0
        else:
            # Map log-linearly or piecewise linear for clean representation
            sharpness_score = min(100.0, (normalized_var / 0.025) * 100.0)

        return {
            "laplacian_variance": float(round(laplacian_var, 2)),
            "normalized_variance": float(round(normalized_var, 6)),
            "sharpness_score": float(round(sharpness_score, 1))
        }

    def analyze_exposure(self, bgr_image):
        """
        Analyzes exposure balance and clipping limits.
        """
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        total_pixels = h * w
        
        mean_brightness = float(np.mean(gray))
        
        # Shadows (< 15/255) and Highlights (> 240/255)
        shadow_pixels = np.sum(gray < 15)
        shadow_percent = float((shadow_pixels / total_pixels) * 100)
        
        highlight_pixels = np.sum(gray > 240)
        highlight_percent = float((highlight_pixels / total_pixels) * 100)
        
        exposure_score = 100.0
        
        if mean_brightness < 70:
            exposure_score -= (70 - mean_brightness) * 0.8
        elif mean_brightness > 180:
            exposure_score -= (mean_brightness - 180) * 0.8
            
        if highlight_percent > 8.0:
            exposure_score -= (highlight_percent - 8.0) * 2.0
            
        if shadow_percent > 15.0:
            exposure_score -= (shadow_percent - 15.0) * 1.0

        exposure_score = max(0.0, min(100.0, exposure_score))

        return {
            "mean_brightness": float(round(mean_brightness, 1)),
            "shadow_percent": float(round(shadow_percent, 1)),
            "highlight_percent": float(round(highlight_percent, 1)),
            "exposure_score": float(round(exposure_score, 1))
        }

    def calculate_ear(self, coords, eye_indices):
        """
        Calculates Eye Aspect Ratio (EAR) using 6 landmark spatial coordinates.
        EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
        """
        p1 = coords[eye_indices[0]]
        p2 = coords[eye_indices[1]]
        p3 = coords[eye_indices[2]]
        p4 = coords[eye_indices[3]]
        p5 = coords[eye_indices[4]]
        p6 = coords[eye_indices[5]]
        
        d_vertical1 = np.linalg.norm(p2 - p6)
        d_vertical2 = np.linalg.norm(p3 - p5)
        d_horizontal = np.linalg.norm(p1 - p4)
        
        if d_horizontal == 0:
            return 0.0
        return (d_vertical1 + d_vertical2) / (2.0 * d_horizontal)

    def analyze_faces(self, rgb_image):
        """
        Checks for human subjects, tracks exact facial eye landmarks (EAR) and mouth corners (Smile).
        """
        if self.engine == "yolov8" and HAS_YOLO:
            faces_data = self.analyze_faces_yolo(rgb_image)
        elif not HAS_MEDIAPIPE or self.face_mesh is None:
            faces_data = self.analyze_faces_opencv(rgb_image)
        else:
            h, w = rgb_image.shape[:2]
            results = self.face_mesh.process(rgb_image)
            faces_data = []

            if results.multi_face_landmarks:
                for i, face_landmarks in enumerate(results.multi_face_landmarks):
                    coords = np.array([[lm.x * w, lm.y * h, lm.z * w] for lm in face_landmarks.landmark])
                    
                    # Face boundary box
                    x_min, y_min = np.min(coords[:, :2], axis=0)
                    x_max, y_max = np.max(coords[:, :2], axis=0)
                    box = {
                        "x": float(max(0, x_min)),
                        "y": float(max(0, y_min)),
                        "width": float(min(w - x_min, x_max - x_min)),
                        "height": float(min(h - y_min, y_max - y_min))
                    }

                    # --- Eye Aspect Ratio (EAR) Mappings ---
                    # Canonical MediaPipe Face Mesh landmark topology indices
                    right_eye = [33, 159, 158, 133, 153, 145]
                    left_eye = [362, 380, 374, 263, 386, 385]

                    left_ear = self.calculate_ear(coords, left_eye)
                    right_ear = self.calculate_ear(coords, right_eye)
                    avg_ear = (left_ear + right_ear) / 2.0
                    
                    # EAR threshold evaluation (normal open 0.20-0.35, closed < 0.16)
                    # Raw eye score
                    eye_score = max(0.0, min(100.0, (avg_ear - 0.13) / (0.28 - 0.13) * 100.0))
                    eyes_closed = avg_ear < 0.165

                    # --- Smile Score Expression Tracking ---
                    # Horizontal corners of mouth: 61 (right), 291 (left)
                    # Vertical lip borders: 13 (upper inner), 14 (lower inner)
                    p61 = coords[61]
                    p291 = coords[291]
                    p13 = coords[13]
                    p14 = coords[14]

                    mouth_width = np.linalg.norm(p61 - p291)
                    lip_center_y = (p13[1] + p14[1]) / 2.0
                    corners_y = (p61[1] + p291[1]) / 2.0
                    
                    # Height of face to normalize
                    face_height = box["height"] if box["height"] > 0 else h * 0.2
                    
                    # Elevation ratio (lifting corners of mouth creates smile)
                    # lip_center_y > corners_y when corners are pulled upward
                    elevation = (lip_center_y - corners_y) / max(0.001, face_height)
                    
                    # Map to smile percentage: normal neutral is slightly negative or near 0 (-0.02 to 0.02)
                    # Full smile reaches 0.08+
                    smile_score = max(0.0, min(100.0, (elevation + 0.02) / 0.1 * 100.0))

                    # --- Head Pose Estimation ---
                    model_points = np.array([
                        (0.0, 0.0, 0.0),             # Nose tip
                        (0.0, -330.0, -65.0),        # Chin
                        (-225.0, 170.0, -135.0),     # Left eye left corner
                        (225.0, 170.0, -135.0),      # Right eye right corner
                        (-150.0, -150.0, -125.0),    # Left mouth corner
                        (150.0, -150.0, -125.0)      # Right mouth corner
                    ])
                    image_points = np.array([
                        coords[1][:2], coords[152][:2], coords[33][:2], coords[263][:2], coords[61][:2], coords[291][:2]
                    ], dtype="double")

                    focal_len = w
                    center = (w / 2, h / 2)
                    camera_matrix = np.array([[focal_len, 0, center[0]], [0, focal_len, center[1]], [0, 0, 1]], dtype="double")
                    dist_coeffs = np.zeros((4, 1))
                    
                    yaw, pitch, roll = 0.0, 0.0, 0.0
                    pose_score = 100.0

                    success, rotation_vector, translation_vector = cv2.solvePnP(
                        model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
                    )
                    if success:
                        rmat, _ = cv2.Rodrigues(rotation_vector)
                        sy = math.sqrt(rmat[0,0] * rmat[0,0] +  rmat[1,0] * rmat[1,0])
                        if sy >= 1e-6:
                            pitch = math.atan2(rmat[2,1], rmat[2,2])
                            yaw = math.atan2(-rmat[2,0], sy)
                            roll = math.atan2(rmat[1,0], rmat[0,0])
                        else:
                            pitch = math.atan2(-rmat[1,2], rmat[1,1])
                            yaw = math.atan2(-rmat[2,0], sy)
                            roll = 0
                        
                        yaw = math.degrees(yaw)
                        pitch = math.degrees(pitch)
                        roll = math.degrees(roll)
                        
                        # Pose accuracy score: deduct points for high yaw/pitch angles
                        pose_dev = math.sqrt(yaw**2 + pitch**2)
                        pose_score = max(0.0, min(100.0, 100.0 - (pose_dev / 40.0) * 100.0))

                    faces_data.append({
                        "face_index": i,
                        "box": box,
                        "ear": float(round(avg_ear, 3)),
                        "eye_score": float(round(eye_score, 1)),
                        "eyes_closed": bool(eyes_closed),
                        "smile_score": float(round(smile_score, 1)),
                        "pose": {
                            "yaw": float(round(yaw, 1)),
                            "pitch": float(round(pitch, 1)),
                            "roll": float(round(roll, 1))
                        },
                        "pose_score": float(round(pose_score, 1))
                    })

        # Apply absolute size and relative size filtering to ALL engines
        if faces_data:
            # 1. Filter out absolute small faces (< 100px)
            faces_data = [f for f in faces_data if f["box"]["width"] >= 100 and f["box"]["height"] >= 100]
            
            # 2. Filter relative to largest face
            if faces_data:
                max_w = max(f["box"]["width"] for f in faces_data)
                faces_data = [f for f in faces_data if f["box"]["width"] >= max_w * 0.25]
                
            # 3. Reset face index
            for idx, f in enumerate(faces_data):
                f["face_index"] = idx
                
        return faces_data

    def analyze_faces_opencv(self, rgb_image):
        """
        Fallback Haar Cascade face classifier when MediaPipe is unavailable.
        """
        try:
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        except Exception:
            return []

        bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))
        faces_data = []

        for i, (x, y, w, h) in enumerate(faces):
            box = {"x": float(x), "y": float(y), "width": float(w), "height": float(h)}
            
            # Extract upper 60% of face for eyes
            eye_roi_gray = gray[y:y+int(h*0.6), x:x+w]
            eyes = eye_cascade.detectMultiScale(eye_roi_gray, scaleFactor=1.1, minNeighbors=4, minSize=(int(w*0.08), int(h*0.08)))
            
            num_eyes = len(eyes)
            eyes_closed = num_eyes < 2
            eye_score = 100.0 if num_eyes >= 2 else (50.0 if num_eyes == 1 else 0.0)
            
            # Simple fallback smile estimate (mouth is in lower 40% of face)
            smile_score = 50.0  # Default neutral/average value
            
            faces_data.append({
                "face_index": i,
                "box": box,
                "ear": 0.25 if not eyes_closed else 0.1,
                "eye_score": float(eye_score),
                "eyes_closed": bool(eyes_closed),
                "smile_score": float(smile_score),
                "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
                "pose_score": 80.0
            })

        return faces_data

    def analyze_faces_yolo(self, rgb_image):
        """
        Premium Person & Face isolation engine using YOLOv8.
        """
        if not HAS_YOLO:
            return self.analyze_faces_opencv(rgb_image)
            
        try:
            if self.yolo_model is None:
                self.yolo_model = YOLO("yolov8n.pt")
                if torch.cuda.is_available():
                    self.yolo_model.to("cuda")
                    
            results = self.yolo_model(rgb_image, classes=[0], verbose=False)
            faces_data = []
            h_img, w_img = rgb_image.shape[:2]
            person_idx = 0
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    xyxy = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = xyxy
                    w = x2 - x1
                    h = y2 - y1
                    
                    # Upper 35% estimated face region
                    face_box = {
                        "x": float(max(0, x1)),
                        "y": float(max(0, y1)),
                        "width": float(min(w_img - x1, w)),
                        "height": float(min(h_img - y1, h * 0.35))
                    }
                    
                    # Eye check
                    ey1, ey2 = int(face_box["y"]), int(face_box["y"] + face_box["height"])
                    ex1, ex2 = int(face_box["x"]), int(face_box["x"] + face_box["width"])
                    num_eyes = 2
                    eyes_closed = False
                    
                    if (ey2 - ey1) > 10 and (ex2 - ex1) > 10:
                        gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
                        eye_roi = gray[ey1:ey2, ex1:ex2]
                        try:
                            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
                            eyes = eye_cascade.detectMultiScale(eye_roi, scaleFactor=1.1, minNeighbors=3, minSize=(int(face_box["width"]*0.08), int(face_box["height"]*0.1)))
                            num_eyes = len(eyes)
                        except Exception:
                            num_eyes = 2
                            
                    eyes_closed = num_eyes < 2
                    eye_score = 100.0 if num_eyes >= 2 else (50.0 if num_eyes == 1 else 0.0)
                    
                    faces_data.append({
                        "face_index": person_idx,
                        "box": face_box,
                        "ear": 0.25 if not eyes_closed else 0.1,
                        "eye_score": float(eye_score),
                        "eyes_closed": bool(eyes_closed),
                        "smile_score": 50.0,
                        "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
                        "pose_score": 90.0
                    })
                    person_idx += 1
                    
            return faces_data
        except Exception as e:
            print(f"[WARN] YOLOv8 face processing failed: {e}. Falling back to OpenCV.")
            return self.analyze_faces_opencv(rgb_image)

    def apply_temporal_smoothing(self, photos_metadata: list, sequence_window=3):
        """
        Temporal smoothing filter: Tracks the EAR / blink status across consecutive frames.
        If the ratio falls below the threshold for more than N = 3 frames, the eye is flagged as closed.
        Corrects single transient frames where open eyes are misidentified as closed.
        """
        # Sort chronologically by EXIF DateTimeOriginal
        sorted_meta = sorted(photos_metadata, key=lambda x: x.get("metadata", {}).get("datetime_original") or "")
        
        # Group by cluster_id
        clusters = {}
        for item in sorted_meta:
            cid = item.get("cluster_id")
            if cid is not None:
                if cid not in clusters:
                    clusters[cid] = []
                clusters[cid].append(item)

        # Apply smoothing window inside each scene cluster
        for cid, cluster_items in clusters.items():
            if len(cluster_items) < 3:
                continue
                
            # Keep history of EAR states for each face index across the cluster sequence
            # Since face detection indexes can fluctuate, we match faces based on bounding box overlap (IoU)
            # or just simple indexed matching if only 1 subject
            # Let's write a robust single/multi-person EAR tracker
            for i in range(len(cluster_items)):
                current_item = cluster_items[i]
                if current_item.get("faces_detected", 0) == 0:
                    continue

                for f_idx, current_face in enumerate(current_item.get("faces", [])):
                    # Gather EARs of the same subject in previous and next frames
                    window_ears = []
                    
                    # Backwards
                    back_idx = i - 1
                    while back_idx >= 0 and len(window_ears) < sequence_window // 2:
                        prev_item = cluster_items[back_idx]
                        if prev_item.get("faces_detected", 0) > f_idx:
                            window_ears.append(prev_item["faces"][f_idx]["ear"])
                        back_idx -= 1
                    
                    # Add current
                    window_ears.append(current_face["ear"])
                    
                    # Forwards
                    fwd_idx = i + 1
                    while fwd_idx < len(cluster_items) and len(window_ears) < sequence_window:
                        next_item = cluster_items[fwd_idx]
                        if next_item.get("faces_detected", 0) > f_idx:
                            window_ears.append(next_item["faces"][f_idx]["ear"])
                        fwd_idx += 1
                        
                    # Calculate smoothed EAR
                    smoothed_ear = np.mean(window_ears)
                    
                    # Override closed flag if smoothed EAR is healthy
                    # Or keep closed if it remains below threshold for more than N=3 frames
                    is_closed_smoothed = smoothed_ear < 0.165
                    
                    current_face["ear_smoothed"] = float(round(smoothed_ear, 3))
                    current_face["eyes_closed"] = bool(is_closed_smoothed)
                    # Recalculate face eye score
                    current_face["eye_score"] = float(round(max(0.0, min(100.0, (smoothed_ear - 0.13) / (0.28 - 0.13) * 100.0)), 1))

                # Update any_eyes_closed flag
                current_item["any_eyes_closed"] = any(f["eyes_closed"] for f in current_item.get("faces", []))

        return sorted_meta

    # ==========================================
    # Stage 5: Subjective Aesthetic Assessment
    # ==========================================
    def get_heuristic_aesthetic_score(self, bgr_image):
        """
        Fast mathematical heuristic for image aesthetic scoring when CLIP/NIMA are unavailable.
        Uses Rule-of-Thirds edge layout, contrast, and color saturation distribution.
        """
        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        # 1. Rule of Thirds edge density check
        # Calculate Canny edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Split into 3x3 grid
        h_third, w_third = h // 3, w // 3
        thirds_density = []
        for row in range(3):
            for col in range(3):
                roi = edges[row*h_third:(row+1)*h_third, col*w_third:(col+1)*w_third]
                density = np.sum(roi > 0) / (h_third * w_third + 1e-5)
                thirds_density.append(density)
        
        # Center-weighted / off-center focus is aesthetically pleasing (rule of thirds points)
        # Intersection grids are thirds_density indices: 1, 3, 5, 7.
        intersection_weight = (thirds_density[1] + thirds_density[3] + thirds_density[5] + thirds_density[7]) / 4.0
        background_weight = (thirds_density[0] + thirds_density[2] + thirds_density[6] + thirds_density[8]) / 4.0
        
        # Composition ratio
        comp_score = 0.5
        if background_weight > 0:
            ratio = intersection_weight / background_weight
            # Ideal composition has foreground edges on intersections and cleaner backgrounds
            comp_score = min(1.0, ratio / 3.0)

        # 2. Contrast/Dynamic Range Score
        std_contrast = np.std(gray)
        contrast_score = min(1.0, std_contrast / 75.0)

        # 3. Saturation Score (Vividness)
        hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
        sat_mean = np.mean(hsv[:, :, 1])
        sat_score = min(1.0, sat_mean / 90.0)

        # Combine: Aesthetics scale 1.0 - 10.0
        score = 2.0 + (comp_score * 3.0) + (contrast_score * 3.0) + (sat_score * 2.0)
        return float(round(score, 2))

    def analyze_aesthetics_clip(self, rgb_image):
        """
        Regresses CLIP ViT-L/14 image embedding into AVA aesthetic score (1.0-10.0)
        via lightweight Projection MLP.
        """
        if self.clip_session is None:
            return self.get_heuristic_aesthetic_score(cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))

        try:
            # Preprocess for CLIP
            resized = cv2.resize(rgb_image, (224, 224))
            inp = resized.astype(np.float32) / 255.0
            mean = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
            std = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
            inp = (inp - mean) / std
            inp = inp.transpose(2, 0, 1)
            inp = np.expand_dims(inp, axis=0)

            inputs = {self.clip_session.get_inputs()[0].name: inp}
            outputs = self.clip_session.run(None, inputs)
            score = float(outputs[0][0][0])
            return float(round(max(1.0, min(10.0, score)), 2))
        except Exception as e:
            print(f"[WARN] ONNX CLIP Aesthetics inference failed: {e}")
            return self.get_heuristic_aesthetic_score(cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))

    def analyze_aesthetics_nima(self, rgb_image):
        """
        Estimates the NIMA distribution across 10 distinct aesthetic score buckets.
        Returns:
            mean_score (float, 1.0-10.0)
            variance (float, scoring uncertainty)
            distribution (list of 10 probabilities)
        """
        if self.nima_session is not None:
            try:
                # Preprocess for NIMA: MobileNet/VGG expects 224x224
                resized = cv2.resize(rgb_image, (224, 224))
                inp = resized.astype(np.float32) / 255.0
                mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
                std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
                inp = (inp - mean) / std
                inp = inp.transpose(2, 0, 1)
                inp = np.expand_dims(inp, axis=0)

                inputs = {self.nima_session.get_inputs()[0].name: inp}
                outputs = self.nima_session.run(None, inputs)
                probs = outputs[0][0]  # Shape: (10,)
                
                # Expected value
                mean_score = sum((s + 1) * probs[s] for s in range(10))
                # Variance
                variance = sum(probs[s] * (((s + 1) - mean_score) ** 2) for s in range(10))
                
                return {
                    "mean": float(round(mean_score, 2)),
                    "variance": float(round(variance, 3)),
                    "distribution": [float(p) for p in probs]
                }
            except Exception as e:
                print(f"[WARN] ONNX NIMA inference failed: {e}")

        # Heuristic simulation of NIMA expected value & variance around CLIP/Heuristic score
        clip_score = self.analyze_aesthetics_clip(rgb_image)
        
        # Mock a Gaussian-like distribution centered on clip_score
        probs = np.zeros(10)
        mean_idx = clip_score - 1.0  # Scale 1-10 to index 0-9
        
        # Build Gaussian distribution
        for i in range(10):
            probs[i] = math.exp(-((i - mean_idx) ** 2) / 2.0)
        probs /= np.sum(probs)
        
        # Compute exact variance of this mock distribution
        mean_score = sum((s + 1) * probs[s] for s in range(10))
        variance = sum(probs[s] * (((s + 1) - mean_score) ** 2) for s in range(10))

        return {
            "mean": float(round(mean_score, 2)),
            "variance": float(round(variance, 3)),
            "distribution": [float(p) for p in probs]
        }

    # ==========================================
    # Stage 6: Weighted Decision Engine & Output
    # ==========================================
    def compute_composite_score(self, focus_score, ear_score, smile_score, aesthetic_score, mode="portrait"):
        """
        Weighted Multi-Criteria Decision Function.
        C(i) = w_focus*F + w_eyes*E + w_smile*S + w_aesthetic*A
        Modes: 'portrait', 'landscape', 'action_sport'
        """
        # Mode weights mapping
        weights_config = {
            'portrait':     {'w_focus': 0.25, 'w_eyes': 0.35, 'w_smile': 0.15, 'w_aesthetic': 0.25},
            'landscape':    {'w_focus': 0.50, 'w_eyes': 0.00, 'w_smile': 0.00, 'w_aesthetic': 0.50},
            'action_sport': {'w_focus': 0.60, 'w_eyes': 0.00, 'w_smile': 0.00, 'w_aesthetic': 0.40}
        }
        
        cfg = weights_config.get(mode, weights_config['portrait'])
        
        # Scale inputs (Aesthetic is 1-10, scale to 0-100)
        norm_aesthetic = (aesthetic_score - 1.0) / 9.0 * 100.0 if aesthetic_score >= 1.0 else 0.0
        
        weighted = (
            cfg['w_focus'] * focus_score +
            cfg['w_eyes'] * ear_score +
            cfg['w_smile'] * smile_score +
            cfg['w_aesthetic'] * norm_aesthetic
        )
        
        return float(round(weighted, 1))

    def write_xmp_sidecar(self, image_path, recommendation):
        """
        Writes selection flags back to local XMP sidecar files, preserving original RAW assets.
        Compatible with Adobe Lightroom / Capture One.
        Keep -> Rating 5 (Green Label), Review -> Rating 3 (Yellow Label), Reject -> Rating 1 (Red Label)
        """
        try:
            xmp_path = os.path.splitext(image_path)[0] + ".xmp"
            
            ratings = {"Keep": "5", "Review": "3", "Reject": "1"}
            labels = {"Keep": "Green", "Review": "Yellow", "Reject": "Red"}
            
            rating = ratings.get(recommendation, "3")
            label = labels.get(recommendation, "Yellow")
            
            xmp_content = f"""<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6-c140">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:lr="http://ns.adobe.com/lightroom/1.0/"
   xmp:Rating="{rating}"
   xmp:Label="{label}">
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
"""
            with open(xmp_path, "w", encoding="utf-8") as f:
                f.write(xmp_content)
        except Exception as e:
            print(f"[ERROR] Failed to write XMP sidecar for {image_path}: {e}")

    # ==========================================
    # Full Photo Analysis Pipeline
    # ==========================================
    def analyze(self, file_path, mode="portrait"):
        """
        Runs the full 6-stage photo culling pipeline on a target file.
        """
        # Stage 1: Ingestion & Telemetry extraction
        rgb_image, bgr_image, preview_bytes = self.load_image(file_path)
        if bgr_image is None:
            return None, None

        exif_meta = self.parse_exif(file_path)

        # Stage 2: Visual orientation correction
        rgb_image, angle = self.correct_orientation(rgb_image, exif_meta.get("datetime_original"))
        if angle != 0:
            # Re-sync BGR image if rotated
            bgr_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)

        # Stage 3: Embedding extraction (DHash & Visual features)
        dhash_val = self.calculate_dhash(bgr_image)
        embedding_val = self.get_semantic_embedding(rgb_image).tolist()

        # Stage 4: Focus, Exposure, Face mesh evaluations
        focus = self.analyze_focus(bgr_image)
        exposure = self.analyze_exposure(bgr_image)
        faces = self.analyze_faces(rgb_image)

        # Context-Aware Localized Focus Adjustments
        # If human subjects are present, focus rating prioritizes face areas (80% face focus, 20% global)
        if faces:
            gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
            face_sharpnesses = []
            
            for f in faces:
                box = f["box"]
                fx, fy = int(box["x"]), int(box["y"])
                fw, fh = int(box["width"]), int(box["height"])
                
                ih, iw = gray.shape[:2]
                fx, fy = max(0, fx), max(0, fy)
                fw, fh = min(iw - fx, fw), min(ih - fy, fh)
                
                if fw > 10 and fh > 10:
                    face_roi = gray[fy:fy+fh, fx:fx+fw]
                    mean_roi = np.mean(face_roi)
                    if mean_roi == 0:
                        mean_roi = 1.0
                    face_var = cv2.Laplacian(face_roi, cv2.CV_64F).var()
                    face_norm_var = face_var / (mean_roi ** 2)
                    
                    face_focus_score = min(100.0, (face_norm_var / 0.02) * 100.0)
                    face_sharpnesses.append(face_focus_score)
            
            if face_sharpnesses:
                min_face_focus = min(face_sharpnesses)
                blended_focus = (min_face_focus * 0.8) + (focus["sharpness_score"] * 0.2)
                focus["sharpness_score"] = float(round(blended_focus, 1))
                focus["face_focus_score"] = float(round(min_face_focus, 1))

        # Stage 5: Aesthetic assessments (CLIP & NIMA)
        aesthetic_score = self.analyze_aesthetics_clip(rgb_image)
        nima = self.analyze_aesthetics_nima(rgb_image)

        # Stage 6: Weighted Optimization Score synthesis
        # Aggregate sub-metrics for faces
        faces_detected = len(faces)
        any_eyes_closed = False
        ear_score = 100.0
        smile_score = 100.0

        if faces_detected > 0:
            any_eyes_closed = any(f["eyes_closed"] for f in faces)
            ear_score = min(f["eye_score"] for f in faces)
            smile_score = sum(f["smile_score"] for f in faces) / faces_detected

        composite_score = self.compute_composite_score(
            focus_score=focus["sharpness_score"],
            ear_score=ear_score,
            smile_score=smile_score,
            aesthetic_score=aesthetic_score,
            mode=mode
        )

        # Handle closed eye penalty (reduce score dramatically if anyone blinked)
        if faces_detected > 0 and any_eyes_closed:
            composite_score *= 0.5

        composite_score = max(0.0, min(100.0, composite_score))

        # Classify recommendation Keep/Review/Reject
        recommendation = "Review"
        if composite_score >= 72.0:
            recommendation = "Keep"
        elif composite_score < 45.0 or (faces_detected > 0 and any_eyes_closed and composite_score < 55.0):
            recommendation = "Reject"

        # Auto write XMP sidecar rating
        self.write_xmp_sidecar(file_path, recommendation)

        result = {
            "filename": os.path.basename(file_path),
            "filepath": file_path,
            "overall_score": float(round(composite_score, 1)),
            "recommendation": recommendation,
            "focus": focus,
            "exposure": exposure,
            "faces_detected": faces_detected,
            "faces": faces,
            "any_eyes_closed": any_eyes_closed,
            "aesthetics": {
                "clip_score": aesthetic_score,
                "nima_mean": nima["mean"],
                "nima_variance": nima["variance"],
                "nima_distribution": nima["distribution"]
            },
            "metadata": exif_meta,
            "dhash": dhash_val,
            "embedding": embedding_val,
            "cluster_id": None  # Assigned at session scan level
        }
        
        return result, preview_bytes
