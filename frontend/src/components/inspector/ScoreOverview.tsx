import { api } from '../../lib/api';
import { usePhotoStore } from '../../store/usePhotoStore';
import { useUIStore } from '../../store/useUIStore';
import { cn } from '../../lib/utils';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
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
    <div className="p-4 border-b border-chrome-800/50">
      <div className="h-36 rounded-xl bg-chrome-850 overflow-hidden mb-3 relative group cursor-pointer shadow-lg">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt={photo.filename}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className={cn(
          'absolute bottom-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono text-white shadow-xl',
          photo.overall_score >= 70 ? 'bg-keep-500' : photo.overall_score >= 45 ? 'bg-review-500' : 'bg-reject-500'
        )}>
          {Math.round(photo.overall_score)}
        </div>
      </div>

      <p className="text-xs font-semibold text-chrome-100 truncate" title={photo.filename}>
        {photo.filename}
      </p>
      <p className="text-[10px] text-chrome-500 font-mono truncate mb-4" title={photo.filepath}>
        {photo.filepath}
      </p>

      <div className="flex gap-2">
        {([
          { rec: 'Keep' as const, label: 'Keep', shortcut: '1', Icon: CheckCircle2, activeClass: 'bg-keep-500 text-white shadow-lg shadow-keep-500/30' },
          { rec: 'Review' as const, label: 'Review', shortcut: '2', Icon: HelpCircle, activeClass: 'bg-review-500 text-white shadow-lg shadow-review-500/30' },
          { rec: 'Reject' as const, label: 'Reject', shortcut: '3', Icon: XCircle, activeClass: 'bg-reject-500 text-white shadow-lg shadow-reject-500/30' },
        ]).map(({ rec, label, shortcut, Icon, activeClass }) => (
          <button
            key={rec}
            onClick={() => setRec(rec)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all',
              photo.recommendation === rec
                ? activeClass
                : 'bg-chrome-850 text-chrome-400 border border-chrome-800/50 hover:bg-chrome-800 hover:text-chrome-200'
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
