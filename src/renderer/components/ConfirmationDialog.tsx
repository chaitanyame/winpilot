import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PermissionRequest } from '../../shared/types';

interface Props {
  request: PermissionRequest | null;
  onApprove: (options?: Record<string, unknown>) => void;
  onDeny: () => void;
}

export function ConfirmationDialog({ request, onApprove, onDeny }: Props) {
  const [moveToTrash, setMoveToTrash] = useState(true);

  useEffect(() => {
    // Reset per-request state
    setMoveToTrash(true);
  }, [request?.id]);

  if (!request) return null;

  const isDangerous = request.level === 'dangerous';
  const isDelete = request.tool === 'files.delete';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onDeny}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className={`px-6 py-4 flex items-center gap-3 ${
            isDangerous 
              ? 'bg-red-50 dark:bg-red-900/20' 
              : 'bg-amber-50 dark:bg-amber-900/20'
          }`}>
            <div className={`p-2 rounded-full ${
              isDangerous
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                isDangerous
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-dark-800 dark:text-dark-100">
                Confirmation Required
              </h3>
              <p className="text-sm text-dark-500 dark:text-dark-400">
                {isDangerous ? 'This action may be destructive' : 'Please review this action'}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <p className="text-dark-700 dark:text-dark-300 mb-4">
              The assistant wants to:
            </p>
            
            <div className="p-4 rounded-lg bg-dark-50 dark:bg-dark-700/50 mb-4">
              <p className="font-medium text-dark-800 dark:text-dark-200">
                {request.description}
              </p>
              
              {request.details && request.details.length > 0 && (
                <div className="mt-3 space-y-1">
                  {request.details.slice(0, 5).map((detail, i) => (
                    <p key={i} className="text-sm text-dark-600 dark:text-dark-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-dark-400" />
                      {detail}
                    </p>
                  ))}
                  {request.details.length > 5 && (
                    <p className="text-sm text-dark-500 dark:text-dark-500 italic">
                      ... and {request.details.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Options for delete operations */}
            {isDelete && (
              <div className="mb-4 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moveToTrash}
                    onChange={(e) => setMoveToTrash(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-600 dark:text-dark-400">
                    Move to Trash (safer)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-dark-50 dark:bg-dark-900/50 flex gap-3 justify-end">
            <button
              onClick={onDeny}
              className="px-4 py-2 rounded-lg border border-dark-300 dark:border-dark-600 
                       text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 
                       transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApprove(isDelete ? { moveToTrash } : undefined)}
              className={`px-4 py-2 rounded-lg text-white transition-colors flex items-center gap-2 ${
                isDangerous
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-primary-500 hover:bg-primary-600'
              }`}
            >
              <Check className="w-4 h-4" />
              {isDangerous ? 'Allow Anyway' : 'Allow'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
