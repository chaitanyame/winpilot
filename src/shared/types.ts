// Shared types used across the application

// Permission levels for tools
export enum PermissionLevel {
  READ_ONLY = 'read_only',
  STANDARD = 'standard',
  SENSITIVE = 'sensitive',
  DANGEROUS = 'dangerous',
}

// Window information
export interface WindowInfo {
  id: string;
  title: string;
  app: string;
  processId: number;
  bounds: Bounds;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  isHiddenFromCapture: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Active Window Context
export interface ActiveWindowContext {
  appName: string;        // e.g., "chrome", "Code", "explorer"
  windowTitle: string;    // e.g., "GitHub - Google Chrome"
  processId?: number;
  selectedText?: string;  // Optional: captured via clipboard trick
  capturedAt: number;     // Timestamp
}

// File system types
export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  created: Date;
  modified: Date;
  extension?: string;
}

export interface FileFilter {
  extension?: string[];
  nameContains?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  sizeGreaterThan?: number;
  sizeLessThan?: number;
}

// Application types
export interface AppInfo {
  name: string;
  path: string;
  isRunning: boolean;
  processId?: number;
  icon?: string;
}

// Process types
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}

// System types
export interface SystemInfo {
  platform: 'windows' | 'macos' | 'linux';
  volume: number;
  brightness: number;
  wifi: {
    enabled: boolean;
    connected: boolean;
    network?: string;
  };
  bluetooth: {
    enabled: boolean;
  };
  dnd: boolean;
}

// Detailed system information
export interface SystemInfoData {
  cpu: { name: string; cores: number; usagePercent: number; speedMHz: number };
  memory: { totalGB: number; usedGB: number; usagePercent: number };
  disk: Array<{ drive: string; totalGB: number; freeGB: number; usagePercent: number }>;
  os: { name: string; version: string; build: string; architecture: string };
  uptime: { days: number; hours: number; minutes: number; formatted: string };
  battery?: { chargePercent: number; isCharging: boolean; isPresent: boolean };
}

// Network information
export interface NetworkInfoData {
  hostname: string;
  interfaces: Array<{ name: string; type: string; status: string; ipv4?: string; mac: string }>;
  wifi?: { ssid: string; signalStrength: number; channel: number };
  primaryDns: string[];
}

// Network test result
export interface NetworkTestResult {
  test: 'ping' | 'dns' | 'connectivity';
  success: boolean;
  details: Record<string, unknown>;
}

// Service information
export interface ServiceInfo {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'paused';
  startupType: 'automatic' | 'manual' | 'disabled';
  description?: string;
}

// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

// Permission request
export interface PermissionRequest {
  id: string;
  tool: string;
  description: string;
  level: PermissionLevel;
  params: Record<string, unknown>;
  details?: string[];
}

export interface PermissionResponse {
  id: string;
  allowed: boolean;
  options?: Record<string, unknown>;
}

// Appearance settings
export type AppearanceMode = 'light' | 'dark' | 'system';
export type ThemeId = 'twitter' | 'claude' | 'neo-brutalism' | 'retro-arcade' | 'aurora' | 'business';

// Notes
export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

// Todos
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;
  updated_at: number;
}

// Settings
export interface Settings {
  hotkey: string;
  appearanceMode: AppearanceMode;
  themeId: ThemeId;
  screenSharePrivacy: {
    autoHideOnShare: boolean;
  };
  permissions: {
    defaultLevel: PermissionLevel;
    rememberChoices: boolean;
    requireConfirmFor: string[];
  };
  tools: {
    enabled: string[];
    disabled: string[];
  };
  ui: {
    showInTray: boolean;
    floatingWindow: boolean;
    toastNotifications: boolean;
    menuBarMode: boolean;
    onboardingSeen: boolean;
  };
  safety: {
    maxFilesPerOperation: number;
    protectedPaths: string[];
    requireConfirmAbove: number;
  };
  agenticLoop: AgenticLoopConfig;
  notifications: {
    enabled: boolean;
    useNative: boolean;
    useToast: boolean;
    toastDuration: number;
    sound: boolean;
  };
  scheduledTasks: {
    enabled: boolean;
    maxConcurrent: number;
  };
  voiceInput: {
    enabled: boolean;
    hotkey: string;
    provider: 'browser' | 'openai_whisper' | 'local_whisper';
    openaiWhisper: {
      /** OpenAI API key for Whisper API. */
      apiKey: string;
      /** Model name (default: whisper-1). */
      model: string;
    };
    localWhisper: {
      /** Model size: tiny, base, small, medium, large */
      modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    };
    language: string;
    showVisualFeedback: boolean;
    /** Auto-paste transcription after voice-to-clipboard (Ctrl+Shift+W) */
    autoPasteOnTranscribe?: boolean;
  };
  recording: {
    /** Output folder for recordings. Empty string means app directory. */
    outputPath: string;
    /** Preferred audio input device name for recordings */
    preferredAudioDevice?: string;
    /** Preferred video input device name for recordings */
    preferredVideoDevice?: string;
  };
  hotkeys: {
    /** Hotkey to open clipboard history (default: Ctrl+Shift+H) */
    clipboardHistory: string;
    /** Hotkey for speech-to-text transcription only (default: Ctrl+Shift+T) */
    voiceTranscribe: string;
    /** Hotkey for speech-to-command execution (default: Ctrl+Shift+G) */
    voiceCommand: string;
    /** Hotkey to open the chat panel (default: Ctrl+Shift+C) */
    chat: string;
    /** Hotkey to start/stop audio recording (default: Ctrl+Shift+A) */
    audioRecording: string;
    /** Hotkey to start/stop video recording (default: Ctrl+Shift+R) */
    videoRecording: string;
  };
  contextAwareness: {
    enabled: boolean;
    captureSelectedText: boolean;
    showContextBadge: boolean;
    injectionStyle: 'visible' | 'hidden';  // visible = prepend to message, hidden = system prompt
  };
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Window management
  WINDOW_LIST: 'window:list',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_MOVE: 'window:move',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_ARRANGE: 'window:arrange',

  // File operations
  FILES_LIST: 'files:list',
  FILES_SEARCH: 'files:search',
  FILES_MOVE: 'files:move',
  FILES_COPY: 'files:copy',
  FILES_DELETE: 'files:delete',
  FILES_RENAME: 'files:rename',
  FILES_CREATE_FOLDER: 'files:createFolder',
  FILES_READ: 'files:read',
  FILES_INFO: 'files:info',

  // Applications
  APPS_LIST: 'apps:list',
  APPS_LAUNCH: 'apps:launch',
  APPS_QUIT: 'apps:quit',
  APPS_SWITCH: 'apps:switch',

  // System
  SYSTEM_VOLUME: 'system:volume',
  SYSTEM_BRIGHTNESS: 'system:brightness',
  SYSTEM_SCREENSHOT: 'system:screenshot',
  SYSTEM_DND: 'system:dnd',
  SYSTEM_LOCK: 'system:lock',
  SYSTEM_SLEEP: 'system:sleep',

  // Process
  PROCESS_LIST: 'process:list',
  PROCESS_INFO: 'process:info',
  PROCESS_KILL: 'process:kill',
  PROCESS_TOP: 'process:top',

  // Clipboard
  CLIPBOARD_READ: 'clipboard:read',
  CLIPBOARD_WRITE: 'clipboard:write',
  CLIPBOARD_CLEAR: 'clipboard:clear',

  // Clipboard History
  CLIPBOARD_HISTORY_GET: 'clipboard:history:get',
  CLIPBOARD_HISTORY_DELETE: 'clipboard:history:delete',
  CLIPBOARD_HISTORY_CLEAR: 'clipboard:history:clear',
  CLIPBOARD_HISTORY_PIN: 'clipboard:history:pin',
  CLIPBOARD_HISTORY_RESTORE: 'clipboard:history:restore',
  CLIPBOARD_HISTORY_SEARCH: 'clipboard:history:search',
  CLIPBOARD_HISTORY_GET_IMAGE: 'clipboard:history:getImage',

  // App control
  APP_TOGGLE_WINDOW: 'app:toggleWindow',
  APP_GET_SETTINGS: 'app:getSettings',
  APP_SET_SETTINGS: 'app:setSettings',
  APP_SETTINGS_UPDATED: 'app:settingsUpdated',
  APP_PERMISSION_REQUEST: 'app:permissionRequest',
  APP_PERMISSION_RESPONSE: 'app:permissionResponse',

  // App window controls (for controlling the Desktop Commander window)
  APP_WINDOW_MINIMIZE: 'app:window:minimize',
  APP_WINDOW_MAXIMIZE: 'app:window:maximize',
  APP_WINDOW_FIT_TO_SCREEN: 'app:window:fitToScreen',

  // Copilot
  COPILOT_SEND_MESSAGE: 'copilot:sendMessage',
  COPILOT_STREAM_CHUNK: 'copilot:streamChunk',
  COPILOT_STREAM_END: 'copilot:streamEnd',
  COPILOT_CANCEL: 'copilot:cancel',
  COPILOT_CLEAR_SESSION: 'copilot:clearSession',
  COPILOT_ACTION_LOG: 'copilot:actionLog',

  // Recording
  RECORDING_LIST: 'recording:list',
  RECORDING_GET: 'recording:get',
  RECORDING_DELETE: 'recording:delete',
  RECORDING_OPEN: 'recording:open',
  RECORDING_OPEN_FOLDER: 'recording:openFolder',
  RECORDING_STOP: 'recording:stop',
  RECORDING_SUBSCRIBE: 'recording:subscribe',
  RECORDING_UPDATED: 'recording:updated',
  RECORDING_PROGRESS: 'recording:progress',
  RECORDING_LIST_AUDIO_DEVICES: 'recording:listAudioDevices',
  RECORDING_LIST_VIDEO_DEVICES: 'recording:listVideoDevices',
  RECORDING_CHECK_FFMPEG: 'recording:checkFfmpeg',

  // Screen share privacy
  SCREEN_SHARE_PRIVACY_LIST_WINDOWS: 'screen-share-privacy:list-windows',
  SCREEN_SHARE_PRIVACY_HIDE: 'screen-share-privacy:hide',
  SCREEN_SHARE_PRIVACY_SHOW: 'screen-share-privacy:show',
  SCREEN_SHARE_PRIVACY_LIST_HIDDEN: 'screen-share-privacy:list-hidden',
  SCREEN_SHARE_PRIVACY_GET_AUTO_HIDE: 'screen-share-privacy:get-auto-hide',
  SCREEN_SHARE_PRIVACY_SET_AUTO_HIDE: 'screen-share-privacy:set-auto-hide',

  // Context Awareness
  CONTEXT_GET: 'context:get',
  CONTEXT_CLEAR: 'context:clear',

  // Notes
  NOTES_LIST: 'notes:list',
  NOTES_GET: 'notes:get',
  NOTES_CREATE: 'notes:create',
  NOTES_UPDATE: 'notes:update',
  NOTES_DELETE: 'notes:delete',
  NOTES_SEARCH: 'notes:search',

  // Todos
  TODOS_LIST: 'todos:list',
  TODOS_CREATE: 'todos:create',
  TODOS_COMPLETE: 'todos:complete',
  TODOS_DELETE: 'todos:delete',

  // Copilot Session Compaction
  COPILOT_COMPACT_SESSION: 'copilot:compactSession',
} as const;

export interface HiddenWindow {
  hwnd: string;
  pid: number;
  title: string;
  appName: string;
  hiddenAt: number;
}

// Tool definitions for Copilot
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
  permissionLevel: PermissionLevel;
}

// Available AI models via GitHub Copilot
export type AIModel =
  // Claude models (Anthropic) - Excellent for agentic tasks
  | 'claude-sonnet-4.5'      // Best balance for agentic loops
  | 'claude-opus-4.5'        // Most capable, slower
  | 'claude-haiku-4.5'       // Fastest Claude
  | 'claude-sonnet-4'        // Previous generation
  // GPT-5 models (OpenAI) - Latest generation
  | 'gpt-5.2-codex'          // Code-focused, latest
  | 'gpt-5.2'                // General purpose, latest
  | 'gpt-5.1-codex-max'      // Extended context
  | 'gpt-5.1-codex'          // Code-focused
  | 'gpt-5.1'                // General purpose
  | 'gpt-5'                  // Base GPT-5
  // GPT-4 models (OpenAI) - Previous generation
  | 'gpt-4.1'                // GPT-4 Turbo
  | 'gpt-4o'                 // GPT-4 Optimized
  | 'gpt-4o-mini'            // Fastest, cheapest
  | 'gpt-3.5-turbo'          // Budget option
  // Gemini models (Google)
  | 'gemini-3-pro-preview';  // Experimental

// Agentic Loop Configuration
export interface AgenticLoopConfig {
  enabled: boolean;
  maxIterations: number;
  maxTotalTimeMinutes: number;
  iterationTimeoutSeconds: number;
  model?: AIModel;
}

// Tool execution record for agentic loop
export interface ToolExecutionRecord {
  toolName: string;
  success: boolean;
  result: unknown;
  error?: string;
}

// Summary of a single turn/iteration in the agentic loop
export interface TurnSummary {
  iterationNumber: number;
  toolsExecuted: ToolExecutionRecord[];
  assistantResponse: string;
  hasToolCalls: boolean;
  signalsCompletion: boolean;
  timestamp: Date;
}

// Scheduled Task types
export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRun?: {
    timestamp: number;
    status: 'success' | 'error';
    result?: string;
    error?: string;
  };
}

export interface TaskLog {
  taskId: string;
  taskName: string;
  timestamp: number;
  status: 'success' | 'error';
  result?: string;
  error?: string;
  duration: number;
}

// Timer types (re-exported from timers.ts for shared access)
export enum TimerType {
  TIMER = 'timer',
  COUNTDOWN = 'countdown',
  POMODORO = 'pomodoro'
}

export enum TimerStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

export interface Timer {
  id: string;
  type: TimerType;
  status: TimerStatus;
  name: string;
  startTime?: number;
  elapsed: number;
  duration?: number;
  remaining?: number;
  pomodoroCycle?: number;
  pomodoroWorkDuration?: number;
  pomodoroBreakDuration?: number;
  isBreak?: boolean;
}

// Action Log types for Canvas/Logs tab
export type ActionLogStatus = 'success' | 'error' | 'pending' | 'warning';

export interface ActionLog {
  id: string;
  timestamp: string; // HH:MM:SS format
  createdAt: number; // epoch ms for grouping per prompt
  tool: string;
  description: string;
  status: ActionLogStatus;
  duration?: number; // milliseconds
  details?: string;
  error?: string;
}

// Clipboard History types
export type ClipboardContentType = 'text' | 'image' | 'files';

interface ClipboardEntryBase {
  id: string;
  timestamp: number;
  pinned: boolean;
  size: number;
  type: ClipboardContentType;
}

export interface TextClipboardEntry extends ClipboardEntryBase {
  type: 'text';
  content: string;
}

export interface ImageClipboardEntry extends ClipboardEntryBase {
  type: 'image';
  thumbnailPath: string;
  imagePath: string;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
}

export interface ClipboardFileReference {
  path: string;
  name: string;
  extension: string;
  isDirectory: boolean;
}

export interface FilesClipboardEntry extends ClipboardEntryBase {
  type: 'files';
  files: ClipboardFileReference[];
}

export type ClipboardEntry = TextClipboardEntry | ImageClipboardEntry | FilesClipboardEntry;

// Recording Status
export enum RecordingStatus {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// Recording Type
export enum RecordingType {
  SCREEN = 'screen',
  AUDIO = 'audio',
  WEBCAM = 'webcam'
}

// Audio Source
export enum AudioSource {
  NONE = 'none',
  SYSTEM = 'system',
  MICROPHONE = 'microphone'
}

// Recording interface
export interface Recording {
  id: string;
  type: RecordingType;
  status: RecordingStatus;
  audioSource: AudioSource;
  filename: string;
  outputPath: string;
  startTime: number;
  endTime?: number;
  duration: number;
  fileSize: number;
  fps?: number;
  region?: { x: number; y: number; width: number; height: number };
  error?: string;
}

// Recording Region
export interface RecordingRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Recording Devices
export interface AudioDevice {
  name: string;
  type: 'input' | 'output';
}

export interface VideoDevice {
  name: string;
  type: 'webcam' | 'screen';
}
