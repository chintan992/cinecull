import { usePhotoStore } from '../../store/usePhotoStore';
import { api } from '../../lib/api';
import { cn, getScoreColor, getRecommendationBorder } from '../../lib/utils';
import { CheckCircle2, HelpCircle, XCircle, Eye } from 'lucide-react';

export function PhotoCard({ photo }: { photo: import('../../types/photo').Photo }) {
  const selectedFilepath = usePhotoStore((s) => s.selectedFilepath);
  const selectPhoto = usePhotoStore((s) => s.selectPhoto);
  const isSelected = selectedFilepath === photo.filepath;

  const RecIcon = photo.recommendation === 'Keep' ? CheckCircle2 :
    photo.recommendation === 'Reject' ? XCircle : HelpCircle;

  return (
    <button
      onClick={() => selectPhoto(photo.filepath)}
      className={cn(
        'group relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left',
        isSelected
          ? 'border-accent-500 ring-2 ring-accent-500/30 shadow-lg shadow-accent-500/10'
          : getRecommendationBorder(photo.recommendation)
      )}
    >
      <div className="aspect-[4/3] bg-chrome-850 overflow-hidden relative">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <div className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center shadow-lg',
            photo.recommendation === 'Keep' ? 'bg-keep-500' :
            photo.recommendation === 'Reject' ? 'bg-reject-500' : 'bg-review-500'
          )}>
            <RecIcon size={10} className="text-white" />
          </div>
        </div>

        <div className={cn(
          'absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono text-white shadow-lg',
          photo.overall_score >= 70 ? 'bg-keep-500/90' : photo.overall_score >= 45 ? 'bg-review-500/90' : 'bg-reject-500/90'
        )}>
          {Math.round(photo.overall_score)}
        </div>

        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1.5 text-[9px] text-white/90 font-mono">
            <span className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
              {Math.round(photo.focus.sharpness_score)}% focus
            </span>
            {photo.faces_detected > 0 && (
              <span className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Eye size={8} />
                {photo.any_eyes_closed ? 'closed' : `${photo.faces_detected} face${photo.faces_detected > 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-chrome-900">
        <span className="text-[11px] font-medium text-chrome-200 truncate block" title={photo.filename}>
          {photo.filename}
        </span>
      </div>
    </button>
  );
}
