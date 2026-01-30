import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, ScrollText, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { ActionLog } from '../../shared/types';

interface CanvasTabProps {
  logs: ActionLog[];
  onClearAll?: () => void;
}

interface LogsFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onExport?: () => void;
  onClearAll?: () => void;
}

function LogsFilterBar({ query, onQueryChange, onExport, onClearAll }: LogsFilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 p-3 border-b border-stone-800 dark:border-stone-800">
      <Search className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" />
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="flex-1 px-2 py-1.5 rounded-md bg-stone-900 dark:bg-stone-900 text-stone-200 dark:text-stone-200
          placeholder-stone-500 border border-stone-700 focus:border-purple-500
          focus:ring-1 focus:ring-purple-500/20 text-xs min-w-0"
      />
      {onExport && (
        <button
          onClick={onExport}
          className="p-1.5 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700
          border border-stone-700 text-stone-400 hover:text-stone-200 dark:text-stone-400 dark:hover:text-stone-200"
          title="Export logs"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
      {onClearAll && (
        <button
          onClick={onClearAll}
          className="px-2 py-1.5 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700
          border border-stone-700 text-stone-400 hover:text-stone-200 dark:text-stone-400 dark:hover:text-stone-200 text-xs"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function ActionLogEntry({ log }: { log: ActionLog }) {
  const statusIcons = {
    success: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />,
    error: <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />,
    pending: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-3 rounded-lg bg-stone-800/50 dark:bg-stone-800/50 border border-stone-700/50 dark:border-stone-700/50
        hover:bg-stone-800/80 dark:hover:bg-stone-800/80 hover:border-stone-700 dark:hover:border-stone-700 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {statusIcons[log.status]}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-500">
                {log.timestamp}
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium
                bg-purple-500/10 text-purple-300 border border-purple-500/20 dark:border-purple-500/20">
                {log.tool}
              </span>
            </div>
            <p className="text-xs text-stone-200 dark:text-stone-200 break-words">{log.description}</p>
            {log.details && (
              <div className="mt-1.5 text-[10px] text-stone-400 dark:text-stone-400 font-mono whitespace-pre-wrap break-words">
                {log.details}
              </div>
            )}
            {log.error && (
              <div className="mt-1.5 text-[10px] text-rose-400 dark:text-rose-400 font-mono break-all">
                {log.error}
              </div>
            )}
          </div>
        </div>
        {log.duration !== undefined && (
          <div className="flex items-center text-[10px] text-stone-500 dark:text-stone-500 flex-shrink-0">
            <span>{log.duration}ms</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function CanvasTab({ logs, onClearAll }: CanvasTabProps) {
  const [query, setQuery] = useState('');

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const haystack = [
        log.tool,
        log.description,
        log.details,
        log.error,
        log.timestamp,
      ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query]);

  const handleExport = async () => {
    const suggestedName = `desktop-commander-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const res = await window.electronAPI.exportActionLogs({ logs: filteredLogs, suggestedName });
    if (!res.success && res.error) {
      // Keep this lightweight; renderer already has toast/notification infra.
      // eslint-disable-next-line no-alert
      alert(`Failed to export logs: ${res.error}`);
    }
  };

  const handleClearAll = () => {
    setQuery('');
    onClearAll?.();
  };

  return (
    <div className="flex flex-col h-full">
      <LogsFilterBar
        query={query}
        onQueryChange={setQuery}
        onExport={handleExport}
        onClearAll={onClearAll ? handleClearAll : undefined}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full
            text-stone-500 dark:text-stone-500 px-4 text-center">
            <ScrollText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">{logs.length === 0 ? 'No action logs yet' : 'No matching logs'}</p>
            <p className="text-[10px] mt-1">
              {logs.length === 0 ? 'Actions will appear here as you use the app' : 'Try a different search term'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredLogs.map(log => (
              <ActionLogEntry key={log.id} log={log} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
