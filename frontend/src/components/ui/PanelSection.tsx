import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PanelSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, icon, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-chrome-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-chrome-850 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-bold uppercase tracking-widest text-chrome-300">{title}</span>
        </div>
        <ChevronDown
          size={12}
          className={cn('text-chrome-500 transition-transform duration-200', open ? '' : '-rotate-90')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
