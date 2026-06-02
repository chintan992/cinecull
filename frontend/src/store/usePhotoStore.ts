import { create } from 'zustand';
import type { Photo, Recommendation, FilterType } from '../types/photo';

interface PhotoState {
  photos: Photo[];
  selectedFilepath: string | null;
  compareFilepaths: Set<string>;
  filter: FilterType;
  sortBy: 'score-desc' | 'score-asc' | 'filename';

  setPhotos: (photos: Photo[]) => void;
  updatePhoto: (photo: Photo) => void;
  updateRecommendation: (filepath: string, recommendation: Recommendation) => void;
  selectPhoto: (filepath: string | null) => void;
  toggleCompare: (filepath: string) => void;
  clearCompare: () => void;
  setFilter: (filter: FilterType) => void;
  setSortBy: (sortBy: 'score-desc' | 'score-asc' | 'filename') => void;
}

export const usePhotoStore = create<PhotoState>((set) => ({
  photos: [],
  selectedFilepath: null,
  compareFilepaths: new Set(),
  filter: 'ALL',
  sortBy: 'score-desc',

  setPhotos: (photos) => set({ photos }),

  updatePhoto: (photo) =>
    set((state) => {
      const idx = state.photos.findIndex((p) => p.filepath === photo.filepath);
      if (idx >= 0) {
        const newPhotos = [...state.photos];
        newPhotos[idx] = photo;
        return { photos: newPhotos };
      }
      return { photos: [...state.photos, photo] };
    }),

  updateRecommendation: (filepath, recommendation) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.filepath === filepath ? { ...p, recommendation } : p
      ),
    })),

  selectPhoto: (filepath) => set({ selectedFilepath: filepath }),

  toggleCompare: (filepath) =>
    set((state) => {
      const newSet = new Set(state.compareFilepaths);
      if (newSet.has(filepath)) {
        newSet.delete(filepath);
      } else if (newSet.size < 4) {
        newSet.add(filepath);
      }
      return { compareFilepaths: newSet };
    }),

  clearCompare: () => set({ compareFilepaths: new Set() }),

  setFilter: (filter) => set({ filter }),

  setSortBy: (sortBy) => set({ sortBy }),
}));

export const selectFilteredPhotos = (state: PhotoState): Photo[] => {
  const { photos, filter, sortBy } = state;
  let filtered = filter === 'ALL' ? photos : photos.filter((p) => p.recommendation === filter);

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'score-desc') return b.overall_score - a.overall_score;
    if (sortBy === 'score-asc') return a.overall_score - b.overall_score;
    return a.filename.localeCompare(b.filename);
  });

  return filtered;
};

export const selectSelectedPhoto = (state: PhotoState): Photo | undefined => {
  return state.photos.find((p) => p.filepath === state.selectedFilepath);
};

export const selectCounts = (state: PhotoState) => ({
  all: state.photos.length,
  keep: state.photos.filter((p) => p.recommendation === 'Keep').length,
  review: state.photos.filter((p) => p.recommendation === 'Review').length,
  reject: state.photos.filter((p) => p.recommendation === 'Reject').length,
});
