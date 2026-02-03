import { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Trash2, Pin, Copy, Clock, Image, File, Folder } from 'lucide-react';
import type { ClipboardEntry, TextClipboardEntry, ImageClipboardEntry, FilesClipboardEntry } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar' | 'window';
}

export function ClipboardHistoryPanel({ isOpen, onClose, variant = 'modal' }: Props) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Debounce search for performance
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
      setFocusedIndex(0);
    }
  }, [isOpen]);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.clipboardHistoryGet();
      console.log('[UI] Loaded entries:', data?.length, 'entries');
      console.log('[UI] Entry types:', data?.map(e => e.type).join(', '));
      setEntries(data || []);

      // Load thumbnails for image entries
      const imageEntries = (data || []).filter((e): e is ImageClipboardEntry => e.type === 'image');
      console.log('[UI] Found', imageEntries.length, 'image entries');
      for (const entry of imageEntries) {
        console.log('[UI] Image entry:', entry.id, 'thumbnailPath:', entry.thumbnailPath);
        if (!thumbnailCache[entry.thumbnailPath]) {
          loadThumbnail(entry.thumbnailPath);
        }
      }
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadThumbnail = async (thumbnailPath: string) => {
    try {
      console.log('[UI] Loading thumbnail:', thumbnailPath);
      const dataUrl = await window.electronAPI.clipboardHistoryGetImage(thumbnailPath);
      console.log('[UI] Got dataUrl:', dataUrl ? `${dataUrl.substring(0, 50)}... (${dataUrl.length} chars)` : 'null');
      if (dataUrl) {
        setThumbnailCache(prev => ({ ...prev, [thumbnailPath]: dataUrl }));
      }
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
    }
  };

  const handlePasteItem = async (entry: ClipboardEntry) => {
    try {
      await window.electronAPI.pasteClipboardItem(entry.id);
    } catch (error) {
      console.error('Failed to paste clipboard item:', error);
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
    return entries.filter(e => {
      switch (e.type) {
        case 'text':
          return e.content.toLowerCase().includes(query);
        case 'image':
          return `image ${e.width}x${e.height}`.toLowerCase().includes(query);
        case 'files':
          return e.files.some(f => f.name.toLowerCase().includes(query));
        default:
          return false;
      }
    });
  }, [entries, deferredQuery]);

  // Group by pinned/unpinned
  const pinnedEntries = filteredEntries.filter(e => e.pinned);
  const unpinnedEntries = filteredEntries.filter(e => !e.pinned);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && activeElement.tagName === 'INPUT') {
          return;
        }
      }
      const totalItems = filteredEntries.length;
      if (totalItems === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, totalItems - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(totalItems - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredEntries[focusedIndex]) {
            handlePasteItem(filteredEntries[focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredEntries, focusedIndex, onClose]);

  // Reset focus when filtered entries change
  useEffect(() => {
    if (focusedIndex >= filteredEntries.length) {
      setFocusedIndex(Math.max(0, filteredEntries.length - 1));
    }
  }, [filteredEntries, focusedIndex]);

  // Scroll focused item into view
  useEffect(() => {
    if (!isOpen || !listContainerRef.current) return;
    const target = listContainerRef.current.querySelector(
      `[data-entry-index="${focusedIndex}"]`
    ) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, filteredEntries, isOpen]);

  if (!isOpen) return null;

  const renderContent = () => (
    <>
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
                {pinnedEntries.map(entry => {
                  const entryIndex = filteredEntries.indexOf(entry);
                  return (
                    <ClipboardEntryItem
                      key={entry.id}
                      entry={entry}
                      onDelete={handleDelete}
                      onPin={handlePin}
                      onPaste={handlePasteItem}
                      isFocused={entryIndex === focusedIndex}
                      index={entryIndex}
                      thumbnailCache={thumbnailCache}
                    />
                  );
                })}
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
                {unpinnedEntries.map(entry => {
                  const entryIndex = filteredEntries.indexOf(entry);
                  return (
                    <ClipboardEntryItem
                      key={entry.id}
                      entry={entry}
                      onDelete={handleDelete}
                      onPin={handlePin}
                      onPaste={handlePasteItem}
                      isFocused={entryIndex === focusedIndex}
                      index={entryIndex}
                      thumbnailCache={thumbnailCache}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  if (variant === 'window') {
    return (
      <div className="h-full w-full bg-[color:var(--app-surface)] flex flex-col min-h-0">
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

        <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {renderContent()}
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col min-h-0">
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

        <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {renderContent()}
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
        className="bg-[color:var(--app-surface)] rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden border border-[color:var(--app-border)] max-h-[80vh] flex flex-col min-h-0"
      >
        {/* Header */}
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

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-[color:var(--app-border)] flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--app-text-muted)]" />
            <input
              type="text"
              placeholder="Search clipboard history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] placeholder-[color:var(--app-text-muted)] border border-[color:var(--app-border)] focus:border-[color:var(--app-accent)] focus:ring-1 focus:ring-[color:var(--app-accent)]/20"
            />
          </div>
          <button
            onClick={handleClearAll}
            disabled={unpinnedEntries.length === 0}
            className="px-3 py-2 rounded-lg bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)] disabled:opacity-50 disabled:cursor-not-allowed text-[color:var(--app-text)] text-sm transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Content */}
        <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Individual clipboard entry component
function ClipboardEntryItem({ entry, onDelete, onPin, onPaste, isFocused, index, thumbnailCache }: {
  entry: ClipboardEntry;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onPaste: (entry: ClipboardEntry) => void;
  isFocused: boolean;
  index: number;
  thumbnailCache: Record<string, string>;
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

  const renderContent = () => {
    switch (entry.type) {
      case 'text':
        return <TextEntryContent entry={entry} isFocused={isFocused} />;
      case 'image':
        return <ImageEntryContent entry={entry} isFocused={isFocused} thumbnailCache={thumbnailCache} />;
      case 'files':
        return <FilesEntryContent entry={entry} isFocused={isFocused} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      data-entry-index={index}
      className={`group p-3 rounded-lg border transition-all cursor-pointer ${
        isFocused
          ? 'bg-[color:var(--app-accent)] border-[color:var(--app-accent)] ring-2 ring-[color:var(--app-accent)]/50'
          : 'bg-[color:var(--app-surface-2)]/50 border-[color:var(--app-border)] hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-2)]'
      }`}
      onClick={() => onPaste(entry)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {renderContent()}
          <div className={`flex items-center gap-2 mt-2 text-xs ${
            isFocused ? 'text-white/80' : 'text-[color:var(--app-text-muted)]'
          }`}>
            <span>{formatTime(entry.timestamp)}</span>
            <span>-</span>
            <span>{formatSize(entry.size)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin(entry.id);
            }}
            className={`p-1.5 rounded hover:bg-[color:var(--app-surface-2)] transition-colors ${
              entry.pinned ? 'text-[color:var(--app-accent)]' : 'text-[color:var(--app-text-muted)] hover:text-[color:var(--app-accent)]'
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
            className="p-1.5 rounded hover:bg-red-500/20 text-[color:var(--app-text-muted)] hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Text entry content
function TextEntryContent({ entry, isFocused }: { entry: TextClipboardEntry; isFocused: boolean }) {
  const displayContent = entry.content.length > 200
    ? entry.content.slice(0, 200) + '...'
    : entry.content;

  return (
    <p className={`text-sm break-words whitespace-pre-wrap font-mono line-clamp-2 ${
      isFocused ? 'text-white font-semibold' : 'text-[color:var(--app-text)]'
    }`}>
      {displayContent}
    </p>
  );
}

// Image entry content
function ImageEntryContent({ entry, isFocused, thumbnailCache }: {
  entry: ImageClipboardEntry;
  isFocused: boolean;
  thumbnailCache: Record<string, string>;
}) {
  const thumbnailUrl = thumbnailCache[entry.thumbnailPath];

  return (
    <div className="flex items-start gap-3">
      <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border ${
        isFocused ? 'border-white/50' : 'border-[color:var(--app-border)]'
      } bg-[color:var(--app-surface-2)]`}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Clipboard image"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className={`w-6 h-6 ${isFocused ? 'text-white/70' : 'text-[color:var(--app-text-muted)]'}`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-2 text-sm ${
          isFocused ? 'text-white font-semibold' : 'text-[color:var(--app-text)]'
        }`}>
          <Image className="w-4 h-4" />
          <span>Image</span>
        </div>
        <p className={`text-xs mt-1 ${isFocused ? 'text-white/70' : 'text-[color:var(--app-text-muted)]'}`}>
          {entry.width} x {entry.height} - {entry.format.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// Files entry content
function FilesEntryContent({ entry, isFocused }: { entry: FilesClipboardEntry; isFocused: boolean }) {
  const maxDisplay = 3;
  const displayFiles = entry.files.slice(0, maxDisplay);
  const remaining = entry.files.length - maxDisplay;

  const getFileIcon = (file: { isDirectory: boolean; extension: string }) => {
    if (file.isDirectory) return <Folder className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-2 text-sm ${
        isFocused ? 'text-white font-semibold' : 'text-stone-200'
      }`}>
        <File className="w-4 h-4" />
        <span>{entry.files.length} file{entry.files.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-0.5">
        {displayFiles.map((file, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 text-xs ${
              isFocused ? 'text-purple-100' : 'text-stone-400'
            }`}
          >
            {getFileIcon(file)}
            <span className="truncate">{file.name}</span>
          </div>
        ))}
        {remaining > 0 && (
          <p className={`text-xs ${isFocused ? 'text-purple-200' : 'text-stone-500'}`}>
            +{remaining} more
          </p>
        )}
      </div>
    </div>
  );
}
