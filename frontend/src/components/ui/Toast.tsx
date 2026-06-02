import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertOctagon, Info, AlertTriangle, X } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';

const icons = {
  success: CheckCircle,
  error: AlertOctagon,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'border-keep-500/20 text-keep-400',
  error: 'border-reject-500/20 text-reject-400',
  info: 'border-accent-500/20 text-accent-400',
  warning: 'border-review-500/20 text-review-400',
};

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-chrome-900/95 backdrop-blur-sm border ${colors[toast.type]} shadow-xl max-w-xs`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="text-[11px] font-medium flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded hover:bg-chrome-700 transition-colors"
              >
                <X size={10} className="text-chrome-400" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
