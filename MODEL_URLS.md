# CineCull Model URL Management System

## Overview

This document describes the model URL validation and management system implemented for CineCull.

## Problem Solved

Many AI models in the original registry had broken or non-existent download URLs:
- Most aesthetic models (NIMA, LAION, HyperIQA, MUSIQ, Q-Align) don't have official ONNX versions
- DINOv2 models were pointing to non-existent URLs on facebook/ repos
- Only YOLOv8 models had working URLs

## Solution

### 1. URL Validation Script (`scripts/update_model_urls.py`)

Automatically validates all model URLs on startup (cached for 24 hours):
- Checks if URLs are accessible
- Maintains a cache of validated URLs in `model_urls_cache.json`
- Updates `model_registry.py` with working URLs
- Runs automatically when `start.bat` is executed

### 2. Updated Model Registry

**Working Models (Downloadable):**

**Embedding Models (Duplicate Detection):**
- ✅ `dinov2_small` - 88MB, from onnx-community
- ✅ `dinov2_base` - 330MB, from onnx-community
- ✅ `dinov2_large` - 1.15GB, from onnx-community
- ✅ `dinov2_giant` - 4.3GB, from onnx-community (with registers)

**Aesthetic/Quality Models:**
- ✅ `clip_vit_base` - 350MB, CLIP ViT-B/32 from onnx-community
- ✅ `clip_aesthetic` - 1.7GB, CLIP ViT-L/14 from onnx-community
- ✅ `swin_iqa` - 110MB, Swin Transformer IQA from onnx-community

**Face Detection Models:**
- ✅ `yolov8n` - 6MB, from ultralytics
- ✅ `yolov8s` - 22MB, from ultralytics
- ✅ `yolov8m` - 52MB, from ultralytics
- ✅ `yolov8l` - 87MB, from ultralytics

**Models Requiring Manual ONNX Conversion:**
- ⚠️ `nima_mobile` - No ONNX version available
- ⚠️ `nima` - No ONNX version available
- ⚠️ `laion_aesthetic_v2` - No ONNX version available
- ⚠️ `hyper_iqa` - No ONNX version available
- ⚠️ `musiq` - No ONNX version available
- ⚠️ `q_align` - No ONNX version available

### 3. Frontend Updates

The Settings Modal now shows:
- **"Requires Conversion"** badge for models without ONNX versions
- Clear warning message explaining manual conversion is needed
- Disabled download button for models requiring conversion
- Real-time download progress with speed and ETA

### 4. Backend Updates

- `model_downloader.py` now properly handles models with `url: None`
- Returns `False` for models requiring conversion instead of treating them as built-in
- Clear error messages in logs

## How It Works

### On Startup (`start.bat`)

1. Python dependencies are installed
2. **URL validation script runs** (if cache is older than 24 hours)
   - Validates all model URLs
   - Updates cache file
   - Updates `model_registry.py` if needed
3. Frontend is built
4. Server starts

### URL Validation Flow

```
start.bat
  ↓
update_model_urls.py
  ↓
Check cache age (< 24 hours?)
  ↓ Yes: Skip validation
  ↓ No: Validate all URLs
  ↓
Save to model_urls_cache.json
  ↓
Update model_registry.py (if needed)
```

### Model Download Flow

```
User clicks "Download"
  ↓
Frontend calls /api/models/download
  ↓
Backend checks if model has URL
  ↓ Yes: Start download with progress tracking
  ↓ No: Return error (requires conversion)
  ↓
Frontend polls /api/models/download/progress
  ↓
Shows real-time progress (MB downloaded, speed, ETA)
  ↓
Download complete → User can select model
```

## Cache File Format

`model_urls_cache.json`:
```json
{
  "timestamp": "2026-01-14T10:30:00.000000",
  "urls": {
    "dinov2_small": "https://huggingface.co/onnx-community/dinov2-small/resolve/main/onnx/model.onnx",
    "dinov2_base": "https://huggingface.co/onnx-community/dinov2-base/resolve/main/onnx/model.onnx",
    "dinov2_large": "https://huggingface.co/onnx-community/dinov2-large/resolve/main/onnx/model.onnx",
    "dinov2_giant": "https://huggingface.co/onnx-community/dinov2-with-registers-giant/resolve/main/onnx/model.onnx",
    "clip_vit_base": "https://huggingface.co/onnx-community/clip-vit-base-patch32-ONNX/resolve/main/onnx/model.onnx",
    "clip_aesthetic": "https://huggingface.co/onnx-community/clip-vit-large-patch14-ONNX/resolve/main/onnx/model.onnx",
    "swin_iqa": "https://huggingface.co/onnx-community/swin-tiny-patch4-window7-224-finetuned-image_quality-ONNX/resolve/main/onnx/model.onnx",
    "yolov8n": "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt",
    ...
  }
}
```

## Adding New Models

To add a new model:

1. Add entry to `MODEL_REGISTRY` in `model_registry.py`:
   ```python
   "model_id": {
       "display_name": "Model Name",
       "description": "Description",
       "file": "model.onnx",
       "size_mb": 100,
       "vram_required_mb": 1024,
       "quality": "excellent",
       "speed": "fast",
       "quality_score": 80,
       "speed_score": 80,
       "url": "https://...",  # or None if requires conversion
       "checksum": None,
       "input_size": [224, 224],
       "output_type": "score_1_10",
       "tags": ["tag1", "tag2"]
   }
   ```

2. If model requires ONNX conversion, add `"requires_conversion"` to tags and set `url: None`

3. If model has a direct ONNX download URL, add it to `get_known_good_urls()` in `update_model_urls.py`

4. Restart the app - the validation script will verify the URL

## Manual ONNX Conversion

For models marked as "Requires Conversion", you can manually convert them:

1. Download the PyTorch model
2. Convert to ONNX using PyTorch's `torch.onnx.export()`
3. Place the `.onnx` file in the `models/` directory
4. The model will be detected as "downloaded" and can be selected

Example conversion script:
```python
import torch
import torchvision.models as models

# Load PyTorch model
model = models.mobilenet_v2(pretrained=True)
model.eval()

# Convert to ONNX
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    "models/nima_mobile.onnx",
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
)
```

## Future Improvements

1. **Automatic ONNX Conversion**: Add a script to automatically convert PyTorch models to ONNX
2. **Model Quantization**: Support INT8/FP16 quantized models for faster inference
3. **Model Benchmarking**: Add performance benchmarks for each model
4. **Alternative Sources**: Find or create ONNX versions of popular aesthetic models
5. **Model Compression**: Add support for compressed/pruned models

## Troubleshooting

### "Model requires manual ONNX conversion"

This means the model doesn't have an official ONNX version. You need to:
1. Convert it manually from PyTorch (see above)
2. Or wait for the community to provide an ONNX version
3. Or use an alternative model that has ONNX support

### URL validation fails

If a URL is marked as invalid:
1. Check your internet connection
2. The model may have been moved or deleted
3. Run `python scripts/update_model_urls.py` manually to re-validate
4. Check `model_urls_cache.json` for details

### Download fails

If a download fails:
1. Check the error message in the UI
2. Verify the URL is accessible in a browser
3. Check firewall/antivirus settings
4. Try downloading manually and placing in `models/` directory

## Files Modified

- `model_registry.py` - Updated with correct URLs and conversion flags
- `model_downloader.py` - Handle models without URLs
- `scripts/update_model_urls.py` - New URL validation script
- `start.bat` - Added URL validation step
- `frontend/src/components/controls/SettingsModal.tsx` - Added conversion badge and warnings

## Files Created

- `scripts/update_model_urls.py` - URL validation and update script
- `model_urls_cache.json` - Cache of validated URLs (auto-generated)
