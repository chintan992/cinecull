"""
Model Registry for CineCull
Defines all available AI models, their requirements, and compatibility rules.
"""

from typing import Dict, List, Any, Optional


# ==========================================
# Model Registry - All available models
# ==========================================
MODEL_REGISTRY: Dict[str, Dict[str, Dict[str, Any]]] = {
    "aesthetic": {
        "nima_mobile": {
            "display_name": "NIMA MobileNet",
            "description": "Lightweight aesthetic scoring (MobileNetV2 backbone)",
            "file": "nima_mobile.onnx",
            "size_mb": 16,
            "vram_required_mb": 512,
            "quality": "basic",
            "speed": "fast",
            "quality_score": 30,
            "speed_score": 95,
            "url": "https://github.com/titu1994/neural-image-assessment/releases/download/v1.0/nima_mobile.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_type": "distribution_10",
            "tags": ["lightweight", "fast", "basic"]
        },
        "nima": {
            "display_name": "NIMA InceptionResNet",
            "description": "Standard aesthetic scoring (InceptionResNetV2 backbone)",
            "file": "nima.onnx",
            "size_mb": 90,
            "vram_required_mb": 1024,
            "quality": "good",
            "speed": "medium",
            "quality_score": 60,
            "speed_score": 60,
            "url": "https://github.com/titu1994/neural-image-assessment/releases/download/v1.0/nima_inception.onnx",
            "checksum": None,
            "input_size": [299, 299],
            "output_type": "distribution_10",
            "tags": ["standard", "balanced"]
        },
        "clip_aesthetic": {
            "display_name": "CLIP ViT-L Aesthetic",
            "description": "CLIP-based aesthetic predictor (ViT-L/14 + MLP head)",
            "file": "clip_aesthetic.onnx",
            "size_mb": 850,
            "vram_required_mb": 2048,
            "quality": "excellent",
            "speed": "medium",
            "quality_score": 80,
            "speed_score": 50,
            "url": "https://huggingface.co/openai/clip-vit-large-patch14/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_type": "score_1_10",
            "tags": ["clip", "high_quality", "popular"]
        },
        "laion_aesthetic_v2": {
            "display_name": "LAION Aesthetic v2",
            "description": "SOTA aesthetic predictor trained on 100M+ images",
            "file": "laion_aesthetic_v2.onnx",
            "size_mb": 350,
            "vram_required_mb": 2048,
            "quality": "excellent",
            "speed": "medium",
            "quality_score": 90,
            "speed_score": 55,
            "url": "https://huggingface.co/pharmapsychotic/clip-interrogator/resolve/main/salesforce_blip-opt-2.7b-coco-vqa-caption_extension.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_type": "score_1_10",
            "tags": ["sota", "laion", "recommended"]
        },
        "hyper_iqa": {
            "display_name": "HyperIQA",
            "description": "Hypernetwork-based no-reference IQA (adapts to content)",
            "file": "hyper_iqa.onnx",
            "size_mb": 180,
            "vram_required_mb": 1536,
            "quality": "excellent",
            "speed": "fast",
            "quality_score": 85,
            "speed_score": 70,
            "url": "https://huggingface.co/ssswww/hyper_iqa/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_type": "score_1_5",
            "tags": ["adaptive", "no_reference", "fast"]
        },
        "musiq": {
            "display_name": "MUSIQ",
            "description": "Multi-scale Image Quality (handles any resolution natively)",
            "file": "musiq.onnx",
            "size_mb": 280,
            "vram_required_mb": 3072,
            "quality": "excellent",
            "speed": "medium",
            "quality_score": 88,
            "speed_score": 45,
            "url": "https://huggingface.co/google/musiq-koniq/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [None, None],
            "output_type": "score_1_100",
            "tags": ["multi_scale", "any_resolution", "google"]
        },
        "q_align": {
            "display_name": "Q-Align",
            "description": "LLM-based quality alignment (highest accuracy, slowest)",
            "file": "q_align.onnx",
            "size_mb": 4200,
            "vram_required_mb": 16384,
            "quality": "best",
            "speed": "slow",
            "quality_score": 98,
            "speed_score": 15,
            "url": "https://huggingface.co/Q-Future/Q-Align/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [336, 336],
            "output_type": "score_1_10",
            "tags": ["llm", "highest_quality", "experimental"]
        }
    },
    "embedding": {
        "dinov2_small": {
            "display_name": "DINOv2 Small",
            "description": "Compact semantic embeddings (768-dim, 22M params)",
            "file": "dinov2_small.onnx",
            "size_mb": 86,
            "vram_required_mb": 1024,
            "quality": "good",
            "speed": "fast",
            "quality_score": 60,
            "speed_score": 90,
            "url": "https://huggingface.co/facebook/dinov2-small/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_dim": 384,
            "tags": ["compact", "fast", "default"]
        },
        "dinov2_base": {
            "display_name": "DINOv2 Base",
            "description": "Balanced semantic embeddings (768-dim, 86M params)",
            "file": "dinov2_base.onnx",
            "size_mb": 330,
            "vram_required_mb": 2048,
            "quality": "good",
            "speed": "medium",
            "quality_score": 75,
            "speed_score": 65,
            "url": "https://huggingface.co/facebook/dinov2-base/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_dim": 768,
            "tags": ["balanced", "standard"]
        },
        "dinov2_large": {
            "display_name": "DINOv2 Large",
            "description": "High-quality semantic embeddings (1024-dim, 300M params)",
            "file": "dinov2_large.onnx",
            "size_mb": 1150,
            "vram_required_mb": 4096,
            "quality": "excellent",
            "speed": "slow",
            "quality_score": 90,
            "speed_score": 35,
            "url": "https://huggingface.co/facebook/dinov2-large/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_dim": 1024,
            "tags": ["high_quality", "recommended"]
        },
        "dinov2_giant": {
            "display_name": "DINOv2 Giant",
            "description": "Best semantic embeddings (1536-dim, 1.1B params)",
            "file": "dinov2_giant.onnx",
            "size_mb": 4300,
            "vram_required_mb": 16384,
            "quality": "best",
            "speed": "very_slow",
            "quality_score": 98,
            "speed_score": 10,
            "url": "https://huggingface.co/facebook/dinov2-giant/resolve/main/model.onnx",
            "checksum": None,
            "input_size": [224, 224],
            "output_dim": 1536,
            "tags": ["best_quality", "experimental"]
        }
    },
    "face_detection": {
        "opencv": {
            "display_name": "OpenCV Haar Cascades",
            "description": "Basic face detection (CPU, no GPU needed)",
            "file": None,
            "size_mb": 0,
            "vram_required_mb": 0,
            "quality": "basic",
            "speed": "fast",
            "quality_score": 30,
            "speed_score": 95,
            "url": None,
            "checksum": None,
            "tags": ["cpu", "fallback", "built_in"]
        },
        "mediapipe": {
            "display_name": "MediaPipe Face Mesh",
            "description": "468-point face mesh with landmarks (GPU accelerated)",
            "file": None,
            "size_mb": 0,
            "vram_required_mb": 512,
            "quality": "good",
            "speed": "fast",
            "quality_score": 70,
            "speed_score": 85,
            "url": None,
            "checksum": None,
            "tags": ["landmarks", "default", "balanced"]
        },
        "yolov8n": {
            "display_name": "YOLOv8 Nano",
            "description": "Ultra-fast person/face detection (3.2M params)",
            "file": "yolov8n.pt",
            "size_mb": 6,
            "vram_required_mb": 512,
            "quality": "good",
            "speed": "fast",
            "quality_score": 65,
            "speed_score": 95,
            "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt",
            "checksum": None,
            "tags": ["ultra_fast", "lightweight"]
        },
        "yolov8s": {
            "display_name": "YOLOv8 Small",
            "description": "Fast person/face detection (11.2M params)",
            "file": "yolov8s.pt",
            "size_mb": 22,
            "vram_required_mb": 1024,
            "quality": "excellent",
            "speed": "fast",
            "quality_score": 80,
            "speed_score": 80,
            "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8s.pt",
            "checksum": None,
            "tags": ["fast", "balanced"]
        },
        "yolov8m": {
            "display_name": "YOLOv8 Medium",
            "description": "Accurate person/face detection (25.9M params)",
            "file": "yolov8m.pt",
            "size_mb": 52,
            "vram_required_mb": 2048,
            "quality": "excellent",
            "speed": "medium",
            "quality_score": 88,
            "speed_score": 55,
            "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8m.pt",
            "checksum": None,
            "tags": ["accurate", "recommended"]
        },
        "yolov8l": {
            "display_name": "YOLOv8 Large",
            "description": "Highest accuracy person/face detection (43.7M params)",
            "file": "yolov8l.pt",
            "size_mb": 87,
            "vram_required_mb": 4096,
            "quality": "best",
            "speed": "slow",
            "quality_score": 95,
            "speed_score": 30,
            "url": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8l.pt",
            "checksum": None,
            "tags": ["highest_accuracy", "slow"]
        }
    }
}


# ==========================================
# Fallback Chains (ordered: best → lightest)
# ==========================================
FALLBACK_CHAINS: Dict[str, List[str]] = {
    "aesthetic": [
        "q_align",
        "musiq",
        "laion_aesthetic_v2",
        "hyper_iqa",
        "clip_aesthetic",
        "nima",
        "nima_mobile"
    ],
    "embedding": [
        "dinov2_giant",
        "dinov2_large",
        "dinov2_base",
        "dinov2_small"
    ],
    "face_detection": [
        "yolov8l",
        "yolov8m",
        "yolov8s",
        "yolov8n",
        "mediapipe",
        "opencv"
    ]
}


# ==========================================
# Default models per tier
# ==========================================
DEFAULT_MODELS: Dict[str, Dict[str, str]] = {
    "low": {
        "aesthetic": "nima_mobile",
        "embedding": "dinov2_small",
        "face_detection": "opencv"
    },
    "medium": {
        "aesthetic": "nima",
        "embedding": "dinov2_small",
        "face_detection": "mediapipe"
    },
    "high": {
        "aesthetic": "laion_aesthetic_v2",
        "embedding": "dinov2_base",
        "face_detection": "yolov8s"
    },
    "ultra": {
        "aesthetic": "laion_aesthetic_v2",
        "embedding": "dinov2_large",
        "face_detection": "yolov8m"
    }
}


# ==========================================
# Compatibility Checking
# ==========================================
def check_compatibility(model_id: str, task: str, gpu_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if a model is compatible with the detected GPU.

    Args:
        model_id: Model identifier
        task: Task category (aesthetic, embedding, face_detection)
        gpu_info: GPU info dict from GPUDetector

    Returns:
        Dict with compatible, status, message
    """
    if task not in MODEL_REGISTRY:
        return {
            "compatible": False,
            "status": "error",
            "message": f"Unknown task: {task}"
        }

    if model_id not in MODEL_REGISTRY[task]:
        return {
            "compatible": False,
            "status": "error",
            "message": f"Unknown model: {model_id}"
        }

    model = MODEL_REGISTRY[task][model_id]
    vram_mb = gpu_info.get("vram_mb", 0)
    vram_required = model.get("vram_required_mb", 0)

    # Built-in models (no VRAM requirement)
    if vram_required == 0:
        return {
            "compatible": True,
            "status": "ok",
            "message": "Built-in model, no GPU required"
        }

    # No GPU detected
    if vram_mb == 0:
        if vram_required > 0:
            return {
                "compatible": False,
                "status": "insufficient",
                "message": f"No GPU detected. This model requires {vram_required}MB VRAM."
            }
        return {
            "compatible": True,
            "status": "ok",
            "message": "CPU-only model"
        }

    # Check VRAM
    if vram_mb < vram_required:
        return {
            "compatible": False,
            "status": "insufficient",
            "message": f"Insufficient VRAM. You have {vram_mb}MB, model needs {vram_required}MB."
        }

    # Check if VRAM is tight (less than 2x required)
    if vram_mb < vram_required * 2:
        return {
            "compatible": True,
            "status": "slow",
            "message": f"Compatible but VRAM is tight ({vram_mb}MB available, {vram_required}MB needed). May be slower."
        }

    return {
        "compatible": True,
        "status": "ok",
        "message": f"Fully compatible. {vram_mb}MB VRAM available, {vram_required}MB needed."
    }


def get_fallback_chain(task: str, current_model: str) -> List[str]:
    """
    Get ordered fallback chain for a model (lighter alternatives).

    Args:
        task: Task category
        current_model: Current model ID

    Returns:
        List of model IDs in fallback order (excluding current)
    """
    if task not in FALLBACK_CHAINS:
        return []

    chain = FALLBACK_CHAINS[task]
    try:
        idx = chain.index(current_model)
        return chain[idx + 1:]
    except ValueError:
        return chain[1:]


def get_all_models_with_status(gpu_info: Dict[str, Any], downloaded_models: List[str]) -> List[Dict[str, Any]]:
    """
    Get all models with compatibility and download status.

    Args:
        gpu_info: GPU info from GPUDetector
        downloaded_models: List of downloaded model IDs

    Returns:
        List of model info dicts
    """
    models = []

    for task, variants in MODEL_REGISTRY.items():
        for model_id, info in variants.items():
            compat = check_compatibility(model_id, task, gpu_info)
            is_downloaded = model_id in downloaded_models

            models.append({
                "task": task,
                "id": model_id,
                "name": info["display_name"],
                "description": info["description"],
                "size_mb": info["size_mb"],
                "vram_required_mb": info["vram_required_mb"],
                "quality": info["quality"],
                "speed": info["speed"],
                "quality_score": info["quality_score"],
                "speed_score": info["speed_score"],
                "downloaded": is_downloaded,
                "compatible": compat["compatible"],
                "status": compat["status"],
                "message": compat["message"],
                "tags": info.get("tags", []),
                "has_file": info.get("file") is not None
            })

    return models


def get_default_for_tier(tier: str) -> Dict[str, str]:
    """Get default model selection for a GPU tier."""
    return DEFAULT_MODELS.get(tier, DEFAULT_MODELS["low"])


def get_model_info(task: str, model_id: str) -> Optional[Dict[str, Any]]:
    """Get info for a specific model."""
    if task in MODEL_REGISTRY and model_id in MODEL_REGISTRY[task]:
        return MODEL_REGISTRY[task][model_id]
    return None
