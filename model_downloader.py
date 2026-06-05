"""
Model Downloader for CineCull
Downloads AI models on-demand from HuggingFace/GitHub with progress tracking.
"""

import os
import urllib.request
import urllib.error
import threading
import time
from typing import Dict, Any, Optional, Callable, List
from model_registry import MODEL_REGISTRY, get_model_info


MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


class DownloadProgress:
    """Tracks download progress for a model."""

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.total_bytes = 0
        self.downloaded_bytes = 0
        self.status = "pending"  # pending, downloading, complete, error, cancelled
        self.error_message = ""
        self.speed_bps = 0
        self._start_time = None
        self._lock = threading.Lock()
        self._callback = None

    def set_callback(self, callback: Callable[[Dict[str, Any]], None]):
        self._callback = callback

    def _notify(self):
        if self._callback:
            self._callback(self.to_dict())

    def update(self, chunk_size: int):
        with self._lock:
            self.downloaded_bytes += chunk_size
            if self._start_time:
                elapsed = time.time() - self._start_time
                if elapsed > 0:
                    self.speed_bps = self.downloaded_bytes / elapsed
            self._notify()

    def set_total(self, total: int):
        with self._lock:
            self.total_bytes = total
            self._start_time = time.time()
            self._notify()

    def set_status(self, status: str, error_message: str = ""):
        with self._lock:
            self.status = status
            self.error_message = error_message
            self._notify()

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            downloaded_mb = round(self.downloaded_bytes / (1024 * 1024), 2)
            total_mb = round(self.total_bytes / (1024 * 1024), 2)
            remaining_mb = round(max(0, self.total_bytes - self.downloaded_bytes) / (1024 * 1024), 2)
            progress_pct = round((self.downloaded_bytes / self.total_bytes * 100), 1) if self.total_bytes > 0 else 0

            eta_seconds = None
            if self.speed_bps > 0 and self.total_bytes > 0:
                remaining_bytes = max(0, self.total_bytes - self.downloaded_bytes)
                eta_seconds = round(remaining_bytes / self.speed_bps)

            return {
                "model_id": self.model_id,
                "total_bytes": self.total_bytes,
                "downloaded_bytes": self.downloaded_bytes,
                "total_mb": total_mb,
                "downloaded_mb": downloaded_mb,
                "remaining_mb": remaining_mb,
                "progress_pct": progress_pct,
                "status": self.status,
                "error_message": self.error_message,
                "speed_mbps": round(self.speed_bps / (1024 * 1024), 2),
                "eta_seconds": eta_seconds
            }


class ModelDownloader:
    """Downloads AI models on-demand."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._downloads: Dict[str, DownloadProgress] = {}
        self._download_lock = threading.Lock()
        os.makedirs(MODELS_DIR, exist_ok=True)

    def get_models_dir(self) -> str:
        return MODELS_DIR

    def is_downloaded(self, model_id: str) -> bool:
        """Check if a model file exists locally."""
        info = self._find_model_info(model_id)
        if not info or not info.get("file"):
            return True
        return os.path.exists(os.path.join(MODELS_DIR, info["file"]))

    def get_model_path(self, model_id: str) -> Optional[str]:
        """Get local path for a model."""
        info = self._find_model_info(model_id)
        if not info or not info.get("file"):
            return None
        path = os.path.join(MODELS_DIR, info["file"])
        return path if os.path.exists(path) else None

    def get_downloaded_models(self) -> List[str]:
        """Get list of all downloaded model IDs."""
        downloaded = []
        for task, variants in MODEL_REGISTRY.items():
            for model_id, info in variants.items():
                if not info.get("file"):
                    downloaded.append(model_id)
                elif os.path.exists(os.path.join(MODELS_DIR, info["file"])):
                    downloaded.append(model_id)
        return downloaded

    def get_download_progress(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get current download progress for a model."""
        with self._download_lock:
            if model_id in self._downloads:
                return self._downloads[model_id].to_dict()
        return None

    def get_all_progress(self) -> List[Dict[str, Any]]:
        """Get progress for all active downloads."""
        with self._download_lock:
            return [d.to_dict() for d in self._downloads.values()]

    def download_model(
        self,
        model_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> bool:
        """
        Download a model file.

        Args:
            model_id: Model identifier
            progress_callback: Optional callback for progress updates

        Returns:
            True if download succeeded or already exists
        """
        if self.is_downloaded(model_id):
            return True

        info = self._find_model_info(model_id)
        if not info:
            print(f"[ERROR] Model not found in registry: {model_id}")
            return False

        url = info.get("url")
        if not url:
            print(f"[WARN] Model {model_id} has no download URL (built-in model)")
            return True

        filename = info["file"]
        dest_path = os.path.join(MODELS_DIR, filename)

        # Create progress tracker
        progress = DownloadProgress(model_id)
        if progress_callback:
            progress.set_callback(progress_callback)

        with self._download_lock:
            self._downloads[model_id] = progress

        progress.set_status("downloading")
        print(f"[INFO] Downloading model {model_id} from {url}...")

        try:
            self._download_file(url, dest_path, progress)
            progress.set_status("complete")
            print(f"[INFO] Model {model_id} downloaded successfully to {dest_path}")
            return True

        except Exception as e:
            progress.set_status("error", str(e))
            print(f"[ERROR] Failed to download model {model_id}: {e}")
            # Clean up partial download
            if os.path.exists(dest_path):
                try:
                    os.remove(dest_path)
                except OSError:
                    pass
            return False

    def download_model_async(
        self,
        model_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> threading.Thread:
        """Download a model in a background thread."""
        thread = threading.Thread(
            target=self.download_model,
            args=(model_id, progress_callback),
            daemon=True
        )
        thread.start()
        return thread

    def predownload_for_tier(
        self,
        tier: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> List[threading.Thread]:
        """
        Pre-download all recommended models for a GPU tier.

        Args:
            tier: GPU tier (low, medium, high, ultra)
            progress_callback: Optional callback for progress updates

        Returns:
            List of download threads
        """
        from model_registry import DEFAULT_MODELS

        defaults = DEFAULT_MODELS.get(tier, DEFAULT_MODELS["low"])
        threads = []

        for task, model_id in defaults.items():
            if not self.is_downloaded(model_id):
                thread = self.download_model_async(model_id, progress_callback)
                threads.append(thread)

        return threads

    def delete_model(self, model_id: str) -> bool:
        """Delete a downloaded model file."""
        info = self._find_model_info(model_id)
        if not info or not info.get("file"):
            return False

        path = os.path.join(MODELS_DIR, info["file"])
        if os.path.exists(path):
            try:
                os.remove(path)
                print(f"[INFO] Deleted model {model_id}: {path}")
                return True
            except OSError as e:
                print(f"[ERROR] Failed to delete model {model_id}: {e}")
                return False
        return False

    def get_total_downloaded_size_mb(self) -> float:
        """Get total size of all downloaded models in MB."""
        total = 0
        for f in os.listdir(MODELS_DIR):
            path = os.path.join(MODELS_DIR, f)
            if os.path.isfile(path):
                total += os.path.getsize(path)
        return round(total / (1024 * 1024), 1)

    def _download_file(self, url: str, dest: str, progress: DownloadProgress):
        """Download a file with progress tracking."""
        req = urllib.request.Request(url, headers={
            "User-Agent": "CineCull/1.0"
        })

        response = urllib.request.urlopen(req, timeout=60)
        total = int(response.headers.get("Content-Length", 0))
        progress.set_total(total)

        chunk_size = 1024 * 64  # 64KB chunks

        # Download to temp file first
        temp_dest = dest + ".tmp"
        with open(temp_dest, "wb") as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                if progress.status == "cancelled":
                    raise Exception("Download cancelled")
                f.write(chunk)
                progress.update(len(chunk))

        # Atomic rename
        os.replace(temp_dest, dest)

    def _find_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Find model info across all tasks."""
        for task, variants in MODEL_REGISTRY.items():
            if model_id in variants:
                return variants[model_id]
        return None


# Module-level singleton
downloader = ModelDownloader()
