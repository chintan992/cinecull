import { usePhotoStore } from '../../store/usePhotoStore';
import { api } from '../../lib/api';
import { cn, getScoreColor, getRecommendationBorder } from '../../lib/utils';

export function PhotoCard({ photo }: { photo: import('../../types/photo').Photo }) {
  const selectedFilepath = usePhotoStore((s) => s.selectedFilepath);
  const selectPhoto = usePhotoStore((s) => s.selectPhoto);
  const isSelected = selectedFilepath === photo.filepath;

  return (
    <button
      onClick={() => selectPhoto(photo.filepath)}
      className={cn(
        'group relative rounded-lg overflow-hidden border-2 transition-all text-left',
        isSelected
          ? 'border-accent-500 ring-2 ring-accent-500/20'
          : getRecommendationBorder(photo.recommendation)
      )}
    >
      <div className="aspect-[4/3] bg-chrome-850 overflow-hidden">
        <img
          src={api.getPreviewUrl(photo.filepath)}
          alt={photo.filename}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="p-2 bg-chrome-900">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-chrome-200 truncate flex-1">
            {photo.filename}
          </span>
          <span className={cn('text-[10px] font-bold font-mono ml-2', getScoreColor(photo.overall_score))}>
            {Math.round(photo.overall_score)}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] text-chrome-500 font-mono">
            SHRP: {Math.round(photo.focus.sharpness_score)}%
          </span>
          <span className="text-[8px] text-chrome-500 font-mono">
            {photo.faces_detected > 0
              ? photo.any_eyes_closed ? 'eyes closed' : `${photo.faces_detected} face${photo.faces_detected > 1 ? 's' : ''}`
              : 'no face'}
          </span>
        </div>
      </div>

      <div className={cn(
        'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono text-white',
        photo.recommendation === 'Keep' ? 'bg-keep-500' :
        photo.recommendation === 'Reject' ? 'bg-reject-500' : 'bg-review-500'
      )}>
        {photo.recommendation[0]}
      </div>
    </button>
  );
}
