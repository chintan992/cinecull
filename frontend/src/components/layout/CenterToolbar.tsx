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
      addToast({ message: `Scan: ${res.found_total} found, ${res.added_to_queue} queued`, type: 'success' });
    } catch {
      addToast({ message: 'Scan failed', type: 'error' });
    }
  }

  return (
    <div className="h-9 px-3 flex items-center justify-between bg-chrome-900/50 border-b border-chrome-800 shrink-0">
      <div className="flex items-center gap-2 text-[10px] text-chrome-400">
        <span className="font-semibold text-chrome-200">{photos.length}</span>
        <span>photos</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <ArrowDownWideNarrow size={11} className="text-chrome-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-chrome-850 border border-chrome-800 rounded px-2 py-1 text-[10px] text-chrome-300 focus:outline-none focus:border-accent-500/50"
          >
            <option value="score-desc">Score: High → Low</option>
            <option value="score-asc">Score: Low → High</option>
            <option value="filename">Filename</option>
          </select>
        </div>

        <button
          onClick={handleScan}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[10px] font-semibold transition-colors"
        >
          <RefreshCw size={11} />
          Scan
        </button>
      </div>
    </div>
  );
}
