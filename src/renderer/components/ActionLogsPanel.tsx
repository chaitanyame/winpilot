import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ActionLog } from '../../shared/types';
import { CanvasTab } from './CanvasTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: ActionLog[];
  onClearAll: () => void;
}

export function ActionLogsPanel({ isOpen, onClose, logs, onClearAll }: Props) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-950 rounded-xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden border border-stone-800 h-[80vh]"
      >
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-200">Logs & Actions</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[calc(80vh-56px)]">
          <CanvasTab logs={logs} onClearAll={onClearAll} />
        </div>
      </motion.div>
    </motion.div>
  );
}

