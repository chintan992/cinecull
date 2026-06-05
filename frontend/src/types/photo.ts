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
