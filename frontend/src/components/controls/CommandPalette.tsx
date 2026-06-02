import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Camera, Palette, Zap, Target, Settings } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';


interface Command {
  id: string;
  label: string;
  description: string;
  icon: typeof Camera;
  action: () => void;
}

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setCullingMode = useUIStore((s) => s.setCullingMode);
  const setEngine = useUIStore((s) => s.setEngine);
  const hasYolo = useUIStore((s) => s.hasYolo);
  const addToast = useUIStore((s) => s.addToast);
  const [query, setQuery] = useState('');
  const [budgetValue, setBudgetValue] = useState('10');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const commands: Command[] = [
    {
      id: 'mode-portrait',
      label: 'Portrait Mode',
      description: 'Focus + Eye/Smile weighted scoring',
      icon: Camera,
      action: async () => {
        await api.setCullingMode('portrait');
        setCullingMode('portrait');
        addToast({ message: 'Switched to Portrait Mode', type: 'success' });
      },
    },
    {
      id: 'mode-landscape',
      label: 'Landscape Mode',
      description: 'Focus + Composition weighted scoring',
      icon: Palette,
      action: async () => {
        await api.setCullingMode('landscape');
        setCullingMode('landscape');
        addToast({ message: 'Switched to Landscape Mode', type: 'success' });
      },
    },
    {
      id: 'mode-action',
      label: 'Action/Sport Mode',
      description: 'Heavy focus weighted scoring',
      icon: Zap,
      action: async () => {
        await api.setCullingMode('action_sport');
        setCullingMode('action_sport');
        addToast({ message: 'Switched to Action Mode', type: 'success' });
      },
    },
    {
      id: 'engine-standard',
      label: 'Standard Engine',
      description: 'OpenCV + MediaPipe detection',
      icon: Settings,
      action: async () => {
        await api.setEngine('standard');
        setEngine('standard', hasYolo);
        addToast({ message: 'Switched to Standard Engine', type: 'success' });
      },
    },
    ...(hasYolo ? [{
      id: 'engine-yolo',
      label: 'YOLOv8 Engine',
      description: 'AI-powered person/face detection',
      icon: Zap,
      action: async () => {
        await api.setEngine('yolov8');
        setEngine('yolov8', hasYolo);
        addToast({ message: 'Switched to YOLOv8 Engine', type: 'success' });
      },
    }] : []),
    {
      id: 'budget-apply',
      label: `Apply Budget: ${budgetValue} keepers`,
      description: 'Optimize selections to target count',
      icon: Target,
      action: async () => {
        const n = parseInt(budgetValue);
        if (isNaN(n) || n <= 0) {
          addToast({ message: 'Enter a valid budget number', type: 'warning' });
          return;
        }
        await api.applyBudget(n);
        addToast({ message: `Budget applied: ${n} keepers`, type: 'success' });
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="w-full max-w-lg bg-chrome-900 border border-chrome-700 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-chrome-800">
              <Search size={14} className="text-chrome-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-[12px] text-chrome-100 placeholder-chrome-600 focus:outline-none"
              />
              <span className="text-[8px] text-chrome-600 font-mono bg-chrome-850 px-1.5 py-0.5 rounded border border-chrome-800">
                ESC
              </span>
            </div>

            <div className="p-2 max-h-[300px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-chrome-500">No commands found</p>
                </div>
              ) : (
                filtered.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-chrome-850 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-chrome-850 border border-chrome-800 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-chrome-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-chrome-200">{cmd.label}</p>
                        <p className="text-[9px] text-chrome-500">{cmd.description}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-chrome-800 bg-chrome-850/50">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-chrome-500">Budget:</span>
                <input
                  type="number"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                  min="1"
                  className="w-16 bg-chrome-900 border border-chrome-800 rounded px-2 py-1 text-[10px] text-chrome-200 font-mono focus:outline-none focus:border-accent-500/50"
                />
                <span className="text-[8px] text-chrome-600">keepers for budget optimization</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
