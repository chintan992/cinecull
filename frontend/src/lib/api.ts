import type { Photo, Recommendation, CullingMode } from '../types/photo';

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
