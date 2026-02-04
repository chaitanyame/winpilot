import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, X, History, Square, Monitor, Plug, Trash2, Settings as SettingsIcon, Clock, Mic, MicOff, Volume2, Brain, Minus, Maximize2, ScrollText, Copy, Video, Loader2, Sparkles, ChevronRight, ChevronLeft, Shield } from 'lucide-react';
import { MessageStream } from './MessageStream';
import { MCPServersPanel } from './MCPServersPanel';
import { SettingsPanel } from './SettingsPanel';
import { ScheduledTasksPanel } from './ScheduledTasksPanel';
import { ActionLogsPanel } from './ActionLogsPanel';
import { ClipboardHistoryPanel } from './ClipboardHistoryPanel';
import { RecordingsPanel } from './RecordingsPanel';
import { ScreenSharePrivacyPanel } from './ScreenSharePrivacyPanel';
import { useCopilot } from '../hooks/useCopilot';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { PermissionRequest, PermissionResponse, ActionLog, Settings, ActiveWindowContext } from '../../shared/types';

// Speech recognition error messages
const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'Microphone not found or not accessible.',
  'not-allowed': 'Microphone permission denied. Please allow microphone access.',
  'network': 'Web Speech API not available in Electron. Please switch to OpenAI Whisper in Settings → Voice.',
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

interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
}

// Tool descriptions mapping - moved outside component for performance
const TOOL_DESCRIPTIONS: Record<string, string> = {
  window_list: 'Listed open windows',
  window_focus: 'Focused window',
  window_minimize: 'Minimized window',
  window_maximize: 'Maximized window',
  window_close: 'Closed window',
  window_move: 'Moved window',
  window_arrange: 'Arranged windows',
  window_hide_from_sharing: 'Hid window from sharing',
  window_show_in_sharing: 'Showed window in sharing',
  window_list_hidden: 'Listed hidden windows',
  window_hide_all_sensitive: 'Hid sensitive windows',
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
  apps_switch: 'Switched application',
  system_volume: 'Adjusted volume',
  system_brightness: 'Adjusted brightness',
  system_screenshot: 'Took screenshot',
  system_dnd: 'Toggled Do Not Disturb',
  system_lock: 'Locked system',
  system_sleep: 'Put system to sleep',
  system_wifi: 'Toggled WiFi',
  system_info: 'Retrieved system info',
  network_info: 'Retrieved network info',
  network_test: 'Tested network',
  productivity_timer: 'Started timer',
  productivity_countdown: 'Started countdown',
  productivity_pomodoro: 'Started Pomodoro',
  productivity_worldclock: 'Checked world clock',
  productivity_convert: 'Converted units',
  set_reminder: 'Set reminder',
  list_reminders: 'Listed reminders',
  cancel_reminder: 'Cancelled reminder',
  run_shell_command: 'Executed shell command',
  process_list: 'Listed processes',
  process_info: 'Retrieved process info',
  process_kill: 'Killed process',
  process_top: 'Showed top processes',
  clipboard_read: 'Read clipboard',
  clipboard_write: 'Wrote to clipboard',
  clipboard_clear: 'Cleared clipboard',
  office_create: 'Created Office document',
  powerpoint_create: 'Created PowerPoint',
  service_list: 'Listed services',
  service_control: 'Controlled service',
  web_search: 'Searched the web',
  troubleshoot_start: 'Started troubleshooting',
  troubleshoot_propose_fix: 'Proposed fix',
};

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'clean-desktop',
    title: 'Clean up my desktop',
    prompt: 'Clean up my desktop: move files into a folder named "Desktop Cleanup" and close unused windows.',
  },
  {
    id: 'focus-mode',
    title: 'Start focus mode',
    prompt: 'Start focus mode: enable Do Not Disturb, set volume to 20%, and open my task list app.',
  },
  {
    id: 'meeting-ready',
    title: 'Prepare for a meeting',
    prompt: 'Prepare for a meeting: open calendar, launch Zoom, and mute system notifications.',
  },
  {
    id: 'find-downloads',
    title: 'Find large downloads',
    prompt: 'Find large files in Downloads from the last 7 days and list them.',
  },
  {
    id: 'battery-saver',
    title: 'Battery saver setup',
    prompt: 'Enable battery saver: reduce brightness to 40% and close background apps.',
  },
  {
    id: 'organize-windows',
    title: 'Arrange my windows',
    prompt: 'Arrange my windows: browser on the left half and editor on the right half.',
  },
];

const ONBOARDING_PROMPTS = PROMPT_TEMPLATES.slice(0, 5);

const getToolDescription = (toolName: string): string => TOOL_DESCRIPTIONS[toolName] || toolName;

export function CommandPalette() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [showClipboardPanel, setShowClipboardPanel] = useState(false);
  const [showRecordingsPanel, setShowRecordingsPanel] = useState(false);
  const [showScreenSharePrivacyPanel, setShowScreenSharePrivacyPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [actionLogsClearedAt, setActionLogsClearedAt] = useState(0);
  const [activeContext, setActiveContext] = useState<ActiveWindowContext | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceProviderRef = useRef<'browser' | 'openai_whisper' | 'local_whisper'>('local_whisper');
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

  // Track action logs from tool calls - optimized to only process new tool calls
  // Memoize the action logs computation to avoid expensive recalculation
  const actionLogs = useMemo(() => {
    const messagesWithTools = messages.filter(m => m.toolCalls && m.toolCalls.length > 0);
    if (messagesWithTools.length === 0) return [];

    const logMap = new Map<string, ActionLog>();

    messagesWithTools.forEach((message) => {
      message.toolCalls!.forEach(toolCall => {
        const logId = `log-${toolCall.id}`;
        const timestamp = new Date(message.timestamp);
        const timeStr = timestamp.toLocaleTimeString('en-US', { hour12: false });

        let status: ActionLog['status'] = 'success';
        if (toolCall.status === 'running') status = 'pending';
        else if (toolCall.status === 'error') status = 'error';
        else if (toolCall.status === 'pending') status = 'warning';

        const toolDetails = (() => {
          if (toolCall.name === 'run_shell_command' && typeof toolCall.params?.command === 'string') {
            return `Command: ${toolCall.params.command}`;
          }
          if (toolCall.params && Object.keys(toolCall.params).length > 0) {
            return `Args: ${JSON.stringify(toolCall.params, null, 2)}`;
          }
          return undefined;
        })();

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

        logMap.set(logId, logEntry);
      });
    });

    // Convert map to array, sort, and limit
    return Array.from(logMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
  }, [messages]);

  const insertTranscript = useCallback((transcript: string) => {
    const text = transcript.trim();
    if (!text) return;

    const textarea = inputRef.current;
    if (!textarea) {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentInput = textarea.value;
    const newText = currentInput.substring(0, start) + text + currentInput.substring(end);
    setInput(newText);

    // Move cursor to end of inserted text.
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  }, []);

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

  // Open specific panels when requested from tray/menu
  useEffect(() => {
    const unsubSettings = window.electronAPI.onOpenSettings(() => {
      setShowSettings(true);
      setShowHistory(false);
    });

    const unsubHistory = window.electronAPI.onOpenHistory(() => {
      setShowHistory(true);
      setShowSettings(false);
      setShowTasksPanel(false);
      setShowMcpPanel(false);
      setShowLogsPanel(false);
      setShowClipboardPanel(false);
      setShowRecordingsPanel(false);
      setShowScreenSharePrivacyPanel(false);
      void loadHistory();
      inputRef.current?.focus();
    });

    return () => {
      unsubSettings();
      unsubHistory();
    };
  }, []);

  // Listen for action log events from tool executions
  // Note: These logs come from IPC and add to the computed logs.
  // Since actionLogs is now a useMemo, we need a separate state for IPC logs.
  const [ipcActionLogs, setIpcActionLogs] = useState<ActionLog[]>([]);
  
  useEffect(() => {
    const unsubscribe = window.electronAPI.onActionLog?.((log: ActionLog) => {
      console.log('Received action log:', log);
      setIpcActionLogs(prev => {
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

  // Merge computed logs with IPC logs
  const allActionLogs = useMemo(() => {
    const merged = new Map<string, ActionLog>();
    for (const log of actionLogs) merged.set(log.id, log);
    for (const log of ipcActionLogs) merged.set(log.id, log);
    return Array.from(merged.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
  }, [actionLogs, ipcActionLogs]);

  const visibleActionLogs = useMemo(
    () => actionLogsClearedAt > 0
      ? allActionLogs.filter(l => l.createdAt >= actionLogsClearedAt)
      : allActionLogs,
    [allActionLogs, actionLogsClearedAt]
  );

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
          if (!loadedSettings.ui?.onboardingSeen) {
            setShowOnboarding(true);
          }
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

  // Load active window context on mount
  useEffect(() => {
    const loadContext = async () => {
      try {
        const context = await window.electronAPI.getActiveContext();
        setActiveContext(context);
      } catch (err) {
        console.error('Failed to load active context:', err);
      }
    };
    loadContext();
  }, []);

  const markOnboardingSeen = useCallback(async () => {
    if (!settings) {
      setShowOnboarding(false);
      return;
    }
    const updatedSettings = {
      ...settings,
      ui: {
        ...settings.ui,
        onboardingSeen: true,
      },
    };
    try {
      await window.electronAPI.setSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to update onboarding state:', err);
    } finally {
      setShowOnboarding(false);
    }
  }, [settings]);

  const applyTemplate = useCallback((template: PromptTemplate) => {
    setInput(template.prompt);

    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  // Helper to clear voice error after a delay
  const clearVoiceError = useCallback(() => {
    if (voiceErrorTimeoutRef.current) {
      clearTimeout(voiceErrorTimeoutRef.current);
    }
    voiceErrorTimeoutRef.current = setTimeout(() => {
      setVoiceError(null);
    }, 3000);
  }, []);

  // Initialize speech recognition (only for browser provider)
  useEffect(() => {
    // Skip browser speech recognition if not using browser provider
    // This prevents the error handlers from interfering with other providers
    if (settings?.voiceInput?.provider && settings.voiceInput.provider !== 'browser') {
      console.log('Skipping browser speech recognition - using provider:', settings.voiceInput.provider);
      return;
    }

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
      insertTranscript(transcript);
    };

    // Speech recognition error
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      const errorMessage = SPEECH_ERROR_MESSAGES[event.error] || `Speech recognition error: ${event.error}`;
      setVoiceError(errorMessage);
      clearVoiceError();

      setIsRecording(false);
      setIsSpeechDetected(false);
      setIsTranscribing(false);
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
    };

    // Speech recognition ended
    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsRecording(false);
      setIsSpeechDetected(false);
      setIsTranscribing(false);
      // Reset voice input state when recognition ends automatically
      if (voiceInputManagerActiveRef.current) {
        voiceInputManagerActiveRef.current = false;
        // Give a short delay before allowing auto-hide to let UI update
        setTimeout(() => {
          window.electronAPI.setAutoHideSuppressed(false);
        }, 500);
      }
    };

    recognitionRef.current = recognition;

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [voiceLanguage, insertTranscript, clearVoiceError, settings?.voiceInput?.provider]); // Re-init when language or provider changes

  // Update recognition language when voiceLanguage changes
  useEffect(() => {
    if (recognitionRef.current && recognitionRef.current.lang !== voiceLanguage) {
      recognitionRef.current.lang = voiceLanguage;
    }
  }, [voiceLanguage]);

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }
  }, []);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSamplesRef = useRef<Float32Array[]>([]);
  const voiceInputManagerActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Ensure timers/streams are cleaned up when the component unmounts.
  useEffect(() => {
    const voiceTimeout = voiceErrorTimeoutRef.current;
    const speechTimeout = speechTimeoutRef.current;
    return () => {
      if (voiceTimeout) clearTimeout(voiceTimeout);
      if (speechTimeout) clearTimeout(speechTimeout);
      if (audioProcessorRef.current) {
        try { audioProcessorRef.current.disconnect(); } catch {}
        audioProcessorRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      audioSamplesRef.current = [];
      audioChunksRef.current = [];
      cleanupMediaStream();
    };
  }, [cleanupMediaStream]);

  const startWhisperRecording = useCallback(async () => {
    try {
      console.log('[Voice] startWhisperRecording called');
      
      // If we're already recording, don't restart.
      if (mediaRecorderRef.current) {
        console.log('[Voice] Already recording, skipping');
        return;
      }

      // Suppress auto-hide BEFORE requesting microphone
      window.electronAPI.setAutoHideSuppressed(true);
      console.log('[Voice] Requesting microphone access with MediaRecorder...');

      // Use MediaRecorder API directly - it's more stable than ScriptProcessor
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      
      console.log('[Voice] Got media stream');
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      
      // Create MediaRecorder with webm/opus format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onerror = (e: Event) => {
        console.error('[Voice] MediaRecorder error:', e);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      
      // Use audioContextRef as flag that we're recording
      audioContextRef.current = {} as AudioContext;
      
      setIsSpeechDetected(true);

      // Restore window visibility
      console.log('[Voice] Restoring window visibility...');
      window.electronAPI.setAutoHideSuppressed(true);
      window.electronAPI.show();
      console.log('[Voice] Recording started successfully with MediaRecorder');
    } catch (err) {
      console.error('Failed to start whisper.cpp recording:', err);
      setVoiceError('Failed to access microphone for whisper.cpp transcription.');
      clearVoiceError();
      setIsRecording(false);
      setIsSpeechDetected(false);
      setIsTranscribing(false);
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
      cleanupMediaStream();
    }
  }, [clearVoiceError, cleanupMediaStream]);

  const stopWhisperRecordingAndTranscribe = useCallback(async () => {
    try {
      setIsSpeechDetected(false);
      setIsTranscribing(true);

      console.log('[Voice] Stopping MediaRecorder...');
      
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        throw new Error('No active recording');
      }
      
      // Wait for the final data
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });
      
      console.log('[Voice] Got', audioChunksRef.current.length, 'audio chunks');
      
      // Combine all chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      console.log('[Voice] Audio blob size:', audioBlob.size, 'bytes');
      
      // Clear our recording state
      mediaRecorderRef.current = null;
      audioContextRef.current = null;
      audioChunksRef.current = [];

      // Convert blob to ArrayBuffer and send for transcription
      const arrayBuffer = await audioBlob.arrayBuffer();
      const language = (voiceLanguage || 'en-US').split('-')[0];

      console.log('[Voice] Sending audio for transcription...');
      const res = await window.electronAPI.voiceTranscribe({
        audio: arrayBuffer,
        mimeType: 'audio/webm',
        language,
      });

      if (res.success && res.transcript) {
        insertTranscript(res.transcript);
      } else if (!res.success) {
        setVoiceError(res.error || 'Whisper transcription failed.');
        clearVoiceError();
      }
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
    } catch (err) {
      console.error('Whisper transcription failed:', err);
      setVoiceError('Whisper transcription failed.');
      clearVoiceError();
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
    } finally {
      setIsRecording(false);
      setIsSpeechDetected(false);
      setIsTranscribing(false);
      audioSamplesRef.current = [];
      audioChunksRef.current = [];
      cleanupMediaStream();
    }
  }, [clearVoiceError, cleanupMediaStream, insertTranscript, voiceLanguage]);

  // Listen for voice events from main process
  useEffect(() => {
    const unsubscribeStart = window.electronAPI.onVoiceRecordingStarted(() => {
      window.electronAPI.setAutoHideSuppressed(true);
      voiceInputManagerActiveRef.current = true;
      void (async () => {
        console.log('Voice recording started from hotkey');
        setVoiceError(null); // Clear any previous errors
        setIsRecording(true);
        setIsTranscribing(false);
        setIsSpeechDetected(false);
        window.electronAPI.setAutoHideSuppressed(true);

        // Pull latest settings so provider switches apply without restarting.
        try {
          const loadedSettings = await window.electronAPI.getSettings() as Settings | null;
          if (loadedSettings) {
            setSettings(loadedSettings);
            if (loadedSettings.voiceInput?.language) setVoiceLanguage(loadedSettings.voiceInput.language);
            voiceProviderRef.current = loadedSettings.voiceInput?.provider || 'local_whisper';
          } else {
            voiceProviderRef.current = 'local_whisper';
          }
        } catch {
          voiceProviderRef.current = 'local_whisper';
        }

        // Clear any existing speech timeout
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
        }

        if (voiceProviderRef.current === 'openai_whisper' || voiceProviderRef.current === 'local_whisper') {
          await startWhisperRecording();
          return;
        }

        // Start browser speech recognition
        if (recognitionRef.current) {
          try {
            // Update language before starting
            recognitionRef.current.lang = voiceLanguage;
            recognitionRef.current.start();
            
            // Restore window after speech recognition starts (OS may steal focus)
            setTimeout(() => {
              window.electronAPI.setAutoHideSuppressed(true);
              window.electronAPI.show();
            }, 150);
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
      })();
    });

    const unsubscribeStop = window.electronAPI.onVoiceRecordingStopped(() => {
      window.electronAPI.setAutoHideSuppressed(true);
      voiceInputManagerActiveRef.current = true;
      void (async () => {
        console.log('Voice recording stopped from hotkey');
        window.electronAPI.setAutoHideSuppressed(true);

        if (voiceProviderRef.current === 'openai_whisper' || voiceProviderRef.current === 'local_whisper') {
          await stopWhisperRecordingAndTranscribe();
          return;
        }

        // Stop browser speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (err) {
            console.error('Failed to stop speech recognition:', err);
            // Force stop on error
            setIsRecording(false);
            setIsSpeechDetected(false);
            setIsTranscribing(false);
            voiceInputManagerActiveRef.current = false;
            window.electronAPI.setAutoHideSuppressed(false);
          }
        } else {
          voiceInputManagerActiveRef.current = false;
          window.electronAPI.setAutoHideSuppressed(false);
        }
      })();
    });

    const unsubscribeError = window.electronAPI.onVoiceError((error: string) => {
      console.error('Voice input error:', error);
      setIsRecording(false);
      setIsSpeechDetected(false);
      setIsTranscribing(false);
      window.electronAPI.setAutoHideSuppressed(false);
      setVoiceError(error);
      clearVoiceError();
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
    });

    return () => {
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeError();
    };
  }, [voiceLanguage, clearVoiceError, startWhisperRecording, stopWhisperRecordingAndTranscribe]);

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

  // Suppress auto-hide on mouse down (before blur fires)
  const handleMicMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Suppress auto-hide BEFORE blur can fire
    window.electronAPI.setAutoHideSuppressed(true);
  }, []);

  // Handle mic button click to toggle voice recording
  const handleMicClick = useCallback(async () => {
    // Check if voice input is enabled in settings
    if (!settings?.voiceInput?.enabled) {
      setVoiceError('Voice input is disabled. Enable it in Settings → Voice.');
      clearVoiceError();
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
      return;
    }

    // Check if browser supports speech recognition (for browser provider)
    // @ts-ignore - webkit prefix
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isBrowserProvider = voiceProviderRef.current === 'browser';
    
    if (isBrowserProvider && !SpeechRecognition) {
      setVoiceError('Speech recognition not supported in this browser.');
      clearVoiceError();
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
      return;
    }

    // Toggle recording using IPC (same as hotkey)
    try {
      voiceInputManagerActiveRef.current = true;
      await window.electronAPI.voiceTest();
    } catch (err) {
      console.error('Failed to toggle voice recording:', err);
      voiceInputManagerActiveRef.current = false;
      window.electronAPI.setAutoHideSuppressed(false);
      setVoiceError('Failed to toggle voice recording');
      clearVoiceError();
    }
  }, [settings, clearVoiceError]);

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

  const voiceProvider = settings?.voiceInput?.provider || 'browser';
  const recordingLabel = isTranscribing
    ? 'Transcribing...'
    : isSpeechDetected
      ? 'Capturing...'
      : voiceProvider === 'openai_whisper'
        ? 'Recording...'
        : 'Listening...';

  return (
    <>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="relative h-full flex flex-col rounded-3xl shadow-2xl border overflow-hidden
                 bg-[color:var(--app-surface)] text-[color:var(--app-text)]
                 border-[color:var(--app-border)]"
    >
      {/* Animated gradient border glow - animations removed for performance */}
      <div className="absolute inset-0 rounded-3xl opacity-20 pointer-events-none
        bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_55%)]" />

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
          {isTranscribing ? (
            <Brain className="w-4 h-4 animate-pulse" />
          ) : isSpeechDetected ? (
            <Volume2 className="w-4 h-4 animate-pulse" />
          ) : (
            <Mic className="w-4 h-4 animate-pulse" />
          )}
          <span className="text-sm font-medium">{recordingLabel}</span>
        </motion.div>
      )}
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-4 border-b
                      border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-[color:var(--app-accent)]" />
          <span className="font-semibold text-[color:var(--app-text)]">
            WinPilot
          </span>
        </div>
        <div className="no-drag flex items-center gap-2">
          {/* Context Awareness Badge */}
          {activeContext && settings?.contextAwareness?.showContextBadge && (
            <div className="context-badge">
              <span className="context-app-name">{activeContext.appName}</span>
              {activeContext.windowTitle && (
                <span className="context-window-title" title={activeContext.windowTitle}>
                  {activeContext.windowTitle}
                </span>
              )}
              {activeContext.selectedText && (
                <span className="context-has-selection" title="Selected text captured">
                  <span className="selection-indicator">text</span>
                </span>
              )}
              <button
                className="clear-context-btn"
                onClick={async () => {
                  try {
                    await window.electronAPI.clearActiveContext();
                    setActiveContext(null);
                  } catch (err) {
                    console.error('Failed to clear context:', err);
                  }
                }}
                title="Clear captured context"
                aria-label="Clear captured context"
              >
                ×
              </button>
            </div>
          )}
          {/* AI Model Badge */}
          {settings?.agenticLoop?.model && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
              bg-[color:var(--app-accent-soft)] border border-[color:var(--app-border)]">
              <Brain className="w-3.5 h-3.5 text-[color:var(--app-accent)]" />
              <span className="text-xs font-medium text-[color:var(--app-text)]">
                {getModelDisplayName(settings.agenticLoop.model)}
              </span>
            </div>
          )}
          <button
            onClick={() => window.electronAPI.minimize()}
            className="p-2 rounded-lg transition-colors
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)]"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.electronAPI.maximize()}
            className="p-2 rounded-lg transition-colors
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)]"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors
                       text-[color:var(--app-text-muted)] hover:text-rose-600
                       hover:bg-rose-100"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split View: Questions (Left) + Output (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Expandable Sidebar */}
        <div className={`no-drag flex flex-col py-4 border-r transition-all duration-200 overflow-y-auto
                        border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]
                        ${sidebarExpanded ? 'w-44 px-3' : 'w-12 px-2 items-center'}`}>
          
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`p-2 rounded-lg transition-colors mb-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'self-end' : ''}`}
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Chat Section */}
          {sidebarExpanded && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)] mb-2 px-2">
              Chat
            </div>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="History"
          >
            <History className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">History</span>}
          </button>
          <button
            onClick={() => {
              clearMessages();
              setShowHistory(false);
            }}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}
                       disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Clear Chat"
            disabled={isLoading || messages.length === 0}
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Clear Chat</span>}
          </button>

          <div className={`h-px bg-[color:var(--app-border)] my-3 ${sidebarExpanded ? 'w-full' : 'w-6'}`} />

          {/* Tools Section */}
          {sidebarExpanded && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)] mb-2 px-2">
              Tools
            </div>
          )}
          <button
            onClick={() => setShowTasksPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Scheduled Tasks"
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Scheduled Tasks</span>}
          </button>
          <button
            onClick={() => setShowMcpPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="MCP Servers"
          >
            <Plug className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">MCP Servers</span>}
          </button>

          <div className={`h-px bg-[color:var(--app-border)] my-3 ${sidebarExpanded ? 'w-full' : 'w-6'}`} />

          {/* Data Section */}
          {sidebarExpanded && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)] mb-2 px-2">
              Data
            </div>
          )}
          <button
            onClick={() => setShowClipboardPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Clipboard History"
          >
            <Copy className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Clipboard</span>}
          </button>
          <button
            onClick={() => setShowRecordingsPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Recordings"
          >
            <Video className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Recordings</span>}
          </button>
          <button
            onClick={() => setShowScreenSharePrivacyPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Screen Share Privacy"
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Privacy</span>}
          </button>
          <button
            onClick={() => setShowLogsPanel(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Action Logs"
          >
            <ScrollText className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Action Logs</span>}
          </button>

          {/* Spacer to push settings to bottom */}
          <div className="flex-1" />

          <div className={`h-px bg-[color:var(--app-border)] my-3 ${sidebarExpanded ? 'w-full' : 'w-6'}`} />

          {/* App Section */}
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-3
                       text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]
                       hover:bg-[color:var(--app-surface)] ${sidebarExpanded ? 'w-full' : ''}`}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm">Settings</span>}
          </button>
        </div>
        {/* Conversation Panel - Unified Q&A */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 flex flex-col">
            {showOnboarding ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-full max-w-lg rounded-2xl bg-[color:var(--app-surface)] p-6 shadow-lg border border-[color:var(--app-border)]">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-[color:var(--app-accent)]" />
                    <h3 className="text-lg font-semibold text-[color:var(--app-text)]">Welcome to WinPilot</h3>
                  </div>
                  <p className="text-sm text-[color:var(--app-text-muted)] mb-4">
                    Try one of these quick prompts to get started:
                  </p>
                  <div className="space-y-2 text-left">
                    {ONBOARDING_PROMPTS.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="w-full text-left p-3 rounded-lg transition-colors
                                   bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)]"
                      >
                        <p className="text-sm font-medium text-[color:var(--app-text)]">
                          {template.title}
                        </p>
                        <p className="text-xs text-[color:var(--app-text-muted)] mt-1 line-clamp-2">
                          {template.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={markOnboardingSeen}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-[color:var(--app-accent-contrast)]
                                 bg-[color:var(--app-accent)] hover:opacity-90"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              </div>
            ) : messages.length === 0 && !showHistory ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[color:var(--app-accent)]" />
                  <h3 className="text-sm font-medium text-[color:var(--app-text-muted)]">
                    Quick Templates
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {PROMPT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="text-left p-4 rounded-xl transition-all transform hover:scale-[1.02]
                                 bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)]
                                 border border-[color:var(--app-border)] hover:border-[color:var(--app-accent)]/30
                                 shadow-sm hover:shadow-md"
                    >
                      <p className="text-sm font-semibold text-[color:var(--app-text)] mb-1">
                        {template.title}
                      </p>
                      <p className="text-xs text-[color:var(--app-text-muted)] line-clamp-2">
                        {template.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : showHistory ? (
              <div className="flex-1 overflow-y-auto p-4">
                <h3 className="text-sm font-medium text-[color:var(--app-text-muted)] mb-3">
                  Recent Commands
                </h3>
                <div className="space-y-2">
                  {history.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistorySelect(item)}
                      className="w-full text-left p-3 rounded-lg transition-colors
                                 bg-[color:var(--app-surface-2)] hover:bg-[color:var(--app-surface)]"
                    >
                      <p className="text-sm text-[color:var(--app-text)] truncate">
                        {item.input}
                      </p>
                      <p className="text-xs text-[color:var(--app-text-muted)] mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </button>
                  ))}
                  {history.length === 0 && (
                    <p className="text-sm text-[color:var(--app-text-muted)] text-center py-4">
                      No history yet
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <MessageStream messages={messages} isLoading={isLoading} actionLogs={visibleActionLogs} />
              </div>
            )}
          </div>
        </div>

        {/* Modals rendered here */}
      </div>

      {/* Input */}
      <div className="p-5 border-t border-[color:var(--app-border)]">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message, use / for commands..."
            rows={1}
            className="w-full px-4 py-3 pr-12 rounded-xl resize-none transition-all
                     bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]
                     placeholder-[color:var(--app-text-muted)]
                     border border-[color:var(--app-border)]
                     focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:var(--app-accent)]/20"
            style={{ minHeight: '48px', maxHeight: '120px' }}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Mic button for voice input */}
            {!isLoading && (
              <button
                type="button"
                onMouseDown={handleMicMouseDown}
                onClick={handleMicClick}
                disabled={!settings?.voiceInput?.enabled}
                className={`p-2 rounded-lg transition-colors ${
                  !settings?.voiceInput?.enabled
                    ? 'text-[color:var(--app-text-muted)]/50 cursor-not-allowed'
                    : isTranscribing
                    ? 'text-green-500 hover:text-green-600'
                    : isRecording
                    ? 'text-red-500 animate-pulse'
                    : 'text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)]'
                }`}
                title={
                  !settings?.voiceInput?.enabled
                    ? 'Voice input disabled (enable in Settings)'
                    : isTranscribing
                    ? 'Transcribing...'
                    : isRecording
                    ? 'Click to stop recording (or use hotkey)'
                    : `Click to start recording (or use ${settings?.voiceInput?.hotkey || 'Ctrl+Shift+V'})`
                }
              >
                {!settings?.voiceInput?.enabled ? (
                  <MicOff className="w-4 h-4" />
                ) : isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            )}
            
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
                className="p-2 rounded-lg text-[color:var(--app-accent-contrast)]
                         bg-[color:var(--app-accent)] hover:opacity-90
                         disabled:bg-[color:var(--app-border)] disabled:text-[color:var(--app-text-muted)]
                         disabled:cursor-not-allowed transition-colors"
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

      {/* Modal Panels */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <MCPServersPanel
        isOpen={showMcpPanel}
        onClose={() => setShowMcpPanel(false)}
      />

      <ScheduledTasksPanel
        isOpen={showTasksPanel}
        onClose={() => setShowTasksPanel(false)}
      />

      <ActionLogsPanel
        isOpen={showLogsPanel}
        onClose={() => setShowLogsPanel(false)}
        logs={visibleActionLogs}
        onClearAll={() => setActionLogsClearedAt(Date.now())}
      />

      <ClipboardHistoryPanel
        isOpen={showClipboardPanel}
        onClose={() => setShowClipboardPanel(false)}
      />

      <RecordingsPanel
        isOpen={showRecordingsPanel}
        onClose={() => setShowRecordingsPanel(false)}
      />

      <ScreenSharePrivacyPanel
        isOpen={showScreenSharePrivacyPanel}
        onClose={() => setShowScreenSharePrivacyPanel(false)}
      />
    </>
  );
}
