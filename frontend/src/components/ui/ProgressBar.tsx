import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}

export function ProgressBar({ value, max = 100, color = 'bg-accent-500', className }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full h-1 rounded-full bg-chrome-800 overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', color)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
