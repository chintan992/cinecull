export interface FaceData {
  face_index: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  ear: number;
  ear_smoothed?: number;
  eye_score: number;
  eyes_closed: boolean;
  smile_score: number;
  pose: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  pose_score: number;
}

export interface FocusData {
  laplacian_variance: number;
  normalized_variance: number;
  sharpness_score: number;
  face_focus_score?: number;
}

export interface ExposureData {
  mean_brightness: number;
  shadow_percent: number;
  highlight_percent: number;
  exposure_score: number;
}

export interface AestheticsData {
  clip_score: number;
  nima_mean: number;
  nima_variance: number;
  nima_distribution: number[];
}

export interface ExifMetadata {
  datetime_original: string | null;
  iso: string | null;
  aperture: string | null;
  focal_length: string | null;
  lens: string | null;
  camera_make: string | null;
  camera_model: string | null;
  focus_point: string | null;
}

export type Recommendation = 'Keep' | 'Review' | 'Reject';
export type CullingMode = 'portrait' | 'landscape' | 'action_sport';
export type ViewMode = 'grid' | 'loupe' | 'compare';
export type FilterType = 'ALL' | Recommendation;

export interface HardwareInfo {
  gpu_name: string;
  vram_mb: number;
  vram_gb: number;
  tier: 'low' | 'medium' | 'high' | 'ultra';
  cuda_compute: string;
  driver: string;
  device_count: number;
  detection_method: string;
  recommendations: Record<string, string[]>;
  utilization?: {
    gpu_utilization: number;
    memory_utilization: number;
    temperature_c: number;
    vram_used_mb: number;
    vram_free_mb: number;
  };
}

export type ModelTask = 'aesthetic' | 'embedding' | 'face_detection';
export type ModelQuality = 'basic' | 'good' | 'excellent' | 'best';
export type ModelSpeed = 'fast' | 'medium' | 'slow' | 'very_slow';
export type ModelStatus = 'ok' | 'slow' | 'insufficient' | 'error';

export interface ModelInfo {
  task: ModelTask;
  id: string;
  name: string;
  description: string;
  size_mb: number;
  vram_required_mb: number;
  quality: ModelQuality;
  speed: ModelSpeed;
  quality_score: number;
  speed_score: number;
  downloaded: boolean;
  compatible: boolean;
  status: ModelStatus;
  message: string;
  tags: string[];
  has_file: boolean;
}

export interface ActiveModels {
  aesthetic: string;
  embedding: string;
  face_detection: string;
}

export interface DownloadProgress {
  model_id: string;
  total_bytes: number;
  downloaded_bytes: number;
  progress_pct: number;
  status: string;
  error_message: string;
  speed_mbps: number;
}

export interface Photo {
  filename: string;
  filepath: string;
  overall_score: number;
  recommendation: Recommendation;
  focus: FocusData;
  exposure: ExposureData;
  faces_detected: number;
  faces: FaceData[];
  any_eyes_closed: boolean;
  aesthetics: AestheticsData;
  metadata: ExifMetadata;
  dhash: number;
  embedding: number[];
  cluster_id: number | null;
  models_used?: ActiveModels;
}

export interface WSMessage {
  type: 'INIT' | 'PHOTO_DETECTED' | 'PHOTO_ANALYZED' | 'LIST_UPDATED' | 'RECOMMENDATION_UPDATED' | 'QUEUE_STATUS';
  data?: Photo;
  photos?: Photo[];
  watch_dir?: string;
  culling_mode?: CullingMode;
  filename?: string;
  filepath?: string;
  recommendation?: Recommendation;
  analysis_paused?: boolean;
  analysis_queue_len?: number;
  paused?: boolean;
  queue_len?: number;
}
