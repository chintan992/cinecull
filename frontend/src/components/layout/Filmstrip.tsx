import { useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectFilteredPhotos } from '../../store/usePhotoStore';
import { api } from '../../lib/api';
import { cn, getScoreBgColor, getRecommendationBorder } from '../../lib/utils';

export function Filmstrip() {
  const photos = usePhotoStore(useShallow(selectFilteredPhotos));
  const selectedFilepath = usePhotoStore((s) => s.selectedFilepath);
  const selectPhoto = usePhotoStore((s) => s.selectPhoto);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedFilepath || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-filepath="${CSS.escape(selectedFilepath)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedFilepath]);

  if (photos.length === 0) {
    return (
      <div className="h-24 bg-chrome-900 border-t border-chrome-800/50 flex items-center justify-center shrink-0">
        <span className="text-xs text-chrome-500 font-mono">No photos in current view</span>
      </div>
    );
  }

  return (
    <div className="h-24 bg-chrome-900 border-t border-chrome-800/50 shrink-0">
      <div
        ref={scrollRef}
        className="h-full flex items-center gap-2 px-4 overflow-x-auto"
      >
        {photos.map((photo) => (
          <button
            key={photo.filepath}
            data-filepath={photo.filepath}
            onClick={() => selectPhoto(photo.filepath)}
            className={cn(
              'relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200',
              selectedFilepath === photo.filepath
                ? 'border-accent-500 ring-2 ring-accent-500/30 scale-105 shadow-lg shadow-accent-500/20'
                : getRecommendationBorder(photo.recommendation)
            )}
          >
            <img
              src={api.getPreviewUrl(photo.filepath)}
              alt={photo.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className={cn(
              'absolute bottom-0 right-0 w-5 h-5 rounded-tl-lg flex items-center justify-center text-[8px] font-bold font-mono text-white shadow-lg',
              getScoreBgColor(photo.overall_score)
            )}>
              {Math.round(photo.overall_score)}
            </div>
            {selectedFilepath === photo.filepath && (
              <div className="absolute inset-0 border-2 border-accent-500 rounded-lg" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
