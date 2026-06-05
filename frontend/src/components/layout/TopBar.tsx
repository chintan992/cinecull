import { Aperture, Folder, Wifi, WifiOff, Command, LayoutGrid, Image, Columns3, Play, Pause, Settings } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { ViewMode } from '../../types/photo';

const viewModes: { mode: ViewMode; icon: typeof LayoutGrid; label: string; shortcut: string }[] = [
  { mode: 'grid', icon: LayoutGrid, label: 'Grid', shortcut: 'G' },
  { mode: 'loupe', icon: Image, label: 'Loupe', shortcut: 'E' },
  { mode: 'compare', icon: Columns3, label: 'Compare', shortcut: 'C' },
];

export function TopBar() {
  const connected = useUIStore((s) => s.connected);
  const watchDir = useUIStore((s) => s.watchDir);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const setFolderPickerOpen = useUIStore((s) => s.setFolderPickerOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const analysisPaused = useUIStore((s) => s.analysisPaused);
  const analysisQueueLen = useUIStore((s) => s.analysisQueueLen);
  const setAnalysisPaused = useUIStore((s) => s.setAnalysisPaused);

  async function toggleAnalysis() {
    try {
      if (analysisPaused) {
        await api.resumeAnalysis();
        setAnalysisPaused(false);
      } else {
        await api.pauseAnalysis();
        setAnalysisPaused(true);
      }
    } catch (err) {
      console.error('Failed to toggle analysis:', err);
    }
  }

  return (
    <header className="h-12 bg-chrome-900 border-b border-chrome-800/50 flex items-center justify-between px-4 shrink-0 z-40">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-500 to-blue-600 flex items-center justify-center shadow-lg shadow-accent-500/20">
            <Aperture size={14} className="text-white" />
          </div>
          <span className="text-xs font-bold tracking-wide text-chrome-100">
            CineCull
          </span>
        </div>

        <div className="h-5 w-px bg-chrome-700/50" />

        <div className="flex items-center gap-1 bg-chrome-850 rounded-lg p-1">
          {viewModes.map(({ mode, icon: Icon, label, shortcut }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === mode
                  ? 'bg-chrome-700 text-chrome-100 shadow-sm'
                  : 'text-chrome-400 hover:text-chrome-200 hover:bg-chrome-800'
              )}
              title={`${label} (${shortcut})`}
            >
              <Icon size={13} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {watchDir && (
          <button
            onClick={toggleAnalysis}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all relative overflow-visible',
              analysisPaused
                ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                : 'bg-keep-500/10 hover:bg-keep-500/20 border-keep-500/30 text-keep-400'
            )}
            title={analysisPaused ? 'Resume auto-culling analysis' : 'Pause auto-culling analysis'}
          >
            {analysisPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} className="fill-current" />}
            <span>
              {analysisPaused 
                ? 'Paused' 
                : analysisQueueLen > 0 
                  ? `Analyzing (${analysisQueueLen})` 
                  : 'Active'
              }
            </span>
            {analysisQueueLen > 0 && (
              <span className={cn(
                'absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold font-mono text-white shadow-sm animate-pulse',
                analysisPaused ? 'bg-amber-500' : 'bg-keep-500'
              )}>
                {analysisQueueLen}
              </span>
            )}
          </button>
        )}

        <div className="hidden md:flex items-center gap-2 bg-chrome-850 px-3 py-1.5 rounded-lg border border-chrome-800/50">
          <Folder size={12} className="text-chrome-500" />
          <span className="text-[11px] text-chrome-400 font-mono truncate max-w-[200px]">
            {watchDir || 'No folder set'}
          </span>
        </div>

        <button
          onClick={() => setFolderPickerOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-xs font-medium text-chrome-300 transition-colors"
        >
          Set Folder
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-xs font-medium text-chrome-300 transition-colors"
          title="AI Model Settings"
        >
          <Settings size={12} />
          <span className="hidden lg:inline">Models</span>
        </button>

        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-xs font-medium text-chrome-300 transition-colors"
          title="Command Palette (⌘K)"
        >
          <Command size={12} />
          <span className="hidden lg:inline">Commands</span>
        </button>

        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider',
          connected
            ? 'bg-keep-500/10 text-keep-400 border border-keep-500/30'
            : 'bg-reject-500/10 text-reject-400 border border-reject-500/30'
        )}>
          {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span>{connected ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
