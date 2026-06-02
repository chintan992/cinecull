import { useState } from 'react';
import { usePhotoStore, selectSelectedPhoto } from '../../store/usePhotoStore';
import { api } from '../../lib/api';
import { getScoreColor, cn } from '../../lib/utils';

export function LoupeView() {
  const photo = usePhotoStore(selectSelectedPhoto);
  const [zoomed, setZoomed] = useState(false);

  if (!photo) {
    return (
      <div className="flex-1 flex items-center justify-center text-chrome-500">
        <p className="text-[11px] font-semibold uppercase tracking-widest">Select a photo to view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-chrome-950 relative">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt={photo.filename}
          className={cn(
            'max-h-full max-w-full object-contain transition-transform duration-300 cursor-zoom-in',
            zoomed && 'scale-[2.5] cursor-zoom-out'
          )}
          onClick={() => setZoomed(!zoomed)}
        />
      </div>

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-chrome-950/90 backdrop-blur-sm border border-chrome-800 rounded-lg px-3 py-2">
          <p className="text-[11px] font-semibold text-chrome-100">{photo.filename}</p>
          <p className="text-[9px] text-chrome-500 font-mono truncate max-w-[300px]">{photo.filepath}</p>
        </div>

        <div className={cn(
          'bg-chrome-950/90 backdrop-blur-sm border border-chrome-800 rounded-lg px-3 py-2 text-center',
        )}>
          <p className={cn('text-lg font-bold font-mono', getScoreColor(photo.overall_score))}>
            {Math.round(photo.overall_score)}%
          </p>
          <p className="text-[8px] text-chrome-500 uppercase tracking-wider">{photo.recommendation}</p>
        </div>
      </div>

      {!zoomed && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-chrome-950/70 backdrop-blur-sm rounded px-2 py-1">
          <span className="text-[8px] text-chrome-500 font-mono">Click to zoom • Press E to exit</span>
        </div>
      )}
    </div>
  );
}
