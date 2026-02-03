import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Trash2, Pin, Copy, Clock } from 'lucide-react';
import type { ClipboardEntry } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

export function ClipboardHistoryPanel({ isOpen, onClose, variant = 'modal' }: Props) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Debounce search for performance
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    }
  }, [isOpen]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.clipboardHistoryGet();
      setEntries(data || []);
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await window.electronAPI.clipboardHistoryRestore(id);
      // Close panel after restore
      onClose();
    } catch (error) {
      console.error('Failed to restore clipboard entry:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.clipboardHistoryDelete(id);
      await loadEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  const handlePin = async (id: string) => {
    try {
      await window.electronAPI.clipboardHistoryPin(id);
      await loadEntries();
    } catch (error) {
      console.error('Failed to pin entry:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all clipboard history (except pinned items)?')) return;
    try {
      await window.electronAPI.clipboardHistoryClear();
      await loadEntries();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!deferredQuery.trim()) return entries;
    const query = deferredQuery.toLowerCase();
    return entries.filter(e => e.content.toLowerCase().includes(query));
  }, [entries, deferredQuery]);

  // Group by pinned/unpinned
  const pinnedEntries = filteredEntries.filter(e => e.pinned);
  const unpinnedEntries = filteredEntries.filter(e => !e.pinned);

  if (!isOpen) return null;

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        <div className="px-5 py-4 border-b border-[color:var(--app-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-[color:var(--app-accent)]" />
            <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Clipboard History</h2>
            <span className="text-sm text-[color:var(--app-text-muted)]">({filteredEntries.length} items)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[color:var(--app-surface-2)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[color:var(--app-border)] flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--app-text-muted)]" />
            <input
              type="text"
              placeholder="Search clipboard history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]
                         placeholder-[color:var(--app-text-muted)] border border-[color:var(--app-border)]
                         focus:border-[color:var(--app-accent)] focus:ring-1 focus:ring-[color:var(--app-accent)]/20"
            />
          </div>
          <button
            onClick={handleClearAll}
            disabled={unpinnedEntries.length === 0}
            className="px-3 py-2 rounded-lg bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)]
                       disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[color:var(--app-text-muted)]">
              Loading...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[color:var(--app-text-muted)]">
              <Copy className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {entries.length === 0 ? 'No clipboard history yet' : 'No matching entries'}
              </p>
            </div>
          ) : (
            <>
              {pinnedEntries.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-[color:var(--app-text-muted)] uppercase mb-2 flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </h3>
                  <div className="space-y-2">
                    {pinnedEntries.map(entry => (
                      <ClipboardEntryItem
                        key={entry.id}
                        entry={entry}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onPin={handlePin}
                      />
                    ))}
                  </div>
                </div>
              )}

              {unpinnedEntries.length > 0 && (
                <div>
                  {pinnedEntries.length > 0 && (
                    <h3 className="text-xs font-semibold text-[color:var(--app-text-muted)] uppercase mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Recent
                    </h3>
                  )}
                  <div className="space-y-2">
                    {unpinnedEntries.map(entry => (
                      <ClipboardEntryItem
                        key={entry.id}
                        entry={entry}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onPin={handlePin}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

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
        className="bg-stone-950 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden border border-stone-800 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-stone-200">Clipboard History</h2>
            <span className="text-sm text-stone-500">({filteredEntries.length} items)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-stone-800 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Search clipboard history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-stone-900 text-stone-200 placeholder-stone-500 border border-stone-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
            />
          </div>
          <button
            onClick={handleClearAll}
            disabled={unpinnedEntries.length === 0}
            className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed text-stone-300 hover:text-stone-100 text-sm transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-stone-500">
              Loading...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-500">
              <Copy className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {entries.length === 0 ? 'No clipboard history yet' : 'No matching entries'}
              </p>
            </div>
          ) : (
            <>
              {/* Pinned Section */}
              {pinnedEntries.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase mb-2 flex items-center gap-1">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </h3>
                  <div className="space-y-2">
                    {pinnedEntries.map(entry => (
                      <ClipboardEntryItem
                        key={entry.id}
                        entry={entry}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onPin={handlePin}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unpinned Section */}
              {unpinnedEntries.length > 0 && (
                <div>
                  {pinnedEntries.length > 0 && (
                    <h3 className="text-xs font-semibold text-stone-400 uppercase mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Recent
                    </h3>
                  )}
                  <div className="space-y-2">
                    {unpinnedEntries.map(entry => (
                      <ClipboardEntryItem
                        key={entry.id}
                        entry={entry}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onPin={handlePin}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Individual clipboard entry component
function ClipboardEntryItem({ entry, onRestore, onDelete, onPin }: {
  entry: ClipboardEntry;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Truncate content for display
  const displayContent = entry.content.length > 200
    ? entry.content.slice(0, 200) + '...'
    : entry.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="group p-3 rounded-lg bg-stone-900/50 border border-stone-800 hover:border-stone-700 hover:bg-stone-900/80 transition-all cursor-pointer"
      onClick={() => onRestore(entry.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-200 break-words whitespace-pre-wrap font-mono">
            {displayContent}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
            <span>{formatTime(entry.timestamp)}</span>
            <span>•</span>
            <span>{formatSize(entry.size)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin(entry.id);
            }}
            className={`p-1.5 rounded hover:bg-stone-800 transition-colors ${
              entry.pinned ? 'text-purple-400' : 'text-stone-400 hover:text-purple-400'
            }`}
            title={entry.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.id);
            }}
            className="p-1.5 rounded hover:bg-rose-900/30 text-stone-400 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
