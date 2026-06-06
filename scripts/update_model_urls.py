#!/usr/bin/env python3
"""
Model URL Validator for CineCull
Validates model download URLs and creates a cache of working URLs.
This script is run automatically on startup to ensure all model URLs are valid.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'model_urls_cache.json')
CACHE_VALIDITY_HOURS = 24  # Cache is valid for 24 hours


def check_url(url: str, timeout: int = 5) -> Tuple[bool, Optional[str]]:
    """Check if a URL is accessible."""
    if not url:
        return False, "No URL"
    
    try:
        req = urllib.request.Request(url, method='HEAD', headers={
            'User-Agent': 'CineCull/1.0'
        })
        response = urllib.request.urlopen(req, timeout=timeout)
        return True, None
    except Exception as e:
        return False, str(e)


def get_known_good_urls() -> Dict[str, str]:
    """
    Returns a dictionary of known good URLs for models.
    These are verified working URLs as of the last update.
    """
    return {
        # DINOv2 models from onnx-community
        "dinov2_small": "https://huggingface.co/onnx-community/dinov2-small/resolve/main/onnx/model.onnx",
        "dinov2_base": "https://huggingface.co/onnx-community/dinov2-base/resolve/main/onnx/model.onnx",
        "dinov2_large": "https://huggingface.co/onnx-community/dinov2-large/resolve/main/onnx/model.onnx",
        "dinov2_giant": "https://huggingface.co/onnx-community/dinov2-with-registers-giant/resolve/main/onnx/model.onnx",
        
        # CLIP models from onnx-community (for aesthetic scoring)
        "clip_vit_base": "https://huggingface.co/onnx-community/clip-vit-base-patch32-ONNX/resolve/main/onnx/model.onnx",
        "clip_vit_large": "https://huggingface.co/onnx-community/clip-vit-large-patch14-ONNX/resolve/main/onnx/model.onnx",
        
        # Image quality assessment models
        "swin_iqa": "https://huggingface.co/onnx-community/swin-tiny-patch4-window7-224-finetuned-image_quality-ONNX/resolve/main/onnx/model.onnx",
        
        # YOLOv8 models (these are known to work)
        "yolov8n": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt",
        "yolov8s": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8s.pt",
        "yolov8m": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8m.pt",
        "yolov8l": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8l.pt",
        
        # Models that don't have ONNX versions yet
        "nima_mobile": None,
        "nima": None,
        "laion_aesthetic_v2": None,
        "hyper_iqa": None,
        "musiq": None,
        "q_align": None,
    }


def load_cache() -> Dict[str, Any]:
    """Load URL cache from file."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load URL cache: {e}")
    return {}


def save_cache(cache: Dict[str, Any]):
    """Save URL cache to file."""
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"[WARN] Failed to save URL cache: {e}")


def is_cache_valid(cache: Dict[str, Any]) -> bool:
    """Check if cache is still valid."""
    if not cache or 'timestamp' not in cache:
        return False
    
    try:
        cache_time = datetime.fromisoformat(cache['timestamp'])
        return datetime.now() - cache_time < timedelta(hours=CACHE_VALIDITY_HOURS)
    except:
        return False


def validate_urls() -> Dict[str, Optional[str]]:
    """
    Validate all model URLs and return a mapping of model_id -> working_url.
    """
    from model_registry import MODEL_REGISTRY
    
    print("[INFO] Validating model download URLs...")
    
    known_urls = get_known_good_urls()
    validated_urls = {}
    
    for task, models in MODEL_REGISTRY.items():
        for model_id, model_info in models.items():
            # Skip built-in models
            if not model_info.get('file'):
                validated_urls[model_id] = None
                continue
            
            # Check if we have a known good URL
            if model_id in known_urls:
                url = known_urls[model_id]
                if url is None:
                    print(f"  [{model_id}] No ONNX version available")
                    validated_urls[model_id] = None
                    continue
                
                # Validate the known URL
                is_valid, error = check_url(url)
                if is_valid:
                    print(f"  [{model_id}] [OK] Valid")
                    validated_urls[model_id] = url
                else:
                    print(f"  [{model_id}] [FAIL] Known URL invalid: {error}")
                    # Try the URL from registry
                    registry_url = model_info.get('url')
                    if registry_url and registry_url != url:
                        is_valid, error = check_url(registry_url)
                        if is_valid:
                            print(f"  [{model_id}] [OK] Registry URL valid")
                            validated_urls[model_id] = registry_url
                        else:
                            print(f"  [{model_id}] [FAIL] Both URLs invalid")
                            validated_urls[model_id] = None
                    else:
                        validated_urls[model_id] = None
            else:
                # Validate URL from registry
                url = model_info.get('url')
                if url:
                    is_valid, error = check_url(url)
                    if is_valid:
                        print(f"  [{model_id}] [OK] Valid")
                        validated_urls[model_id] = url
                    else:
                        print(f"  [{model_id}] [FAIL] Invalid: {error}")
                        validated_urls[model_id] = None
                else:
                    validated_urls[model_id] = None
    
    return validated_urls


def update_model_registry_urls(validated_urls: Dict[str, Optional[str]]):
    """
    Update model_registry.py with validated URLs.
    """
    from model_registry import MODEL_REGISTRY
    
    registry_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'model_registry.py')
    
    # Read the file
    with open(registry_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update URLs
    updated_count = 0
    for model_id, url in validated_urls.items():
        if url is None:
            continue
        
        # Find the model in registry
        for task, models in MODEL_REGISTRY.items():
            if model_id in models:
                old_url = models[model_id].get('url')
                if old_url != url:
                    # Replace the URL in the file content
                    if old_url:
                        content = content.replace(f'"{old_url}"', f'"{url}"')
                        updated_count += 1
                        print(f"  Updated {model_id} URL")
                break
    
    if updated_count > 0:
        # Write back
        with open(registry_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[INFO] Updated {updated_count} model URLs in model_registry.py")
    else:
        print("[INFO] All model URLs are up to date")


def main():
    """Main entry point."""
    print("=" * 60)
    print("CineCull Model URL Validator")
    print("=" * 60)
    print()
    
    # Load cache
    cache = load_cache()
    
    # Check if cache is valid
    if is_cache_valid(cache):
        print("[INFO] URL cache is valid, skipping validation")
        print(f"[INFO] Cache age: {datetime.now() - datetime.fromisoformat(cache['timestamp'])}")
        return 0
    
    print("[INFO] URL cache is outdated or missing, running validation...")
    print()
    
    # Validate URLs
    validated_urls = validate_urls()
    
    # Update cache
    cache = {
        'timestamp': datetime.now().isoformat(),
        'urls': validated_urls
    }
    save_cache(cache)
    
    print()
    print("[INFO] URL validation complete")
    print(f"[INFO] Cache saved to {CACHE_FILE}")
    
    # Update model_registry.py with working URLs
    print()
    update_model_registry_urls(validated_urls)
    
    print()
    print("=" * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())