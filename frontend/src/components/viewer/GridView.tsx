import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectFilteredPhotos } from '../../store/usePhotoStore';
import { groupByCluster } from '../../lib/utils';
import { PhotoCard } from './PhotoCard';

export function GridView() {
  const photos = usePhotoStore(useShallow(selectFilteredPhotos));

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-chrome-500">
        <div className="w-12 h-12 rounded-full bg-chrome-850 border border-chrome-800 flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest">No photos</p>
        <p className="text-[10px] mt-1">Set a folder and scan to begin.</p>
      </div>
    );
  }

  const clusters = groupByCluster(photos);
  const sortedKeys = [...clusters.keys()].sort((a, b) => {
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    return (a as number) - (b as number);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {sortedKeys.map((key) => {
        const clusterPhotos = clusters.get(key)!;
        const bestScore = Math.max(...clusterPhotos.map((p) => p.overall_score));

        return (
          <div key={String(key)} className="mb-6">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-chrome-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-chrome-200">
                  {key === 'unassigned' ? 'Unassigned' : `Cluster #${key}`}
                  <span className="text-chrome-500 font-normal ml-1.5">({clusterPhotos.length})</span>
                </span>
              </div>
              <span className="text-[9px] text-chrome-500 font-mono">
                Best: <span className="text-accent-400 font-semibold">{Math.round(bestScore)}%</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {clusterPhotos.map((photo) => (
                <PhotoCard key={photo.filepath} photo={photo} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
