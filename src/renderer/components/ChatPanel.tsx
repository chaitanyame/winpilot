import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare } from 'lucide-react';
import { MessageStream } from './MessageStream';
import { executeSlashCommand, getSlashCommandSuggestions, type SlashCommand } from '../slash-commands';
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
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommand[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

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

  const loadConversation = useCallback(async (conversationId: string | null) => {
    try {
      const data = await window.electronAPI.chatGetHistory(conversationId ?? undefined) as Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        tool_calls?: string | null;
        created_at: number;
      }>;
      const mapped = (data || [])
        .sort((a, b) => a.created_at - b.created_at)
        .map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          timestamp: new Date(item.created_at),
        }));
      setMessages(mapped);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
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

    // Check for slash commands first
    if (input.trim().startsWith('/')) {
      const slashContext = {
        api: window.electronAPI,
        addSystemMessage: (content: string) => {
          setMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            role: 'assistant' as const,
            content,
            timestamp: new Date(),
          }]);
        },
        switchPanel: () => {},
        conversationId: null,
      };

      const result = await executeSlashCommand(input, slashContext);
      if (result) {
        if (result.message === '__CLEAR__') {
          setMessages([]);
        } else if (result.conversationId) {
          await loadConversation(result.conversationId);
        } else if (result.message) {
          slashContext.addSystemMessage(result.message);
        }
        setInput('');
        setSlashSuggestions([]);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setSlashSuggestions([]);
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
              <div className="relative flex gap-2">
                {/* Slash command autocomplete */}
                {slashSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border overflow-hidden z-50
                                  bg-[color:var(--app-surface-2)] border-[color:var(--app-border)] shadow-lg max-h-[200px] overflow-y-auto">
                    {slashSuggestions.map((cmd, i) => (
                      <div
                        key={cmd.name}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors
                          ${i === selectedSuggestionIndex
                            ? 'bg-[color:var(--app-accent)]/10'
                            : 'hover:bg-[color:var(--app-surface)]'}`}
                        onClick={() => {
                          setInput(`/${cmd.name} `);
                          setSlashSuggestions([]);
                          inputRef.current?.focus();
                        }}
                      >
                        <span className="font-mono font-semibold text-[color:var(--app-text)]">/{cmd.name}</span>
                        {cmd.args && <span className="font-mono text-xs text-[color:var(--app-text-muted)]">{cmd.args}</span>}
                        <span className="ml-auto text-xs text-[color:var(--app-text-muted)]">{cmd.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInput(value);
                    if (value.startsWith('/')) {
                      const suggestions = getSlashCommandSuggestions(value);
                      setSlashSuggestions(suggestions);
                      setSelectedSuggestionIndex(0);
                    } else {
                      setSlashSuggestions([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Slash command autocomplete navigation
                    if (slashSuggestions.length > 0) {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const selected = slashSuggestions[selectedSuggestionIndex];
                        setInput(`/${selected.name} `);
                        setSlashSuggestions([]);
                        return;
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedSuggestionIndex(i => Math.min(i + 1, slashSuggestions.length - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSuggestionIndex(i => Math.max(i - 1, 0));
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setSlashSuggestions([]);
                        return;
                      }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message, use / for commands..."
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
