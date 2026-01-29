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
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
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

// Settings
export interface Settings {
  hotkey: string;
  theme: 'light' | 'dark' | 'system';
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
  };
  safety: {
    maxFilesPerOperation: number;
    protectedPaths: string[];
    requireConfirmAbove: number;
  };
  agenticLoop: AgenticLoopConfig;
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

  // App control
  APP_TOGGLE_WINDOW: 'app:toggleWindow',
  APP_GET_SETTINGS: 'app:getSettings',
  APP_SET_SETTINGS: 'app:setSettings',
  APP_PERMISSION_REQUEST: 'app:permissionRequest',
  APP_PERMISSION_RESPONSE: 'app:permissionResponse',

  // Copilot
  COPILOT_SEND_MESSAGE: 'copilot:sendMessage',
  COPILOT_STREAM_CHUNK: 'copilot:streamChunk',
  COPILOT_STREAM_END: 'copilot:streamEnd',
  COPILOT_CANCEL: 'copilot:cancel',
  COPILOT_CLEAR_SESSION: 'copilot:clearSession',
} as const;

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

// Agentic Loop Configuration
export interface AgenticLoopConfig {
  enabled: boolean;
  maxIterations: number;
  maxTotalTimeMinutes: number;
  iterationTimeoutSeconds: number;
  model?: 'gpt-4.1' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';
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
