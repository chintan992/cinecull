import { api } from '../../lib/api';
import { usePhotoStore } from '../../store/usePhotoStore';
import { useUIStore } from '../../store/useUIStore';
import { cn } from '../../lib/utils';
import type { Photo, Recommendation } from '../../types/photo';

export function ScoreOverview({ photo }: { photo: Photo }) {
  const updateRecommendation = usePhotoStore((s) => s.updateRecommendation);
  const addToast = useUIStore((s) => s.addToast);

  async function setRec(rec: Recommendation) {
    updateRecommendation(photo.filepath, rec);
    try {
      await api.setRecommendation(photo.filepath, rec);
      addToast({ message: `Marked as ${rec}`, type: rec === 'Keep' ? 'success' : rec === 'Reject' ? 'warning' : 'info' });
    } catch {
      addToast({ message: 'Failed to update', type: 'error' });
    }
  }

  return (
    <div className="p-3 border-b border-chrome-800">
      <div className="h-32 rounded-lg bg-chrome-850 overflow-hidden mb-3 relative group cursor-pointer">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt={photo.filename}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className={cn(
          'absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono text-white',
          photo.overall_score >= 70 ? 'bg-keep-500' : photo.overall_score >= 45 ? 'bg-review-500' : 'bg-reject-500'
        )}>
          {Math.round(photo.overall_score)}
        </div>
      </div>

      <p className="text-[11px] font-semibold text-chrome-100 truncate" title={photo.filename}>
        {photo.filename}
      </p>
      <p className="text-[8px] text-chrome-500 font-mono truncate mb-3" title={photo.filepath}>
        {photo.filepath}
      </p>

      <div className="flex gap-1.5">
        {(['Keep', 'Review', 'Reject'] as const).map((rec) => (
          <button
            key={rec}
            onClick={() => setRec(rec)}
            className={cn(
              'flex-1 py-2 rounded-md text-[10px] font-bold transition-all',
              photo.recommendation === rec
                ? rec === 'Keep' ? 'bg-keep-500 text-white shadow-lg shadow-keep-500/20' :
                  rec === 'Review' ? 'bg-review-500 text-white shadow-lg shadow-review-500/20' :
                  'bg-reject-500 text-white shadow-lg shadow-reject-500/20'
                : 'bg-chrome-850 text-chrome-400 border border-chrome-800 hover:bg-chrome-800'
            )}
          >
            {rec === 'Keep' ? '[1] Keep' : rec === 'Review' ? '[2] Rev' : '[3] Rej'}
          </button>
        ))}
      </div>
    </div>
  );
}
