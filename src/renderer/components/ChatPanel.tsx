import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare } from 'lucide-react';
import { MessageStream } from './MessageStream';
import type { Message, ActionLog } from '../../shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar' | 'window';
}

export function ChatPanel({ isOpen, onClose, variant = 'modal' }: Props) {
  // variant is reserved for future extensibility (sidebar, window modes)
  void variant;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const currentAssistantMessageRef = useRef<string>('');

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Setup stream listeners
  useEffect(() => {
    const unsubscribeChunk = window.electronAPI.onStreamChunk((chunk: string) => {
      currentAssistantMessageRef.current += chunk;

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant') {
          // Update existing assistant message
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: currentAssistantMessageRef.current },
          ];
        } else {
          // Create new assistant message
          const assistantMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: currentAssistantMessageRef.current,
            timestamp: new Date(),
          };
          return [...prev, assistantMessage];
        }
      });
    });

    const unsubscribeEnd = window.electronAPI.onStreamEnd((data) => {
      setIsLoading(false);
      currentAssistantMessageRef.current = '';

      if (data?.error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          error: data.error,
        }]);
      }
    });

    const unsubscribeActionLog = window.electronAPI.onActionLog((log: ActionLog) => {
      setActionLogs(prev => [...prev, log]);
    });

    return () => {
      unsubscribeChunk();
      unsubscribeEnd();
      unsubscribeActionLog();
    };
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputRef.current) {
      e.preventDefault();
      handleSend();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setIsLoading(true);
    currentAssistantMessageRef.current = '';

    try {
      await window.electronAPI.sendMessage(messageToSend);
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="bg-[color:var(--app-surface)] rounded-xl shadow-2xl w-[600px] max-h-[700px] overflow-hidden border border-[color:var(--app-border)] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[color:var(--app-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[color:var(--app-accent)]" />
                <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Quick Chat</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[color:var(--app-surface-2)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <MessageStream messages={messages} isLoading={isLoading} actionLogs={actionLogs} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[color:var(--app-border)]">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none rounded-lg bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]
                         placeholder-[color:var(--app-text-muted)] border border-[color:var(--app-border)]
                         focus:border-[color:var(--app-accent)] focus:ring-1 focus:ring-[color:var(--app-accent)]/20
                         p-3 min-h-[60px] max-h-[120px]"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2 rounded-lg bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent)]/80
                         disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
