import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectFilteredPhotos } from '../../store/usePhotoStore';
import { groupByCluster } from '../../lib/utils';
import { PhotoCard } from './PhotoCard';
import { Layers } from 'lucide-react';

export function GridView() {
  const photos = usePhotoStore(useShallow(selectFilteredPhotos));

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-chrome-500">
        <div className="w-16 h-16 rounded-2xl bg-chrome-850 border border-chrome-800/50 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-chrome-600">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-chrome-300">No photos yet</p>
        <p className="text-xs mt-1.5 text-chrome-500">Set a watch folder and scan to begin culling.</p>
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
    <div className="flex-1 overflow-y-auto p-5">
      {sortedKeys.map((key) => {
        const clusterPhotos = clusters.get(key)!;
        const bestScore = Math.max(...clusterPhotos.map((p) => p.overall_score));

        return (
          <div key={String(key)} className="mb-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-chrome-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-accent-500 shadow-lg shadow-accent-500/30" />
                <span className="text-xs font-bold uppercase tracking-wider text-chrome-200">
                  {key === 'unassigned' ? 'Unassigned' : `Scene #${key}`}
                </span>
                <span className="text-[10px] text-chrome-500 font-mono bg-chrome-850 px-2 py-0.5 rounded-full">
                  {clusterPhotos.length} photo{clusterPhotos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-chrome-500">
                <Layers size={10} />
                <span>Best: </span>
                <span className="text-accent-400 font-bold font-mono">{Math.round(bestScore)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
