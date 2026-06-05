import { ProgressBar } from '../ui/ProgressBar';
import type { FocusData } from '../../types/photo';

export function FocusMetrics({ focus }: { focus: FocusData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-chrome-400 uppercase tracking-wider font-medium">Sharpness</span>
        <span className="text-xs font-bold font-mono text-chrome-100">
          {Math.round(focus.sharpness_score)}%
        </span>
      </div>
      <ProgressBar
        value={focus.sharpness_score}
        color={focus.sharpness_score >= 70 ? 'bg-keep-500' : focus.sharpness_score >= 40 ? 'bg-review-500' : 'bg-reject-500'}
      />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[9px] font-mono text-chrome-500">
        <div>Norm Var: <span className="text-chrome-300">{focus.normalized_variance.toFixed(5)}</span></div>
        <div>Lap Var: <span className="text-chrome-300">{focus.laplacian_variance.toFixed(1)}</span></div>
        {focus.face_focus_score !== undefined && (
          <div className="col-span-2">Face Focus: <span className="text-accent-400 font-semibold">{Math.round(focus.face_focus_score)}%</span></div>
        )}
      </div>
    </div>
  );
}
