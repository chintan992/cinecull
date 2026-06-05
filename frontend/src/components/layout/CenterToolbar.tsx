import { ArrowDownWideNarrow, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, selectFilteredPhotos } from '../../store/usePhotoStore';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';

export function CenterToolbar() {
  const sortBy = usePhotoStore((s) => s.sortBy);
  const setSortBy = usePhotoStore((s) => s.setSortBy);
  const photos = usePhotoStore(useShallow(selectFilteredPhotos));
  const addToast = useUIStore((s) => s.addToast);

  async function handleScan() {
    try {
      const res = await api.scanDirectory();
      addToast({ message: `Found ${res.found_total} photos, ${res.added_to_queue} queued`, type: 'success' });
    } catch {
      addToast({ message: 'Scan failed', type: 'error' });
    }
  }

  return (
    <div className="h-10 px-4 flex items-center justify-between bg-chrome-900/50 border-b border-chrome-800/50 shrink-0">
      <div className="flex items-center gap-2 text-xs text-chrome-400">
        <span className="font-semibold text-chrome-200">{photos.length}</span>
        <span>photos</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <ArrowDownWideNarrow size={12} className="text-chrome-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-chrome-850 border border-chrome-800/50 rounded-lg px-2.5 py-1.5 text-[11px] text-chrome-300 focus:outline-none focus:border-accent-500/50"
          >
            <option value="score-desc">Score: High → Low</option>
            <option value="score-asc">Score: Low → High</option>
            <option value="filename">Filename</option>
          </select>
        </div>

        <button
          onClick={handleScan}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-[11px] font-semibold transition-colors shadow-lg shadow-accent-500/20"
        >
          <RefreshCw size={12} />
          Scan
        </button>
      </div>
    </div>
  );
}
