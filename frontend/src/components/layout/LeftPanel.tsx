import { Library, CheckCircle2, HelpCircle, Trash2, Download, Upload, RotateCcw, BarChart3 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectCounts } from '../../store/usePhotoStore';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { FilterType } from '../../types/photo';

const filters: { type: FilterType; label: string; icon: typeof Library; color: string }[] = [
  { type: 'ALL', label: 'All Imports', icon: Library, color: 'text-accent-400' },
  { type: 'Keep', label: 'Keep', icon: CheckCircle2, color: 'text-keep-400' },
  { type: 'Review', label: 'Review', icon: HelpCircle, color: 'text-review-400' },
  { type: 'Reject', label: 'Reject', icon: Trash2, color: 'text-reject-400' },
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
      addToast({ message: `Scan: ${res.found_total} found, ${res.added_to_queue} queued`, type: 'success' });
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
    <aside className="w-48 bg-chrome-900 border-r border-chrome-800 flex flex-col shrink-0 overflow-y-auto">
      <div className="p-3 space-y-1">
        <span className="text-[8px] font-bold uppercase tracking-widest text-chrome-500 px-2 mb-2 block">
          Library
        </span>
        {filters.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[11px] transition-all',
              filter === type
                ? 'bg-chrome-800 text-chrome-100'
                : 'text-chrome-400 hover:bg-chrome-850 hover:text-chrome-200'
            )}
          >
            <span className="flex items-center gap-2">
              <Icon size={13} className={color} />
              {label}
            </span>
            <span className="text-[9px] font-mono text-chrome-500">{countMap[type]}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-chrome-800 p-3 space-y-1.5">
        <span className="text-[8px] font-bold uppercase tracking-widest text-chrome-500 px-2 mb-2 block">
          Actions
        </span>
        <button
          onClick={handleScan}
          className="w-full px-2.5 py-2 rounded-md bg-chrome-850 hover:bg-chrome-800 border border-chrome-800 text-[10px] font-medium text-chrome-300 transition-colors"
        >
          Scan Directory
        </button>
        <button
          onClick={handleOrganize}
          disabled={photos.length === 0}
          className="w-full px-2.5 py-2 rounded-md bg-keep-500/10 hover:bg-keep-500/20 border border-keep-500/20 text-[10px] font-medium text-keep-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Organize Photos
        </button>
      </div>

      <div className="border-t border-chrome-800 p-3 space-y-1.5">
        <span className="text-[8px] font-bold uppercase tracking-widest text-chrome-500 px-2 mb-2 block">
          Session
        </span>
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md bg-chrome-850 hover:bg-chrome-800 border border-chrome-800 text-[10px] font-medium text-chrome-300 transition-colors"
        >
          <Download size={11} /> Export
        </button>
        <button
          onClick={handleImport}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md bg-chrome-850 hover:bg-chrome-800 border border-chrome-800 text-[10px] font-medium text-chrome-300 transition-colors"
        >
          <Upload size={11} /> Import
        </button>
        <button
          onClick={handleRedo}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md bg-reject-500/5 hover:bg-reject-500/10 border border-reject-500/10 text-[10px] font-medium text-reject-400/80 transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      <div className="mt-auto border-t border-chrome-800 p-3">
        <div className="flex items-center gap-2 px-2">
          <BarChart3 size={11} className="text-chrome-500" />
          <div className="flex-1 flex justify-between text-[9px]">
            <span className="text-chrome-500">Photos</span>
            <span className="font-mono text-chrome-300 font-semibold">{counts.all}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 mt-1">
          <BarChart3 size={11} className="text-chrome-500" />
          <div className="flex-1 flex justify-between text-[9px]">
            <span className="text-chrome-500">Avg Score</span>
            <span className="font-mono text-chrome-300 font-semibold">{avgScore}%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
