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
        <p className="text-sm font-semibold uppercase tracking-widest">Select a photo to view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-chrome-950 relative">
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
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

      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
        <div className="bg-chrome-950/90 backdrop-blur-sm border border-chrome-800/50 rounded-xl px-4 py-3 shadow-xl">
          <p className="text-xs font-semibold text-chrome-100">{photo.filename}</p>
          <p className="text-[10px] text-chrome-500 font-mono truncate max-w-[300px]">{photo.filepath}</p>
        </div>

        <div className="bg-chrome-950/90 backdrop-blur-sm border border-chrome-800/50 rounded-xl px-4 py-3 text-center shadow-xl">
          <p className={cn('text-xl font-bold font-mono', getScoreColor(photo.overall_score))}>
            {Math.round(photo.overall_score)}%
          </p>
          <p className="text-[9px] text-chrome-500 uppercase tracking-wider">{photo.recommendation}</p>
        </div>
      </div>

      {!zoomed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-chrome-950/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <span className="text-[9px] text-chrome-500 font-mono">Click to zoom • Press E to exit</span>
        </div>
      )}
    </div>
  );
}
