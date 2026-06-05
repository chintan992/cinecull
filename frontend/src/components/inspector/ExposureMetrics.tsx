import { ProgressBar } from '../ui/ProgressBar';
import type { ExposureData } from '../../types/photo';

export function ExposureMetrics({ exposure }: { exposure: ExposureData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-chrome-400 uppercase tracking-wider font-medium">Exposure</span>
        <span className="text-xs font-bold font-mono text-chrome-100">
          {Math.round(exposure.exposure_score)}%
        </span>
      </div>
      <ProgressBar
        value={exposure.exposure_score}
        color={exposure.exposure_score >= 70 ? 'bg-keep-500' : exposure.exposure_score >= 40 ? 'bg-review-500' : 'bg-reject-500'}
      />
      <div className="grid grid-cols-3 gap-2 text-[9px] font-mono text-chrome-500">
        <div className="bg-chrome-850 rounded-lg p-2 text-center">
          <div className="text-chrome-600 text-[8px] uppercase tracking-wider mb-1">Bright</div>
          <span className="text-chrome-200 font-semibold">{Math.round(exposure.mean_brightness)}</span>
        </div>
        <div className="bg-chrome-850 rounded-lg p-2 text-center">
          <div className="text-chrome-600 text-[8px] uppercase tracking-wider mb-1">Hi-Clip</div>
          <span className="text-chrome-200 font-semibold">{exposure.highlight_percent.toFixed(1)}%</span>
        </div>
        <div className="bg-chrome-850 rounded-lg p-2 text-center">
          <div className="text-chrome-600 text-[8px] uppercase tracking-wider mb-1">Lo-Clip</div>
          <span className="text-chrome-200 font-semibold">{exposure.shadow_percent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
