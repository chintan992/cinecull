import type { AestheticsData } from '../../types/photo';

export function AestheticMetrics({ aesthetics }: { aesthetics: AestheticsData }) {
  const maxProb = Math.max(...aesthetics.nima_distribution);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-chrome-400 uppercase tracking-wider font-medium">CLIP Score</span>
        <span className="text-xs font-bold font-mono text-chrome-100">
          {aesthetics.clip_score.toFixed(1)}<span className="text-chrome-500">/10</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-chrome-500">
        <div className="bg-chrome-850 rounded-lg p-2 text-center">
          <div className="text-chrome-600 text-[8px] uppercase tracking-wider mb-1">NIMA Mean</div>
          <span className="text-chrome-200 font-semibold">{aesthetics.nima_mean.toFixed(2)}</span>
        </div>
        <div className="bg-chrome-850 rounded-lg p-2 text-center">
          <div className="text-chrome-600 text-[8px] uppercase tracking-wider mb-1">Uncertainty</div>
          <span className="text-chrome-200 font-semibold">±{Math.sqrt(aesthetics.nima_variance).toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[9px] text-chrome-500 uppercase tracking-wider font-medium">NIMA Distribution</span>
        <div className="flex items-end gap-0.5 h-12 bg-chrome-850 rounded-lg p-1.5">
          {aesthetics.nima_distribution.map((prob, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t bg-gradient-to-t from-accent-500 to-accent-400 hover:from-accent-400 hover:to-accent-300 transition-colors cursor-pointer"
              style={{ height: `${Math.max(8, (prob / maxProb) * 100)}%` }}
              title={`Score ${idx + 1}: ${(prob * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[8px] text-chrome-600 font-mono px-1">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
}
