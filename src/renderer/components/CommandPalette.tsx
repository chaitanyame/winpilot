import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, X, History, Square, Monitor, Plug, Trash2 } from 'lucide-react';
import { MessageStream } from './MessageStream';
import { MCPServersPanel } from './MCPServersPanel';
import { useCopilot } from '../hooks/useCopilot';

interface HistoryItem {
  id: string;
  input: string;
  timestamp: number;
}

export function CommandPalette() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
  } = useCopilot();

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Focus input when window is shown
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFocusInput(() => {
      inputRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await window.electronAPI.getHistory() as HistoryItem[];
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setShowHistory(false);
    
    await sendMessage(message);
    await loadHistory();
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      if (isLoading) {
        cancelMessage();
      } else {
        window.electronAPI.hide();
      }
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setInput(item.input);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    window.electronAPI.hide();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col bg-white/95 dark:bg-dark-900/95 glass rounded-xl shadow-2xl border border-dark-200/50 dark:border-dark-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-4 py-3 border-b border-dark-200/50 dark:border-dark-700/50">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary-500" />
          <span className="font-semibold text-dark-800 dark:text-dark-100">
            Desktop Commander
          </span>
        </div>
        <div className="no-drag flex items-center gap-1">
          <button
            onClick={() => setShowMcpPanel(true)}
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
            title="MCP Servers"
          >
            <Plug className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              clearMessages();
              setShowHistory(false);
            }}
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
            title="Clear Chat"
            disabled={isLoading || messages.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition-colors"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-dark-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !showHistory ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <Monitor className="w-12 h-12 text-primary-500/50 mb-4" />
            <h2 className="text-lg font-medium text-dark-700 dark:text-dark-300 mb-2">
              What would you like to do?
            </h2>
            <p className="text-sm text-dark-500 dark:text-dark-400 max-w-sm">
              Control your desktop with natural language. Try "arrange my windows side by side" or "find large files in Downloads"
            </p>
          </div>
        ) : showHistory ? (
          <div className="p-4">
            <h3 className="text-sm font-medium text-dark-500 dark:text-dark-400 mb-3">
              Recent Commands
            </h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleHistorySelect(item)}
                  className="w-full text-left p-3 rounded-lg bg-dark-50 dark:bg-dark-800 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <p className="text-sm text-dark-700 dark:text-dark-300 truncate">
                    {item.input}
                  </p>
                  <p className="text-xs text-dark-400 mt-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </button>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-dark-400 dark:text-dark-500 text-center py-4">
                  No history yet
                </p>
              )}
            </div>
          </div>
        ) : (
          <MessageStream messages={messages} isLoading={isLoading} />
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-200/50 dark:border-dark-700/50">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to do?"
            rows={1}
            className="w-full px-4 py-3 pr-24 rounded-xl bg-dark-50 dark:bg-dark-800 
                     text-dark-800 dark:text-dark-100 placeholder-dark-400
                     border border-dark-200 dark:border-dark-700
                     input-focus resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={cancelMessage}
                className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                title="Cancel (Esc)"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:bg-dark-300 
                         disabled:dark:bg-dark-600 text-white transition-colors disabled:cursor-not-allowed"
                title="Send (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
        
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-red-500 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* MCP Servers Panel */}
      <MCPServersPanel isOpen={showMcpPanel} onClose={() => setShowMcpPanel(false)} />
    </motion.div>
  );
}
