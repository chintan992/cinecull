import type { AestheticsData } from '../../types/photo';

export function AestheticMetrics({ aesthetics }: { aesthetics: AestheticsData }) {
  const maxProb = Math.max(...aesthetics.nima_distribution);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-chrome-400 uppercase tracking-wider">CLIP Score</span>
        <span className="text-[10px] font-bold font-mono text-chrome-100">
          {aesthetics.clip_score.toFixed(1)}/10
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[8px] font-mono text-chrome-500">
        <div>NIMA Mean: <span className="text-chrome-300">{aesthetics.nima_mean.toFixed(2)}</span></div>
        <div>Uncertainty: <span className="text-chrome-300">±{Math.sqrt(aesthetics.nima_variance).toFixed(2)}</span></div>
      </div>

      <div className="space-y-1">
        <span className="text-[8px] text-chrome-500 uppercase tracking-wider">NIMA Distribution</span>
        <div className="flex items-end gap-px h-10 bg-chrome-850 rounded p-1">
          {aesthetics.nima_distribution.map((prob, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t-sm bg-accent-500/60 hover:bg-accent-400 transition-colors"
              style={{ height: `${Math.max(8, (prob / maxProb) * 100)}%` }}
              title={`Score ${idx + 1}: ${(prob * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[7px] text-chrome-600 font-mono">
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
}
