import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, X, History, Square, Monitor, Plug, Trash2, Settings as SettingsIcon, Clock, Mic, Volume2, Brain, Minus, Maximize2, Expand } from 'lucide-react';
import { MessageStream } from './MessageStream';
import { MCPServersPanel } from './MCPServersPanel';
import { SettingsPanel } from './SettingsPanel';
import { ScheduledTasksPanel } from './ScheduledTasksPanel';
import { CanvasTab } from './CanvasTab';
import { useCopilot } from '../hooks/useCopilot';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { PermissionRequest, PermissionResponse, ActionLog, Settings } from '../../shared/types';

// Speech recognition error messages
const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'Microphone not found or not accessible.',
  'not-allowed': 'Microphone permission denied. Please allow microphone access.',
  'network': 'Network error. Please check your connection.',
  'aborted': 'Recording was cancelled.',
  'service-not-allowed': 'Speech recognition service is not allowed.',
};

// Minimum confidence threshold for accepting transcripts (0-1)
const CONFIDENCE_THRESHOLD = 0.5;

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
  const [showSettings, setShowSettings] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
  } = useCopilot();

  const userMessages = messages.filter(message => message.role === 'user');
  const assistantMessages = messages.filter(message => message.role !== 'user');

  // Track action logs from tool calls
  useEffect(() => {
    setActionLogs(prev => {
      const updated = [...prev];
      const logIds = new Set(updated.map(l => l.id));

      // Add or update logs from messages
      messages.forEach((message) => {
        if (message.toolCalls && message.toolCalls.length > 0) {
          message.toolCalls.forEach(toolCall => {
            const timestamp = new Date(message.timestamp);
            const timeStr = timestamp.toLocaleTimeString('en-US', { hour12: false });

            let status: ActionLog['status'] = 'success';
            if (toolCall.status === 'running') status = 'pending';
            else if (toolCall.status === 'error') status = 'error';
            else if (toolCall.status === 'pending') status = 'warning';

            const logId = `log-${toolCall.id}`;

            const toolDetails = (() => {
              if (toolCall.name === 'run_shell_command' && typeof toolCall.params?.command === 'string') {
                return `Command: ${toolCall.params.command}`;
              }
              if (toolCall.params && Object.keys(toolCall.params).length > 0) {
                return `Args: ${JSON.stringify(toolCall.params, null, 2)}`;
              }
              return undefined;
            })();

            // Create or update log entry
            const logEntry: ActionLog = {
              id: logId,
              timestamp: timeStr,
              createdAt: timestamp.getTime(),
              tool: toolCall.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              description: getToolDescription(toolCall.name),
              status,
              error: toolCall.error,
              details: toolDetails,
            };

            // Update existing log or add new one
            const existingIndex = updated.findIndex(l => l.id === logId);
            if (existingIndex >= 0) {
              updated[existingIndex] = logEntry;
            } else {
              updated.push(logEntry);
            }
            logIds.add(logId);
          });
        }
      });

      // Sort by timestamp (most recent first) and keep last 100
      return updated
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 100);
    });
  }, [messages]);

  // Helper function to get tool description
  const getToolDescription = (toolName: string): string => {
    const descriptions: Record<string, string> = {
      window_list: 'Listed open windows',
      window_focus: 'Focused window',
      window_minimize: 'Minimized window',
      window_maximize: 'Maximized window',
      window_close: 'Closed window',
      window_move: 'Moved window',
      window_arrange: 'Arranged windows',
      files_list: 'Listed files',
      files_read: 'Read file',
      files_write: 'Wrote file',
      files_delete: 'Deleted file',
      files_move: 'Moved file',
      files_copy: 'Copied file',
      files_search: 'Searched files',
      files_create_folder: 'Created folder',
      apps_launch: 'Launched application',
      apps_list: 'Listed applications',
      apps_quit: 'Quit application',
      system_info: 'Retrieved system info',
      system_volume: 'Adjusted volume',
      system_brightness: 'Adjusted brightness',
      system_screenshot: 'Took screenshot',
      clipboard_read: 'Read clipboard',
      clipboard_write: 'Wrote to clipboard',
      processes_list: 'Listed processes',
      processes_kill: 'Killed process',
    };
    return descriptions[toolName] || `Executed ${toolName}`;
  };

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Listen for permission requests from the main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onPermissionRequest((request) => {
      setPermissionRequest(request);
    });
    return unsubscribe;
  }, []);

  // Focus input when window is shown
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFocusInput(() => {
      inputRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  // Listen for action log events from tool executions
  useEffect(() => {
    const unsubscribe = window.electronAPI.onActionLog?.((log: ActionLog) => {
      console.log('Received action log:', log);
      setActionLogs(prev => {
        // Remove existing log with same ID if it exists
        const filtered = prev.filter(l => l.id !== log.id);
        // Add new log and sort by timestamp
        const updated = [...filtered, log]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 100); // Keep last 100
        return updated;
      });
    });

    return unsubscribe;
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load voice language and settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electronAPI.getSettings() as Settings | null;
        if (loadedSettings) {
          setSettings(loadedSettings);
          if (loadedSettings.voiceInput?.language) {
            setVoiceLanguage(loadedSettings.voiceInput.language);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Initialize speech recognition (only once, not on input change)
  useEffect(() => {
    // @ts-ignore - webkit prefix
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = voiceLanguage;

    // Speech detected - user started speaking
    recognition.onaudiostart = () => {
      setIsSpeechDetected(true);
    };

    // Speech recognition result
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0][0];
      const transcript = result.transcript;
      const confidence = result.confidence;

      console.log('Speech recognition result:', { transcript, confidence });

      // Filter by confidence threshold
      if (confidence < CONFIDENCE_THRESHOLD) {
        console.warn('Transcript confidence below threshold:', confidence);
        setVoiceError('Speech was unclear. Please try again.');
        clearVoiceError();
        return;
      }

      // Clear any previous errors
      setVoiceError(null);

      // Insert transcript at cursor position or append
      const textarea = inputRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Use ref to get current input value instead of closure
        const currentInput = textarea.value;
        const newText = currentInput.substring(0, start) + transcript + currentInput.substring(end);
        setInput(newText);

        // Set cursor after inserted text
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + transcript.length;
          textarea.focus();
        }, 0);
      }
    };

    // Speech recognition error
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      const errorMessage = SPEECH_ERROR_MESSAGES[event.error] || `Speech recognition error: ${event.error}`;
      setVoiceError(errorMessage);
      clearVoiceError();

      setIsRecording(false);
      setIsSpeechDetected(false);
    };

    // Speech recognition ended
    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsRecording(false);
      setIsSpeechDetected(false);
    };

    recognitionRef.current = recognition;

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (voiceErrorTimeoutRef.current) {
        clearTimeout(voiceErrorTimeoutRef.current);
      }
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [voiceLanguage]); // Only re-init when language changes

  // Update recognition language when voiceLanguage changes
  useEffect(() => {
    if (recognitionRef.current && recognitionRef.current.lang !== voiceLanguage) {
      recognitionRef.current.lang = voiceLanguage;
    }
  }, [voiceLanguage]);

  // Helper to clear voice error after a delay
  const clearVoiceError = useCallback(() => {
    if (voiceErrorTimeoutRef.current) {
      clearTimeout(voiceErrorTimeoutRef.current);
    }
    voiceErrorTimeoutRef.current = setTimeout(() => {
      setVoiceError(null);
    }, 3000);
  }, []);

  // Listen for voice events from main process
  useEffect(() => {
    const unsubscribeStart = window.electronAPI.onVoiceRecordingStarted(() => {
      console.log('Voice recording started from hotkey');
      setVoiceError(null); // Clear any previous errors
      setIsRecording(true);
      setIsSpeechDetected(false);

      // Clear any existing speech timeout
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }

      // Start browser speech recognition
      if (recognitionRef.current) {
        try {
          // Update language before starting
          recognitionRef.current.lang = voiceLanguage;
          recognitionRef.current.start();
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
          setIsRecording(false);

          // Check if error is "already started"
          if (err instanceof Error && err.message.includes('already started')) {
            setVoiceError('Recording already in progress');
          } else {
            setVoiceError('Failed to start speech recognition');
          }
          clearVoiceError();
        }
      } else {
        setVoiceError('Speech recognition not available');
        clearVoiceError();
      }
    });

    const unsubscribeStop = window.electronAPI.onVoiceRecordingStopped(() => {
      console.log('Voice recording stopped from hotkey');

      // Stop browser speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Failed to stop speech recognition:', err);
          // Force stop on error
          setIsRecording(false);
          setIsSpeechDetected(false);
        }
      }
    });

    const unsubscribeError = window.electronAPI.onVoiceError((error: string) => {
      console.error('Voice input error:', error);
      setIsRecording(false);
      setIsSpeechDetected(false);
      setVoiceError(error);
      clearVoiceError();
    });

    return () => {
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeError();
    };
  }, [voiceLanguage, clearVoiceError]);

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

  const respondPermission = (response: PermissionResponse) => {
    window.electronAPI.respondPermission(response);
    setPermissionRequest(null);
  };

  // Get display name for AI model
  const getModelDisplayName = (model?: string) => {
    if (!model) return 'GPT-5';
    if (model.startsWith('claude')) return model.replace('claude-', '').toUpperCase();
    if (model.startsWith('gpt')) return model.replace('gpt-', '').toUpperCase();
    return model;
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="relative h-full flex flex-col bg-gradient-to-br from-stone-950 to-stone-900 dark:from-stone-950 dark:to-stone-900 rounded-3xl shadow-2xl shadow-purple-500/10 border border-stone-800 dark:border-stone-800 overflow-hidden"
    >
      {/* Animated gradient border glow */}
      <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none
        bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-rose-500/20
        blur-xl animate-pulse-subtle" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
      {/* Recording indicator */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-full shadow-lg"
        >
          {isSpeechDetected ? (
            <Volume2 className="w-4 h-4 animate-pulse" />
          ) : (
            <Mic className="w-4 h-4 animate-pulse" />
          )}
          <span className="text-sm font-medium">
            {isSpeechDetected ? 'Capturing...' : 'Listening...'}
          </span>
        </motion.div>
      )}
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-4 border-b border-stone-800 dark:border-stone-800 bg-stone-900/50 dark:bg-stone-900/50">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-stone-100 dark:text-stone-100">
            Desktop Commander
          </span>
        </div>
        <div className="no-drag flex items-center gap-2">
          {/* AI Model Badge */}
          {settings?.agenticLoop?.model && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
              bg-purple-500/10 border border-purple-500/20 dark:bg-purple-500/10 dark:border-purple-500/20">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-300 dark:text-purple-300">
                {getModelDisplayName(settings.agenticLoop.model)}
              </span>
            </div>
          )}
          {/* Window Controls */}
          <button
            onClick={() => window.electronAPI.minimize()}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.electronAPI.maximize()}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.electronAPI.fitToScreen()}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Fit to Screen"
          >
            <Expand className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTasksPanel(true)}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Scheduled Tasks"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMcpPanel(true)}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="MCP Servers"
          >
            <Plug className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              clearMessages();
              setShowHistory(false);
            }}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="Clear Chat"
            disabled={isLoading || messages.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split View: Questions (Left) + Output (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Questions + Logs */}
        <div className="flex-1 flex flex-col border-r-2 border-stone-700 dark:border-stone-700 min-w-0">
          <div className="flex-1 min-h-0 flex flex-col">
            {userMessages.length === 0 && !showHistory ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <Monitor className="w-12 h-12 text-purple-500/50 mb-4" />
                <h2 className="text-lg font-medium text-stone-300 dark:text-stone-300 mb-2">
                  What would you like to do?
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-500 max-w-sm">
                  Control your desktop with natural language. Try "arrange my windows side by side" or "find large files in Downloads"
                </p>
              </div>
            ) : showHistory ? (
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-500 mb-3">
                  Recent Commands
                </h3>
                <div className="space-y-2">
                  {history.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistorySelect(item)}
                      className="w-full text-left p-3 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                    >
                      <p className="text-sm text-stone-700 dark:text-stone-300 truncate">
                        {item.input}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </button>
                  ))}
                  {history.length === 0 && (
                    <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
                      No history yet
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <MessageStream messages={userMessages} isLoading={false} actionLogs={actionLogs} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="flex-1 flex flex-col flex-shrink-0 min-w-0">
          <div className="px-4 py-3 border-b border-stone-800 dark:border-stone-800 bg-stone-900/50 dark:bg-stone-900/50">
            <h3 className="text-sm font-semibold text-stone-300 dark:text-stone-300">
              Output
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MessageStream messages={assistantMessages} isLoading={isLoading} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-5 border-t border-stone-800 dark:border-stone-800">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message, use / for commands..."
            rows={1}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-stone-900 dark:bg-stone-900
                     text-stone-100 dark:text-stone-100 placeholder-stone-500
                     border border-stone-700 dark:border-stone-700
                     focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20
                     resize-none transition-all"
            style={{ minHeight: '48px', maxHeight: '120px' }}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={cancelMessage}
                className="p-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition-colors"
                title="Cancel (Esc)"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-stone-700
                         disabled:cursor-not-allowed text-white transition-colors"
                title="Send (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Voice input errors */}
        {voiceError && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 text-sm text-rose-400 dark:text-rose-400"
          >
            <Mic className="w-3 h-3 inline mr-1" />
            {voiceError}
          </motion.p>
        )}

        {/* Copilot errors */}
        {error && !voiceError && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-rose-400 dark:text-rose-400"
          >
            {error}
          </motion.p>
        )}
      </div>
      </div>
      </motion.div>

      {/* MCP Servers Panel */}
      <MCPServersPanel isOpen={showMcpPanel} onClose={() => setShowMcpPanel(false)} />

      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Scheduled Tasks Panel */}
      <ScheduledTasksPanel isOpen={showTasksPanel} onClose={() => setShowTasksPanel(false)} />

      {/* Permission Dialog */}
      <ConfirmationDialog
        request={permissionRequest}
        onApprove={(options) => {
          if (!permissionRequest) return;
          respondPermission({ id: permissionRequest.id, allowed: true, options });
        }}
        onDeny={() => {
          if (!permissionRequest) return;
          respondPermission({ id: permissionRequest.id, allowed: false });
        }}
      />
    </>
  );
}
