import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectFilteredPhotos } from '../store/usePhotoStore';
import { useUIStore } from '../store/useUIStore';
import { api } from '../lib/api';

export function useKeyboardShortcuts() {
  const selectPhoto = usePhotoStore((s) => s.selectPhoto);
  const selectedFilepath = usePhotoStore((s) => s.selectedFilepath);
  const filteredPhotos = usePhotoStore(useShallow(selectFilteredPhotos));
  const updateRecommendation = usePhotoStore((s) => s.updateRecommendation);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        toggleLeftPanel();
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        toggleRightPanel();
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        setViewMode('grid');
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        setViewMode('loupe');
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        setViewMode('compare');
        return;
      }

      const visible = filteredPhotos;
      if (visible.length === 0) return;

      const currentIndex = visible.findIndex((p) => p.filepath === selectedFilepath);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < visible.length - 1) {
          selectPhoto(visible[currentIndex + 1].filepath);
        } else if (currentIndex === -1 && visible.length > 0) {
          selectPhoto(visible[0].filepath);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          selectPhoto(visible[currentIndex - 1].filepath);
        } else if (currentIndex === -1 && visible.length > 0) {
          selectPhoto(visible[0].filepath);
        }
        return;
      }

      if (selectedFilepath) {
        if (e.key === 'k' || e.key === '1') {
          updateRecommendation(selectedFilepath, 'Keep');
          api.setRecommendation(selectedFilepath, 'Keep');
          addToast({ message: 'Marked as Keep', type: 'success' });
        } else if (e.key === 'u' || e.key === '2') {
          updateRecommendation(selectedFilepath, 'Review');
          api.setRecommendation(selectedFilepath, 'Review');
          addToast({ message: 'Marked as Review', type: 'info' });
        } else if (e.key === 'x' || e.key === '3') {
          updateRecommendation(selectedFilepath, 'Reject');
          api.setRecommendation(selectedFilepath, 'Reject');
          addToast({ message: 'Marked as Reject', type: 'warning' });
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFilepath, filteredPhotos]);
}
