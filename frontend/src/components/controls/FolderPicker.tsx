import { useState, useEffect } from 'react';
import { FolderSearch } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';

export function FolderPicker() {
  const open = useUIStore((s) => s.folderPickerOpen);
  const setOpen = useUIStore((s) => s.setFolderPickerOpen);
  const watchDir = useUIStore((s) => s.watchDir);
  const setWatchDir = useUIStore((s) => s.setWatchDir);
  const addToast = useUIStore((s) => s.addToast);
  const [input, setInput] = useState(watchDir);

  useEffect(() => {
    if (open) {
      setInput(watchDir);
    }
  }, [open, watchDir]);

  async function handleSave() {
    const val = input.trim();
    if (!val) return;

    try {
      const res = await api.setWatchDir(val);
      setWatchDir(res.watch_dir);
      addToast({ message: 'Watch folder updated', type: 'success' });
      setOpen(false);

      await api.scanDirectory();
      addToast({ message: 'Directory scan started', type: 'info' });
    } catch {
      addToast({ message: 'Failed to set folder', type: 'error' });
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Set Watch Folder"
      icon={<FolderSearch size={15} className="text-accent-400" />}
    >
      <div className="space-y-4">
        <p className="text-xs text-chrome-400 leading-relaxed">
          Enter the absolute path to your photo shoot folder. CineCull will monitor this directory and analyze new photos automatically.
        </p>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-chrome-500">
            Folder Path
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. C:\Users\Name\Pictures\Shoot1"
            className="w-full bg-chrome-950 border border-chrome-800/50 rounded-xl px-4 py-3 text-xs text-chrome-100 font-mono placeholder-chrome-600 focus:outline-none focus:border-accent-500/50 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 rounded-xl bg-chrome-850 hover:bg-chrome-800 border border-chrome-800/50 text-[11px] font-bold text-chrome-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-[11px] font-bold transition-colors shadow-lg shadow-accent-500/20"
          >
            Save & Scan
          </button>
        </div>
      </div>
    </Modal>
  );
}
