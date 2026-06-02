import { ProgressBar } from '../ui/ProgressBar';
import type { ExposureData } from '../../types/photo';

export function ExposureMetrics({ exposure }: { exposure: ExposureData }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-chrome-400 uppercase tracking-wider">Exposure</span>
        <span className="text-[10px] font-bold font-mono text-chrome-100">
          {Math.round(exposure.exposure_score)}%
        </span>
      </div>
      <ProgressBar
        value={exposure.exposure_score}
        color={exposure.exposure_score >= 70 ? 'bg-keep-500' : exposure.exposure_score >= 40 ? 'bg-review-500' : 'bg-reject-500'}
      />
      <div className="grid grid-cols-3 gap-2 text-[8px] font-mono text-chrome-500">
        <div>
          <div className="text-chrome-600 mb-0.5">BRIGHT</div>
          <span className="text-chrome-300">{Math.round(exposure.mean_brightness)}</span>
        </div>
        <div>
          <div className="text-chrome-600 mb-0.5">HI-CLIP</div>
          <span className="text-chrome-300">{exposure.highlight_percent.toFixed(1)}%</span>
        </div>
        <div>
          <div className="text-chrome-600 mb-0.5">LO-CLIP</div>
          <span className="text-chrome-300">{exposure.shadow_percent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
