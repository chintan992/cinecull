import type { Photo } from '../types/photo';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-keep-400';
  if (score >= 45) return 'text-review-400';
  return 'text-reject-400';
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-keep-500';
  if (score >= 45) return 'bg-review-500';
  return 'bg-reject-500';
}

export function getRecommendationColor(rec: string): string {
  switch (rec) {
    case 'Keep': return 'text-keep-400';
    case 'Review': return 'text-review-400';
    case 'Reject': return 'text-reject-400';
    default: return 'text-chrome-400';
  }
}

export function getRecommendationBorder(rec: string): string {
  switch (rec) {
    case 'Keep': return 'border-keep-500/30';
    case 'Review': return 'border-review-500/30';
    case 'Reject': return 'border-reject-500/30';
    default: return 'border-chrome-700';
  }
}

export function groupByCluster(photos: Photo[]): Map<number | string, Photo[]> {
  const clusters = new Map<number | string, Photo[]>();
  for (const photo of photos) {
    const key = photo.cluster_id !== null ? photo.cluster_id : 'unassigned';
    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(photo);
  }
  return clusters;
}
