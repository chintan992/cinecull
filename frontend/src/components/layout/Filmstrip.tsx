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
      <div className="h-20 bg-chrome-900 border-t border-chrome-800 flex items-center justify-center shrink-0">
        <span className="text-[10px] text-chrome-500 font-mono">No photos in current view</span>
      </div>
    );
  }

  return (
    <div className="h-20 bg-chrome-900 border-t border-chrome-800 shrink-0">
      <div
        ref={scrollRef}
        className="h-full flex items-center gap-1.5 px-3 overflow-x-auto"
      >
        {photos.map((photo) => (
          <button
            key={photo.filepath}
            data-filepath={photo.filepath}
            onClick={() => selectPhoto(photo.filepath)}
            className={cn(
              'relative h-14 w-14 shrink-0 rounded overflow-hidden border-2 transition-all',
              selectedFilepath === photo.filepath
                ? 'border-accent-500 ring-1 ring-accent-500/30'
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
              'absolute bottom-0 right-0 w-4 h-4 rounded-tl flex items-center justify-center text-[7px] font-bold font-mono text-white',
              getScoreBgColor(photo.overall_score)
            )}>
              {Math.round(photo.overall_score)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
