import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Download, Check, AlertTriangle, Zap, Eye, Layers, HardDrive, RefreshCw, Info, Settings } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { ModelInfo, ModelTask, HardwareInfo, DownloadProgress } from '../../types/photo';

const TASK_CONFIG: { task: ModelTask; label: string; icon: typeof Cpu; description: string }[] = [
  { task: 'aesthetic', label: 'Aesthetic Scoring', icon: Eye, description: 'Models that evaluate photo beauty and composition quality' },
  { task: 'embedding', label: 'Duplicate Detection', icon: Layers, description: 'Models that create visual embeddings for finding similar photos' },
  { task: 'face_detection', label: 'Face Detection', icon: Zap, description: 'Models that detect faces and analyze expressions' },
];

const TIER_COLORS: Record<string, string> = {
  low: 'text-chrome-400 bg-chrome-800 border-chrome-700',
  medium: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  ultra: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

const QUALITY_BADGES: Record<string, string> = {
  basic: 'bg-chrome-700 text-chrome-300',
  good: 'bg-blue-500/20 text-blue-300',
  excellent: 'bg-emerald-500/20 text-emerald-300',
  best: 'bg-purple-500/20 text-purple-300',
};

const SPEED_BADGES: Record<string, string> = {
  fast: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-amber-500/20 text-amber-300',
  slow: 'bg-orange-500/20 text-orange-300',
  very_slow: 'bg-red-500/20 text-red-300',
};

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--:--';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function HardwarePanel({ hardware }: { hardware: HardwareInfo }) {
  const vramPct = hardware.vram_mb > 0 ? Math.min(100, (hardware.utilization?.vram_used_mb || 0) / hardware.vram_mb * 100) : 0;

  return (
    <div className="bg-chrome-850/50 rounded-xl border border-chrome-800/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu size={14} className="text-accent-400" />
        <span className="text-xs font-semibold text-chrome-200">Hardware Info</span>
        <span className={cn('ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border', TIER_COLORS[hardware.tier])}>
          {hardware.tier}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <span className="text-chrome-500 block">GPU</span>
          <span className="text-chrome-200 font-medium">{hardware.gpu_name}</span>
        </div>
        <div>
          <span className="text-chrome-500 block">VRAM</span>
          <span className="text-chrome-200 font-medium">{hardware.vram_gb > 0 ? `${hardware.vram_gb} GB` : 'Shared'}</span>
        </div>
        <div>
          <span className="text-chrome-500 block">CUDA Compute</span>
          <span className="text-chrome-200 font-mono">{hardware.cuda_compute}</span>
        </div>
        <div>
          <span className="text-chrome-500 block">Driver</span>
          <span className="text-chrome-200 font-mono text-[10px]">{hardware.driver}</span>
        </div>
      </div>

      {hardware.vram_mb > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-chrome-500 mb-1">
            <span>VRAM Usage</span>
            <span>{hardware.utilization?.vram_used_mb || 0} / {hardware.vram_mb} MB</span>
          </div>
          <div className="h-1.5 bg-chrome-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${vramPct}%` }}
            />
          </div>
        </div>
      )}

      {hardware.utilization && (
        <div className="mt-2 flex items-center gap-3 text-[10px] text-chrome-500">
          <span>GPU: {hardware.utilization.gpu_utilization}%</span>
          <span>Temp: {hardware.utilization.temperature_c}°C</span>
        </div>
      )}
    </div>
  );
}

function DownloadProgressBar({ progress }: { progress: DownloadProgress }) {
  return (
    <div className="space-y-1.5">
      <div className="h-2 bg-chrome-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-accent-500 to-blue-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress.progress_pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-chrome-400 font-mono">
          {progress.downloaded_mb} / {progress.total_mb} MB
        </span>
        <div className="flex items-center gap-2 text-chrome-500">
          <span>{progress.speed_mbps} MB/s</span>
          <span className="text-accent-400 font-mono">{formatEta(progress.eta_seconds)}</span>
        </div>
      </div>
    </div>
  );
}

function ModelCard({
  model,
  isActive,
  downloadProgress,
  onSelect,
  onDownload,
}: {
  model: ModelInfo;
  isActive: boolean;
  downloadProgress: DownloadProgress | null;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const isDownloading = downloadProgress?.status === 'downloading';
  const isDisabled = !model.compatible && model.has_file;
  const isBuiltIn = !model.has_file;
  const requiresConversion = model.tags.includes('requires_conversion');

  return (
    <div
      className={cn(
        'relative rounded-xl border p-3 transition-all',
        isActive && 'border-accent-500/60 bg-accent-500/5 ring-1 ring-accent-500/20',
        isDownloading && 'border-blue-500/40 bg-blue-500/5',
        !isActive && !isDownloading && model.downloaded && !isDisabled && 'border-chrome-700/50 bg-chrome-850/50 hover:border-chrome-600/50 cursor-pointer',
        !isActive && !isDownloading && !model.downloaded && !isDisabled && 'border-chrome-800/50 bg-chrome-900/50',
        isDisabled && 'border-reject-500/20 bg-chrome-900/30 opacity-60',
        isBuiltIn && model.downloaded && !isActive && 'border-chrome-700/50 bg-chrome-850/50'
      )}
      onClick={() => !isDisabled && !isDownloading && (model.downloaded || isBuiltIn) && onSelect()}
    >
      {isActive && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30">
          <Check size={10} className="text-white" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold text-chrome-100 truncate">{model.name}</h4>
          <p className="text-[9px] text-chrome-500 mt-0.5 line-clamp-2">{model.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium', QUALITY_BADGES[model.quality])}>
          {model.quality}
        </span>
        <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-medium', SPEED_BADGES[model.speed])}>
          {model.speed}
        </span>
        {model.size_mb > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-chrome-800 text-chrome-400">
            {model.size_mb}MB
          </span>
        )}
        {requiresConversion && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Requires Conversion
          </span>
        )}
      </div>

      {model.vram_required_mb > 0 && (
        <div className="text-[9px] text-chrome-500 mb-2 flex items-center gap-1">
          <HardDrive size={9} />
          <span>Requires {model.vram_required_mb}MB VRAM</span>
        </div>
      )}

      {isDisabled && (
        <div className="flex items-center gap-1 text-[9px] text-reject-400 mb-2">
          <AlertTriangle size={9} />
          <span className="line-clamp-1">{model.message}</span>
        </div>
      )}

      {requiresConversion && !model.downloaded && (
        <div className="flex items-center gap-1 text-[9px] text-amber-400 mb-2">
          <AlertTriangle size={9} />
          <span>This model requires manual ONNX conversion from PyTorch</span>
        </div>
      )}

      {isDownloading && downloadProgress && (
        <div className="mb-2">
          <DownloadProgressBar progress={downloadProgress} />
        </div>
      )}

      {downloadProgress?.status === 'error' && (
        <div className="flex items-center gap-1 text-[9px] text-reject-400 mb-2">
          <AlertTriangle size={9} />
          <span className="line-clamp-1">{downloadProgress.error_message || 'Download failed'}</span>
        </div>
      )}

      {!isDisabled && !isActive && (
        <div className="flex items-center gap-1.5">
          {(model.downloaded || isBuiltIn) ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="flex-1 px-2 py-1.5 rounded-lg bg-chrome-700/50 hover:bg-chrome-700 text-[10px] font-medium text-chrome-200 transition-colors"
            >
              Select
            </button>
          ) : requiresConversion ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-chrome-800/50 text-[10px] font-medium text-chrome-500 cursor-not-allowed"
            >
              Requires Conversion
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              disabled={isDownloading}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-[10px] font-medium text-accent-300 transition-colors disabled:opacity-50"
            >
              {isDownloading ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : (
                <Download size={10} />
              )}
              {isDownloading ? `${downloadProgress?.progress_pct ?? 0}%` : 'Download'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const hardware = useUIStore((s) => s.hardware);
  const availableModels = useUIStore((s) => s.availableModels);
  const activeModels = useUIStore((s) => s.activeModels);
  const setActiveModels = useUIStore((s) => s.setActiveModels);
  const setAvailableModels = useUIStore((s) => s.setAvailableModels);
  const addToast = useUIStore((s) => s.addToast);

  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, DownloadProgress>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<Set<string>>(new Set());

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async () => {
    try {
      const res = await api.getDownloadProgress();
      const map: Record<string, DownloadProgress> = {};
      let hasActive = false;

      for (const p of res.downloads) {
        map[p.model_id] = p;

        if (p.status === 'downloading') {
          hasActive = true;
        }

        if (p.status === 'complete' && !completedRef.current.has(p.model_id)) {
          completedRef.current.add(p.model_id);
          addToast({ message: `Downloaded ${p.model_id} (${p.total_mb} MB)`, type: 'success' });
        }

        if (p.status === 'error' && !completedRef.current.has(`err_${p.model_id}`)) {
          completedRef.current.add(`err_${p.model_id}`);
          addToast({ message: `Failed to download ${p.model_id}: ${p.error_message}`, type: 'error' });
        }
      }

      setDownloadProgressMap(map);

      if (!hasActive) {
        stopPolling();
        const [modelsRes, activeRes] = await Promise.all([
          api.getModels(),
          api.getActiveModels(),
        ]);
        setAvailableModels(modelsRes.models);
        setActiveModels(activeRes.active_models);
      }
    } catch {
      // polling failure is silent
    }
  }, [addToast, setAvailableModels, setActiveModels, stopPolling]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollProgress();
    pollingRef.current = setInterval(pollProgress, 500);
  }, [pollProgress]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (!open) {
      stopPolling();
    }
  }, [open, stopPolling]);

  async function handleSelectModel(task: ModelTask, modelId: string) {
    try {
      const result = await api.selectModel(task, modelId);
      setActiveModels({ ...activeModels, [task]: modelId });
      addToast({ message: `Switched to ${modelId}`, type: 'success' });
      if (result.warning) {
        addToast({ message: result.warning, type: 'warning' });
      }
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to select model', type: 'error' });
    }
  }

  async function handleDownloadModel(modelId: string) {
    try {
      await api.downloadModel(modelId);
      startPolling();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to start download', type: 'error' });
    }
  }

  async function handlePredownload() {
    try {
      const result = await api.predownloadModels();
      addToast({ message: `Pre-downloading ${result.threads} models for ${result.tier} tier...`, type: 'info' });
      startPolling();
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to start pre-download', type: 'error' });
    }
  }

  if (!hardware) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="w-full max-w-3xl max-h-[85vh] bg-chrome-900 border border-chrome-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-chrome-800/50 shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-accent-400" />
                <h2 className="text-sm font-bold text-chrome-100">AI Model Settings</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePredownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/30 text-[10px] font-medium text-accent-300 transition-colors"
                  title="Download all recommended models for your GPU tier"
                >
                  <Download size={11} />
                  Pre-download All
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-chrome-800 text-chrome-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <HardwarePanel hardware={hardware} />

              {TASK_CONFIG.map(({ task, label, icon: Icon, description }) => {
                const taskModels = availableModels.filter((m) => m.task === task);
                if (taskModels.length === 0) return null;

                return (
                  <div key={task}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={13} className="text-chrome-400" />
                      <h3 className="text-xs font-semibold text-chrome-200">{label}</h3>
                      <span className="text-[9px] text-chrome-500">{description}</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                      {taskModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isActive={activeModels[task] === model.id}
                          downloadProgress={downloadProgressMap[model.id] || null}
                          onSelect={() => handleSelectModel(task, model.id)}
                          onDownload={() => handleDownloadModel(model.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="bg-chrome-850/30 rounded-xl border border-chrome-800/30 p-4">
                <div className="flex items-start gap-2">
                  <Info size={13} className="text-chrome-500 mt-0.5 shrink-0" />
                  <div className="text-[10px] text-chrome-500 space-y-1">
                    <p><strong className="text-chrome-400">Auto-fallback:</strong> If a selected model fails during analysis, the system automatically falls back to a lighter compatible model.</p>
                    <p><strong className="text-chrome-400">Re-analysis:</strong> Changing models requires re-analyzing existing photos for updated scores.</p>
                    <p><strong className="text-chrome-400">Downloads:</strong> Models are downloaded on-demand from HuggingFace/GitHub and cached locally in the <code className="text-chrome-400">models/</code> directory.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
