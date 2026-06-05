import { TopBar } from './components/layout/TopBar';
import { LeftPanel } from './components/layout/LeftPanel';
import { RightPanel } from './components/layout/RightPanel';
import { Filmstrip } from './components/layout/Filmstrip';
import { CenterToolbar } from './components/layout/CenterToolbar';
import { GridView } from './components/viewer/GridView';
import { LoupeView } from './components/viewer/LoupeView';
import { CompareView } from './components/viewer/CompareView';
import { CommandPalette } from './components/controls/CommandPalette';
import { FolderPicker } from './components/controls/FolderPicker';
import { SettingsModal } from './components/controls/SettingsModal';
import { ToastContainer } from './components/ui/Toast';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUIStore } from './store/useUIStore';
import { usePhotoStore } from './store/usePhotoStore';
import { motion, AnimatePresence } from 'framer-motion';

function CenterViewport() {
  const viewMode = useUIStore((s) => s.viewMode);
  const compareSize = usePhotoStore((s) => s.compareFilepaths.size);

  if (viewMode === 'compare' && compareSize >= 2) {
    return <CompareView />;
  }

  if (viewMode === 'loupe') {
    return <LoupeView />;
  }

  return <GridView />;
}

export default function App() {
  useApi();
  useWebSocket();
  useKeyboardShortcuts();

  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);

  return (
    <>
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence initial={false}>
          {leftPanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 192, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="overflow-hidden shrink-0"
            >
              <LeftPanel />
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 flex flex-col min-w-0 bg-chrome-950">
          <CenterToolbar />
          <CenterViewport />
          <Filmstrip />
        </main>

        <AnimatePresence initial={false}>
          {rightPanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="overflow-hidden shrink-0"
            >
              <RightPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CommandPalette />
      <FolderPicker />
      <SettingsModal />
      <ToastContainer />
    </>
  );
}
