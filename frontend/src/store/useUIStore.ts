import { create } from 'zustand';
import type { ViewMode, CullingMode, HardwareInfo, ModelInfo, ActiveModels } from '../types/photo';

interface UIState {
  viewMode: ViewMode;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  commandPaletteOpen: boolean;
  folderPickerOpen: boolean;
  settingsOpen: boolean;
  watchDir: string;
  cullingMode: CullingMode;
  engine: string;
  hasYolo: boolean;
  connected: boolean;
  analysisPaused: boolean;
  analysisQueueLen: number;
  hardware: HardwareInfo | null;
  availableModels: ModelInfo[];
  activeModels: ActiveModels;
  toasts: Toast[];

  setViewMode: (mode: ViewMode) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setFolderPickerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setWatchDir: (dir: string) => void;
  setCullingMode: (mode: CullingMode) => void;
  setEngine: (engine: string, hasYolo: boolean) => void;
  setConnected: (connected: boolean) => void;
  setAnalysisPaused: (paused: boolean) => void;
  setAnalysisQueueLen: (len: number) => void;
  setHardware: (info: HardwareInfo) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  setActiveModels: (models: ActiveModels) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  leftPanelOpen: true,
  rightPanelOpen: true,
  commandPaletteOpen: false,
  folderPickerOpen: false,
  settingsOpen: false,
  watchDir: '',
  cullingMode: 'portrait',
  engine: 'standard',
  hasYolo: false,
  connected: false,
  analysisPaused: false,
  analysisQueueLen: 0,
  hardware: null,
  availableModels: [],
  activeModels: { aesthetic: 'nima', embedding: 'dinov2_small', face_detection: 'mediapipe' },
  toasts: [],

  setViewMode: (mode) => set({ viewMode: mode }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setFolderPickerOpen: (open) => set({ folderPickerOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setWatchDir: (dir) => set({ watchDir: dir }),
  setCullingMode: (mode) => set({ cullingMode: mode }),
  setEngine: (engine, hasYolo) => set({ engine, hasYolo }),
  setConnected: (connected) => set({ connected }),
  setAnalysisPaused: (paused) => set({ analysisPaused: paused }),
  setAnalysisQueueLen: (len) => set({ analysisQueueLen: len }),
  setHardware: (info) => set({ hardware: info }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setActiveModels: (models) => set({ activeModels: models }),

  addToast: (toast) => {
    const id = String(++toastId);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
