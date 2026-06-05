import type { Photo, Recommendation, CullingMode, HardwareInfo, ModelInfo, ActiveModels } from '../types/photo';

const BASE_URL = '';

export const api = {
  async getPhotos(): Promise<Photo[]> {
    const res = await fetch(`${BASE_URL}/api/photos`);
    return res.json();
  },

  async getConfig(): Promise<{ watch_dir: string; culling_mode: CullingMode; analysis_paused?: boolean; analysis_queue_len?: number }> {
    const res = await fetch(`${BASE_URL}/api/config`);
    return res.json();
  },

  async setWatchDir(watch_dir: string) {
    const res = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watch_dir }),
    });
    return res.json();
  },

  async setCullingMode(mode: CullingMode) {
    const res = await fetch(`${BASE_URL}/api/config/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return res.json();
  },

  async getEngine(): Promise<{ engine: string; has_yolo: boolean }> {
    const res = await fetch(`${BASE_URL}/api/engine`);
    return res.json();
  },

  async setEngine(engine: string) {
    const res = await fetch(`${BASE_URL}/api/engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine }),
    });
    return res.json();
  },

  async getHardware(): Promise<HardwareInfo> {
    const res = await fetch(`${BASE_URL}/api/hardware`);
    return res.json();
  },

  async getModels(): Promise<{ models: ModelInfo[]; total_downloaded_mb: number }> {
    const res = await fetch(`${BASE_URL}/api/models`);
    return res.json();
  },

  async getActiveModels(): Promise<{ active_models: ActiveModels }> {
    const res = await fetch(`${BASE_URL}/api/models/active`);
    return res.json();
  },

  async selectModel(task: string, model_id: string): Promise<{ status: string; warning?: string }> {
    const res = await fetch(`${BASE_URL}/api/models/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, model_id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to select model');
    }
    return res.json();
  },

  async downloadModel(model_id: string): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/api/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to download model');
    }
    return res.json();
  },

  async getDownloadProgress(): Promise<{ downloads: any[] }> {
    const res = await fetch(`${BASE_URL}/api/models/download/progress`);
    return res.json();
  },

  async predownloadModels(): Promise<{ status: string; tier: string; threads: number }> {
    const res = await fetch(`${BASE_URL}/api/models/predownload`, { method: 'POST' });
    return res.json();
  },

  async deleteModel(model_id: string): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/api/models/${model_id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to delete model');
    }
    return res.json();
  },

  async scanDirectory() {
    const res = await fetch(`${BASE_URL}/api/photos/scan`, { method: 'POST' });
    return res.json();
  },

  async applyBudget(target_budget: number) {
    const res = await fetch(`${BASE_URL}/api/photos/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_budget }),
    });
    return res.json();
  },

  async setRecommendation(filepath: string, recommendation: Recommendation) {
    const res = await fetch(`${BASE_URL}/api/photo/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath, recommendation }),
    });
    return res.json();
  },

  async organizePhotos(selections: Record<string, Recommendation>) {
    const res = await fetch(`${BASE_URL}/api/photos/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selections),
    });
    return res.json();
  },

  async redoCulling() {
    const res = await fetch(`${BASE_URL}/api/photos/redo`, { method: 'POST' });
    return res.json();
  },

  async pauseAnalysis() {
    const res = await fetch(`${BASE_URL}/api/analysis/pause`, { method: 'POST' });
    return res.json();
  },

  async resumeAnalysis() {
    const res = await fetch(`${BASE_URL}/api/analysis/resume`, { method: 'POST' });
    return res.json();
  },

  getPreviewUrl(filepath: string): string {
    return `${BASE_URL}/api/photo/preview?filepath=${encodeURIComponent(filepath)}`;
  },

  getExportUrl(): string {
    return `${BASE_URL}/api/photos/export`;
  },

  async importSession(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/photos/import`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },
};
