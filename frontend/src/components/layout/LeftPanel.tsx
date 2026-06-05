import { Library, CheckCircle2, HelpCircle, Trash2, Download, Upload, RotateCcw, FolderSearch, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectCounts } from '../../store/usePhotoStore';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { FilterType } from '../../types/photo';

const filters: { type: FilterType; label: string; icon: typeof Library; color: string; activeColor: string }[] = [
  { type: 'ALL', label: 'All Photos', icon: Library, color: 'text-accent-400', activeColor: 'bg-accent-500/10 border-accent-500/30 text-accent-400' },
  { type: 'Keep', label: 'Keepers', icon: CheckCircle2, color: 'text-keep-400', activeColor: 'bg-keep-500/10 border-keep-500/30 text-keep-400' },
  { type: 'Review', label: 'Review', icon: HelpCircle, color: 'text-review-400', activeColor: 'bg-review-500/10 border-review-500/30 text-review-400' },
  { type: 'Reject', label: 'Rejected', icon: Trash2, color: 'text-reject-400', activeColor: 'bg-reject-500/10 border-reject-500/30 text-reject-400' },
];

export function LeftPanel() {
  const filter = usePhotoStore((s) => s.filter);
  const setFilter = usePhotoStore((s) => s.setFilter);
  const counts = usePhotoStore(useShallow(selectCounts));
  const photos = usePhotoStore((s) => s.photos);
  const addToast = useUIStore((s) => s.addToast);
  const avgScore = photos.length > 0
    ? Math.round(photos.reduce((sum, p) => sum + p.overall_score, 0) / photos.length)
    : 0;

  const countMap: Record<string, number> = {
    ALL: counts.all,
    Keep: counts.keep,
    Review: counts.review,
    Reject: counts.reject,
  };

  async function handleScan() {
    try {
      const res = await api.scanDirectory();
      addToast({ message: `Found ${res.found_total} photos, ${res.added_to_queue} queued for analysis`, type: 'success' });
    } catch {
      addToast({ message: 'Scan failed', type: 'error' });
    }
  }

  async function handleOrganize() {
    if (photos.length === 0) return;
    if (!confirm(`Organize ${photos.length} photos into Keep/Review/Reject folders?`)) return;

    const selections: Record<string, string> = {};
    photos.forEach((p) => { selections[p.filepath] = p.recommendation; });

    try {
      await api.organizePhotos(selections as Record<string, 'Keep' | 'Review' | 'Reject'>);
      addToast({ message: 'Photos organized successfully', type: 'success' });
    } catch {
      addToast({ message: 'Organization failed', type: 'error' });
    }
  }

  async function handleRedo() {
    if (!confirm('Reset culling? This moves all files back to the root folder.')) return;
    try {
      const res = await api.redoCulling();
      addToast({ message: `Reset complete. ${res.moved_count} files restored.`, type: 'success' });
    } catch {
      addToast({ message: 'Reset failed', type: 'error' });
    }
  }

  function handleExport() {
    if (photos.length === 0) {
      addToast({ message: 'No photos to export', type: 'warning' });
      return;
    }
    window.location.href = api.getExportUrl();
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const res = await api.importSession(file);
        addToast({ message: `Imported ${res.imported_count} photos`, type: 'success' });
      } catch {
        addToast({ message: 'Import failed', type: 'error' });
      }
    };
    input.click();
  }

  return (
    <aside className="w-52 bg-chrome-900 border-r border-chrome-800/50 flex flex-col shrink-0 overflow-y-auto">
      <div className="p-4 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-chrome-500 px-3 mb-3 block">
          Library
        </span>
        {filters.map(({ type, label, icon: Icon, activeColor }) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all border',
              filter === type
                ? activeColor
                : 'border-transparent text-chrome-400 hover:bg-chrome-850 hover:text-chrome-200'
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon size={14} />
              {label}
            </span>
            <span className="text-[10px] font-mono text-chrome-500 bg-chrome-850 px-1.5 py-0.5 rounded">
              {countMap[type]}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-chrome-800/50 p-4 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-chrome-500 px-3 mb-3 block">
          Workflow
        </span>
        <button
          onClick={handleScan}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-accent-500/20"
        >
          <FolderSearch size={13} />
          Scan Directory
        </button>
        <button
          onClick={handleOrganize}
          disabled={photos.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-keep-500/10 hover:bg-keep-500/20 border border-keep-500/30 text-xs font-medium text-keep-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={13} />
          Organize Photos
        </button>
      </div>

      <div className="border-t border-chrome-800/50 p-4 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-chrome-500 px-3 mb-3 block">
          Session
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-[11px] font-medium text-chrome-300 transition-colors"
          >
            <Download size={11} /> Export
          </button>
          <button
            onClick={handleImport}
            className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-[11px] font-medium text-chrome-300 transition-colors"
          >
            <Upload size={11} /> Import
          </button>
        </div>
        <button
          onClick={handleRedo}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-reject-500/5 hover:bg-reject-500/10 border border-reject-500/20 text-[11px] font-medium text-reject-400/80 transition-colors"
        >
          <RotateCcw size={11} /> Reset Culling
        </button>
      </div>

      <div className="mt-auto border-t border-chrome-800/50 p-4">
        <div className="bg-chrome-850 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-chrome-500 uppercase tracking-wider">Total Photos</span>
            <span className="text-sm font-bold font-mono text-chrome-100">{counts.all}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-chrome-500 uppercase tracking-wider">Avg Score</span>
            <span className="text-sm font-bold font-mono text-accent-400">{avgScore}%</span>
          </div>
          <div className="h-1.5 bg-chrome-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full transition-all duration-500"
              style={{ width: `${avgScore}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
