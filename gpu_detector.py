"""
GPU Detection Module for CineCull
Detects NVIDIA GPU capabilities and recommends appropriate AI models.
"""

import os
from typing import Optional, Dict, Any, List

# Try pynvml first (most detailed NVIDIA info)
try:
    import pynvml
    pynvml.nvmlInit()
    HAS_PYNVML = True
except Exception:
    HAS_PYNVML = False

# Try torch.cuda as fallback
try:
    import torch
    HAS_TORCH_CUDA = torch.cuda.is_available()
except ImportError:
    HAS_TORCH_CUDA = False

# ONNX Runtime for provider detection
try:
    import onnxruntime as ort
    HAS_ORT = True
except ImportError:
    HAS_ORT = False


class GPUDetector:
    """Detects GPU hardware and provides recommendations."""

    @staticmethod
    def detect() -> Dict[str, Any]:
        """
        Detect GPU hardware and return comprehensive info.

        Returns:
            Dict with gpu_name, vram_mb, tier, cuda_compute, driver, recommendations
        """
        # Try pynvml first (most detailed)
        if HAS_PYNVML:
            try:
                return GPUDetector._detect_pynvml()
            except Exception as e:
                print(f"[WARN] pynvml detection failed: {e}")

        # Fallback to torch.cuda
        if HAS_TORCH_CUDA:
            try:
                return GPUDetector._detect_torch()
            except Exception as e:
                print(f"[WARN] torch.cuda detection failed: {e}")

        # Fallback to ONNX Runtime
        if HAS_ORT:
            return GPUDetector._detect_onnx()

        # CPU-only fallback
        return GPUDetector._detect_cpu_only()

    @staticmethod
    def _detect_pynvml() -> Dict[str, Any]:
        """Detect GPU using pynvml (NVIDIA Management Library)."""
        device_count = pynvml.nvmlDeviceGetCount()
        if device_count == 0:
            raise Exception("No NVIDIA devices found")

        # Use first GPU
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)

        # Get GPU name
        gpu_name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode('utf-8')

        # Get VRAM
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        vram_mb = mem_info.total // (1024 * 1024)

        # Get CUDA compute capability
        major, minor = pynvml.nvmlDeviceGetCudaComputeCapability(handle)
        cuda_compute = f"{major}.{minor}"

        # Get driver version
        driver = pynvml.nvmlSystemGetDriverVersion()
        if isinstance(driver, bytes):
            driver = driver.decode('utf-8')

        # Determine tier
        tier = GPUDetector._calculate_tier(vram_mb, cuda_compute)

        # Get recommendations
        recommendations = GPUDetector._get_recommendations(tier, vram_mb)

        return {
            "gpu_name": gpu_name,
            "vram_mb": vram_mb,
            "vram_gb": round(vram_mb / 1024, 1),
            "tier": tier,
            "cuda_compute": cuda_compute,
            "driver": driver,
            "device_count": device_count,
            "detection_method": "pynvml",
            "recommendations": recommendations
        }

    @staticmethod
    def _detect_torch() -> Dict[str, Any]:
        """Detect GPU using torch.cuda."""
        gpu_name = torch.cuda.get_device_name(0)
        vram_mb = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)

        # Get compute capability
        props = torch.cuda.get_device_properties(0)
        cuda_compute = f"{props.major}.{props.minor}"

        # Driver version from torch
        driver = torch.version.cuda or "Unknown"

        tier = GPUDetector._calculate_tier(vram_mb, cuda_compute)
        recommendations = GPUDetector._get_recommendations(tier, vram_mb)

        return {
            "gpu_name": gpu_name,
            "vram_mb": vram_mb,
            "vram_gb": round(vram_mb / 1024, 1),
            "tier": tier,
            "cuda_compute": cuda_compute,
            "driver": f"CUDA {driver}",
            "device_count": torch.cuda.device_count(),
            "detection_method": "torch.cuda",
            "recommendations": recommendations
        }

    @staticmethod
    def _detect_onnx() -> Dict[str, Any]:
        """Detect GPU using ONNX Runtime providers."""
        available = ort.get_available_providers()

        if "CUDAExecutionProvider" in available:
            # CUDA available but no detailed info
            return {
                "gpu_name": "NVIDIA GPU (CUDA detected)",
                "vram_mb": 0,  # Unknown
                "vram_gb": 0,
                "tier": "medium",  # Assume medium if CUDA available
                "cuda_compute": "Unknown",
                "driver": "Unknown",
                "device_count": 1,
                "detection_method": "onnx_runtime",
                "recommendations": GPUDetector._get_recommendations("medium", 4096)
            }
        elif "DmlExecutionProvider" in available:
            return {
                "gpu_name": "DirectML GPU (Windows)",
                "vram_mb": 0,
                "vram_gb": 0,
                "tier": "medium",
                "cuda_compute": "N/A",
                "driver": "DirectML",
                "device_count": 1,
                "detection_method": "onnx_runtime",
                "recommendations": GPUDetector._get_recommendations("medium", 4096)
            }
        elif "CoreMLExecutionProvider" in available:
            return {
                "gpu_name": "Apple Neural Engine",
                "vram_mb": 0,
                "vram_gb": 0,
                "tier": "medium",
                "cuda_compute": "N/A",
                "driver": "CoreML",
                "device_count": 1,
                "detection_method": "onnx_runtime",
                "recommendations": GPUDetector._get_recommendations("medium", 4096)
            }

        # Only CPU
        return GPUDetector._detect_cpu_only()

    @staticmethod
    def _detect_cpu_only() -> Dict[str, Any]:
        """CPU-only fallback."""
        return {
            "gpu_name": "None (CPU only)",
            "vram_mb": 0,
            "vram_gb": 0,
            "tier": "low",
            "cuda_compute": "N/A",
            "driver": "N/A",
            "device_count": 0,
            "detection_method": "cpu_fallback",
            "recommendations": GPUDetector._get_recommendations("low", 0)
        }

    @staticmethod
    def _calculate_tier(vram_mb: int, cuda_compute: str) -> str:
        """
        Calculate GPU tier based on VRAM and compute capability.

        Returns: 'low', 'medium', 'high', 'ultra'
        """
        if vram_mb == 0:
            return "low"

        # Parse compute capability
        try:
            compute = float(cuda_compute)
        except (ValueError, TypeError):
            compute = 0.0

        # Tier based on VRAM
        if vram_mb < 4096:
            return "low"
        elif vram_mb < 8192:
            return "medium"
        elif vram_mb < 16384:
            return "high"
        else:
            return "ultra"

    @staticmethod
    def _get_recommendations(tier: str, vram_mb: int) -> Dict[str, List[str]]:
        """
        Get model recommendations based on GPU tier.

        Returns dict with recommended models per task.
        """
        recommendations = {
            "aesthetic": [],
            "embedding": [],
            "face_detection": []
        }

        if tier == "low":
            recommendations["aesthetic"] = ["nima_mobile", "nima"]
            recommendations["embedding"] = ["dinov2_small"]
            recommendations["face_detection"] = ["yolov8n", "opencv"]
        elif tier == "medium":
            recommendations["aesthetic"] = ["nima", "laion_aesthetic_v2", "hyper_iqa"]
            recommendations["embedding"] = ["dinov2_small", "dinov2_base"]
            recommendations["face_detection"] = ["yolov8n", "yolov8s"]
        elif tier == "high":
            recommendations["aesthetic"] = ["laion_aesthetic_v2", "hyper_iqa", "musiq"]
            recommendations["embedding"] = ["dinov2_base", "dinov2_large"]
            recommendations["face_detection"] = ["yolov8s", "yolov8m"]
        elif tier == "ultra":
            recommendations["aesthetic"] = ["laion_aesthetic_v2", "hyper_iqa", "musiq", "q_align"]
            recommendations["embedding"] = ["dinov2_large", "dinov2_giant"]
            recommendations["face_detection"] = ["yolov8m", "yolov8l"]

        return recommendations

    @staticmethod
    def get_gpu_utilization() -> Optional[Dict[str, Any]]:
        """Get current GPU utilization (if available)."""
        if not HAS_PYNVML:
            return None

        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

            return {
                "gpu_utilization": utilization.gpu,
                "memory_utilization": utilization.memory,
                "temperature_c": temp,
                "vram_used_mb": mem_info.used // (1024 * 1024),
                "vram_free_mb": mem_info.free // (1024 * 1024)
            }
        except Exception:
            return None


# Module-level function for easy access
def detect_gpu() -> Dict[str, Any]:
    """Convenience function to detect GPU."""
    return GPUDetector.detect()
