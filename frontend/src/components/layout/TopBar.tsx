import { Aperture, Folder, Wifi, WifiOff, Command, LayoutGrid, Image, Columns3 } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
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

  return (
    <header className="h-11 bg-chrome-900 border-b border-chrome-800 flex items-center justify-between px-3 shrink-0 z-40">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center">
            <Aperture size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-chrome-100 hidden sm:block">
            CineCull
          </span>
        </div>

        <div className="h-4 w-px bg-chrome-700" />

        <div className="flex items-center gap-0.5 bg-chrome-850 rounded-md p-0.5">
          {viewModes.map(({ mode, icon: Icon, label, shortcut }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all',
                viewMode === mode
                  ? 'bg-chrome-700 text-chrome-100 shadow-sm'
                  : 'text-chrome-400 hover:text-chrome-200'
              )}
              title={`${label} (${shortcut})`}
            >
              <Icon size={12} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5 bg-chrome-850 px-2.5 py-1 rounded-md border border-chrome-800">
          <Folder size={11} className="text-chrome-500" />
          <span className="text-[9px] text-chrome-400 font-mono truncate max-w-[200px]">
            {watchDir || 'No folder set'}
          </span>
        </div>

        <button
          onClick={() => setFolderPickerOpen(true)}
          className="px-2.5 py-1 rounded-md bg-chrome-850 hover:bg-chrome-800 border border-chrome-800 text-[10px] font-medium text-chrome-300 transition-colors"
        >
          Set Folder
        </button>

        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-chrome-850 hover:bg-chrome-800 border border-chrome-800 text-[10px] font-medium text-chrome-300 transition-colors"
          title="Command Palette (⌘K)"
        >
          <Command size={11} />
          <span className="hidden lg:inline">Commands</span>
        </button>

        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider',
          connected
            ? 'bg-keep-500/10 text-keep-400 border border-keep-500/20'
            : 'bg-reject-500/10 text-reject-400 border border-reject-500/20'
        )}>
          {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
          <span>{connected ? 'Online' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
