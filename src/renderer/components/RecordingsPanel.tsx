import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Trash2, Play, FolderOpen, Video, Mic, Camera, Circle, Square, Clock, HardDrive } from 'lucide-react';
import { Recording, RecordingStatus, RecordingType } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

export function RecordingsPanel({ isOpen, onClose, variant = 'modal' }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Debounce search for performance
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (isOpen) {
      loadRecordings();
      // Subscribe to recording updates
      window.electronAPI.subscribeToRecordings();
    }
  }, [isOpen]);

  // Listen for recording updates
  useEffect(() => {
    if (!isOpen) return;

    const unsubProgress = window.electronAPI.onRecordingProgress((recording) => {
      setRecordings(prev => {
        const idx = prev.findIndex(r => r.id === recording.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = recording;
          return updated;
        }
        return [...prev, recording];
      });
    });

    const unsubUpdated = window.electronAPI.onRecordingUpdated((recording) => {
      setRecordings(prev => {
        const idx = prev.findIndex(r => r.id === recording.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = recording;
          return updated;
        }
        return [...prev, recording];
      });
    });

    return () => {
      unsubProgress();
      unsubUpdated();
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadRecordings = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.recordingList();
      setRecordings(data || []);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (recording: Recording) => {
    try {
      await window.electronAPI.recordingOpen(recording.outputPath);
    } catch (error) {
      console.error('Failed to open recording:', error);
    }
  };

  const handleOpenFolder = async (recording: Recording) => {
    try {
      await window.electronAPI.recordingOpenFolder(recording.outputPath);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.recordingDelete(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await window.electronAPI.recordingStop(id);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Filter recordings based on search
  const filteredRecordings = useMemo(() => {
    if (!deferredQuery.trim()) return recordings;
    const query = deferredQuery.toLowerCase();
    return recordings.filter(r => r.filename.toLowerCase().includes(query));
  }, [recordings, deferredQuery]);

  // Group recordings by status
  const activeRecordings = filteredRecordings.filter(
    r => r.status === RecordingStatus.RECORDING || r.status === RecordingStatus.STOPPING
  );
  const completedRecordings = filteredRecordings.filter(
    r => r.status === RecordingStatus.COMPLETED
  );
  const failedRecordings = filteredRecordings.filter(
    r => r.status === RecordingStatus.ERROR
  );

  if (!isOpen) return null;

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        <div className="px-5 py-4 border-b border-[color:var(--app-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Recordings</h2>
            <span className="text-sm text-[color:var(--app-text-muted)]">({filteredRecordings.length} items)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[color:var(--app-surface-2)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[color:var(--app-border)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--app-text-muted)]" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]
                         placeholder-[color:var(--app-text-muted)] border border-[color:var(--app-border)]
                         focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[color:var(--app-text-muted)]">
              Loading...
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[color:var(--app-text-muted)]">
              <Video className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {recordings.length === 0 ? 'No recordings yet' : 'No matching recordings'}
              </p>
              <p className="text-xs text-[color:var(--app-text-muted)] mt-1">
                Use "start screen recording" to create one
              </p>
            </div>
          ) : (
            <>
              {activeRecordings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-red-400 uppercase mb-2 flex items-center gap-1">
                    <Circle className="w-3 h-3 fill-red-500 animate-pulse" />
                    Recording Now ({activeRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {activeRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {completedRecordings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-[color:var(--app-text-muted)] uppercase mb-2 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Completed ({completedRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {completedRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {failedRecordings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-rose-400 uppercase mb-2 flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Failed ({failedRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {failedRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
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
            <Video className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-stone-200">Recordings</h2>
            <span className="text-sm text-stone-500">({filteredRecordings.length} items)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-stone-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-stone-900 text-stone-200 placeholder-stone-500 border border-stone-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-stone-500">
              Loading...
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-500">
              <Video className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">
                {recordings.length === 0 ? 'No recordings yet' : 'No matching recordings'}
              </p>
              <p className="text-xs text-stone-600 mt-1">
                Use "start screen recording" to create one
              </p>
            </div>
          ) : (
            <>
              {/* Active Recordings Section */}
              {activeRecordings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-red-400 uppercase mb-2 flex items-center gap-1">
                    <Circle className="w-3 h-3 fill-red-500 animate-pulse" />
                    Recording Now ({activeRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {activeRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Recordings Section */}
              {completedRecordings.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase mb-2 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Completed ({completedRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {completedRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Recordings Section */}
              {failedRecordings.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-rose-400 uppercase mb-2 flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Failed ({failedRecordings.length})
                  </h3>
                  <div className="space-y-2">
                    {failedRecordings.map(recording => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        onPlay={handlePlay}
                        onOpenFolder={handleOpenFolder}
                        onDelete={(id) => setDeleteConfirmId(id)}
                        onStop={handleStop}
                        isDeleteConfirm={deleteConfirmId === recording.id}
                        onDeleteConfirm={handleDelete}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
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

// Individual recording item component
function RecordingItem({
  recording,
  onPlay,
  onOpenFolder,
  onDelete,
  onStop,
  isDeleteConfirm,
  onDeleteConfirm,
  onDeleteCancel
}: {
  recording: Recording;
  onPlay: (recording: Recording) => void;
  onOpenFolder: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onStop: (id: string) => void;
  isDeleteConfirm: boolean;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}) {
  const isActive = recording.status === RecordingStatus.RECORDING || recording.status === RecordingStatus.STOPPING;
  const isFailed = recording.status === RecordingStatus.ERROR;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 2880) return 'Yesterday';
    return new Date(timestamp).toLocaleDateString();
  };

  const getTypeIcon = () => {
    switch (recording.type) {
      case RecordingType.SCREEN:
        return <Video className="w-4 h-4" />;
      case RecordingType.AUDIO:
        return <Mic className="w-4 h-4" />;
      case RecordingType.WEBCAM:
        return <Camera className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group p-3 rounded-lg border transition-all ${
        isActive
          ? 'bg-red-950/30 border-red-800/50 hover:border-red-700'
          : isFailed
          ? 'bg-rose-950/20 border-rose-800/30 hover:border-rose-700'
          : 'bg-stone-900/50 border-stone-800 hover:border-stone-700 hover:bg-stone-900/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Type Icon */}
          <div className={`p-2 rounded-lg ${
            isActive
              ? 'bg-red-500/20 text-red-400'
              : isFailed
              ? 'bg-rose-500/20 text-rose-400'
              : 'bg-stone-800 text-stone-400'
          }`}>
            {isActive && <Circle className="w-4 h-4 fill-red-500 animate-pulse" />}
            {!isActive && getTypeIcon()}
          </div>

          {/* Recording Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-200 font-medium truncate">
              {recording.filename}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 flex-wrap">
              {isActive ? (
                <>
                  <span className="text-red-400 font-medium">
                    {recording.status === RecordingStatus.STOPPING ? 'Stopping...' : 'Recording...'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(recording.duration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    {formatSize(recording.fileSize)}
                  </span>
                </>
              ) : isFailed ? (
                <span className="text-rose-400">{recording.error || 'Recording failed'}</span>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(recording.duration)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    {formatSize(recording.fileSize)}
                  </span>
                  <span>•</span>
                  <span>{formatRelativeTime(recording.endTime || recording.startTime)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isActive ? (
            <button
              onClick={() => onStop(recording.id)}
              disabled={recording.status === RecordingStatus.STOPPING}
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          ) : isDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDeleteConfirm(recording.id)}
                className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white text-xs transition-colors"
              >
                Delete
              </button>
              <button
                onClick={onDeleteCancel}
                className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isFailed && (
                <>
                  <button
                    onClick={() => onPlay(recording)}
                    className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-green-400 transition-colors"
                    title="Play"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenFolder(recording)}
                    className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-blue-400 transition-colors"
                    title="Open Folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(recording.id)}
                className="p-1.5 rounded hover:bg-rose-900/30 text-stone-400 hover:text-rose-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
