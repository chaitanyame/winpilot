import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Shield, X, RefreshCw } from 'lucide-react';
import type { HiddenWindow, WindowInfo } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

export function ScreenSharePrivacyPanel({ isOpen, onClose, variant = 'modal' }: Props) {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [hidden, setHidden] = useState<HiddenWindow[]>([]);
  const [autoHide, setAutoHide] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen]);

  const load = async () => {
    try {
      setLoading(true);
      const [winData, hiddenData, autoHideValue] = await Promise.all([
        window.electronAPI.screenSharePrivacyListWindows(),
        window.electronAPI.screenSharePrivacyListHidden(),
        window.electronAPI.screenSharePrivacyGetAutoHide(),
      ]);
      setWindows(winData || []);
      setHidden(hiddenData || []);
      setAutoHide(autoHideValue);
    } catch (error) {
      console.error('Failed to load screen share privacy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hiddenSet = useMemo(() => new Set(hidden.map(h => h.hwnd)), [hidden]);

  const handleToggle = async (windowId: string, currentlyHidden: boolean) => {
    try {
      if (currentlyHidden) {
        await window.electronAPI.screenSharePrivacyShow(windowId);
      } else {
        await window.electronAPI.screenSharePrivacyHide(windowId);
      }
      await load();
    } catch (error) {
      console.error('Failed to toggle window privacy:', error);
    }
  };

  const handleAutoHideToggle = async (value: boolean) => {
    try {
      const updated = await window.electronAPI.screenSharePrivacySetAutoHide(value);
      setAutoHide(updated);
    } catch (error) {
      console.error('Failed to update auto-hide setting:', error);
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      <div className="px-5 py-4 border-b border-[color:var(--app-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[color:var(--app-accent)]" />
          <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Screen Share Privacy</h2>
          <span className="text-sm text-[color:var(--app-text-muted)]">({windows.length} windows)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[color:var(--app-border)]
                       bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] transition-colors text-sm font-medium"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[color:var(--app-surface-2)] text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-[color:var(--app-border)]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoHide}
            onChange={(e) => handleAutoHideToggle(e.target.checked)}
            className="w-4 h-4 rounded border-dark-300 text-primary-500"
          />
          <span className="text-sm text-[color:var(--app-text-muted)]">
            Auto-hide WinPilot when screen sharing starts
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--app-border)]">
        <div className="text-sm text-[color:var(--app-text-muted)]">
          Hidden windows: {hidden.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-sm text-[color:var(--app-text-muted)]">Loading...</div>
        ) : windows.length === 0 ? (
          <div className="text-sm text-[color:var(--app-text-muted)]">No windows found.</div>
        ) : (
          windows.map(windowInfo => {
            const currentlyHidden = hiddenSet.has(windowInfo.id) || windowInfo.isHiddenFromCapture;
            return (
              <div
                key={windowInfo.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[color:var(--app-surface-2)]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[color:var(--app-text)] truncate">
                    {windowInfo.title}
                  </div>
                  <div className="text-xs text-[color:var(--app-text-muted)] truncate">
                    {windowInfo.app}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(windowInfo.id, currentlyHidden)}
                  className={`p-2 rounded-lg transition-colors ${
                    currentlyHidden
                      ? 'text-rose-400 hover:text-rose-300'
                      : 'text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]'
                  }`}
                  title={currentlyHidden ? 'Show in sharing' : 'Hide from sharing'}
                >
                  {currentlyHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-8 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[color:var(--app-surface)] rounded-xl shadow-2xl w-[640px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] overflow-hidden border border-[color:var(--app-border)] flex flex-col"
      >
        {content}
      </motion.div>
    </motion.div>
  );
}
