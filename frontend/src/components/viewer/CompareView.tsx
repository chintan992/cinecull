import { usePhotoStore } from '../../store/usePhotoStore';
import { api } from '../../lib/api';
import { getScoreColor, cn } from '../../lib/utils';
import type { Photo } from '../../types/photo';

function CompareCard({ photo }: { photo: Photo }) {
  const updateRecommendation = usePhotoStore((s) => s.updateRecommendation);

  return (
    <div className="flex flex-col border border-chrome-800 rounded-lg overflow-hidden bg-chrome-900">
      <div className="flex-1 bg-chrome-950 flex items-center justify-center p-2 min-h-0">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt={photo.filename}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="p-2.5 border-t border-chrome-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-chrome-200 truncate flex-1">{photo.filename}</span>
          <span className={cn('text-[11px] font-bold font-mono', getScoreColor(photo.overall_score))}>
            {Math.round(photo.overall_score)}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-chrome-500">
          <span>Focus: {Math.round(photo.focus.sharpness_score)}%</span>
          <span>Exp: {Math.round(photo.exposure.exposure_score)}%</span>
          <span>CLIP: {photo.aesthetics.clip_score.toFixed(1)}</span>
        </div>

        <div className="flex gap-1">
          {(['Keep', 'Review', 'Reject'] as const).map((rec) => (
            <button
              key={rec}
              onClick={() => updateRecommendation(photo.filepath, rec)}
              className={cn(
                'flex-1 py-1 rounded text-[9px] font-bold transition-colors',
                photo.recommendation === rec
                  ? rec === 'Keep' ? 'bg-keep-500 text-white' :
                    rec === 'Review' ? 'bg-review-500 text-white' : 'bg-reject-500 text-white'
                  : 'bg-chrome-800 text-chrome-400 hover:bg-chrome-700'
              )}
            >
              {rec[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompareView() {
  const compareFilepaths = usePhotoStore((s) => s.compareFilepaths);
  const photos = usePhotoStore((s) => s.photos);
  const toggleCompare = usePhotoStore((s) => s.toggleCompare);

  const comparePhotos = [...compareFilepaths]
    .map((fp) => photos.find((p) => p.filepath === fp))
    .filter(Boolean) as Photo[];

  if (comparePhotos.length < 2) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-chrome-500 p-8">
        <div className="w-12 h-12 rounded-full bg-chrome-850 border border-chrome-800 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="8" height="18" rx="1" />
            <rect x="14" y="3" width="8" height="18" rx="1" />
          </svg>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest">Compare Mode</p>
        <p className="text-[10px] mt-1 text-center max-w-[200px]">
          Switch to Grid view and select 2-4 photos to compare side by side.
        </p>
      </div>
    );
  }

  const cols = comparePhotos.length <= 2 ? 'grid-cols-2' : comparePhotos.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-chrome-400 font-mono">
          Comparing {comparePhotos.length} photos
        </span>
        <button
          onClick={() => compareFilepaths.forEach((fp) => toggleCompare(fp))}
          className="text-[9px] text-chrome-500 hover:text-chrome-300 transition-colors"
        >
          Clear selection
        </button>
      </div>
      <div className={`grid ${cols} gap-3 h-[calc(100%-2rem)]`}>
        {comparePhotos.map((photo) => (
          <CompareCard key={photo.filepath} photo={photo} />
        ))}
      </div>
    </div>
  );
}
