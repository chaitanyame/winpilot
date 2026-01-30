// Preload Script - Bridge between main and renderer

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { MCP_IPC_CHANNELS } from '../shared/mcp-types';
import type { PermissionRequest, PermissionResponse, ActionLog } from '../shared/types';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App control
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('app:setSettings', settings),
  getHistory: () => ipcRenderer.invoke('app:getHistory'),
  clearHistory: () => ipcRenderer.invoke('app:clearHistory'),
  hide: () => ipcRenderer.send('app:hide'),
  resize: (height: number) => ipcRenderer.send('app:resize', height),
  minimize: () => ipcRenderer.send(IPC_CHANNELS.APP_WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC_CHANNELS.APP_WINDOW_MAXIMIZE),
  fitToScreen: () => ipcRenderer.send(IPC_CHANNELS.APP_WINDOW_FIT_TO_SCREEN),

  // Window management
  windowList: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_LIST),
  windowFocus: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS, params),
  windowMove: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MOVE, params),
  windowClose: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE, params),
  windowMinimize: (windowId: string) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE, windowId),
  windowMaximize: (windowId: string) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE, windowId),
  windowArrange: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_ARRANGE, params),

  // Files
  filesList: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_LIST, params),
  filesSearch: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_SEARCH, params),
  filesMove: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_MOVE, params),
  filesCopy: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_COPY, params),
  filesDelete: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_DELETE, params),
  filesRename: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_RENAME, params),
  filesCreateFolder: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_CREATE_FOLDER, path),
  filesRead: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.FILES_READ, params),
  filesInfo: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.FILES_INFO, path),

  // Apps
  appsList: (filter?: string) => ipcRenderer.invoke(IPC_CHANNELS.APPS_LIST, filter),
  appsLaunch: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.APPS_LAUNCH, params),
  appsQuit: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.APPS_QUIT, params),
  appsSwitch: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.APPS_SWITCH, name),

  // System
  systemVolume: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_VOLUME, params),
  systemBrightness: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_BRIGHTNESS, params),
  systemScreenshot: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SCREENSHOT, params),
  systemDnd: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_DND, params),
  systemLock: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_LOCK),
  systemSleep: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SLEEP),

  // Process
  processList: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_LIST, params),
  processInfo: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_INFO, params),
  processKill: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_KILL, params),
  processTop: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_TOP, params),

  // Clipboard
  clipboardRead: (format?: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ, format),
  clipboardWrite: (content: string, format?: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE, { content, format }),
  clipboardClear: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CLEAR),

  // Copilot
  sendMessage: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.COPILOT_SEND_MESSAGE, message),
  cancelMessage: () => ipcRenderer.invoke(IPC_CHANNELS.COPILOT_CANCEL),
  clearSession: () => ipcRenderer.invoke(IPC_CHANNELS.COPILOT_CLEAR_SESSION),
  onStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_: unknown, chunk: string) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.COPILOT_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COPILOT_STREAM_CHUNK, handler);
  },
  onStreamEnd: (callback: (error?: { error: string }) => void) => {
    const handler = (_: unknown, error?: { error: string }) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.COPILOT_STREAM_END, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COPILOT_STREAM_END, handler);
  },
  onActionLog: (callback: (log: import('../shared/types').ActionLog) => void) => {
    const handler = (_: unknown, log: import('../shared/types').ActionLog) => callback(log);
    ipcRenderer.on(IPC_CHANNELS.COPILOT_ACTION_LOG, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.COPILOT_ACTION_LOG, handler);
  },

  // Permissions
  onPermissionRequest: (callback: (request: PermissionRequest) => void) => {
    const handler = (_: unknown, request: PermissionRequest) => callback(request);
    ipcRenderer.on(IPC_CHANNELS.APP_PERMISSION_REQUEST, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.APP_PERMISSION_REQUEST, handler);
  },
  respondPermission: (response: PermissionResponse) => {
    ipcRenderer.send(IPC_CHANNELS.APP_PERMISSION_RESPONSE, response);
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // MCP Servers
  mcpList: () => ipcRenderer.invoke(MCP_IPC_CHANNELS.MCP_LIST),
  mcpAdd: (config: unknown) => ipcRenderer.invoke(MCP_IPC_CHANNELS.MCP_ADD, config),
  mcpUpdate: (id: string, config: unknown) => ipcRenderer.invoke(MCP_IPC_CHANNELS.MCP_UPDATE, id, config),
  mcpDelete: (id: string) => ipcRenderer.invoke(MCP_IPC_CHANNELS.MCP_DELETE, id),
  mcpToggle: (id: string) => ipcRenderer.invoke(MCP_IPC_CHANNELS.MCP_TOGGLE, id),

  // Scheduled Tasks
  taskList: () => ipcRenderer.invoke('task:list'),
  taskAdd: (task: unknown) => ipcRenderer.invoke('task:add', task),
  taskUpdate: (id: string, updates: unknown) => ipcRenderer.invoke('task:update', id, updates),
  taskDelete: (id: string) => ipcRenderer.invoke('task:delete', id),
  taskToggle: (id: string) => ipcRenderer.invoke('task:toggle', id),
  taskExecute: (id: string) => ipcRenderer.invoke('task:execute', id),
  taskLogs: () => ipcRenderer.invoke('task:logs'),

  // Notifications
  onNotification: (callback: (options: unknown) => void) => {
    const handler = (_: unknown, options: unknown) => callback(options);
    ipcRenderer.on('notification:show', handler);
    return () => ipcRenderer.removeListener('notification:show', handler);
  },

  // Window events
  onWindowShown: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window:shown', handler);
    return () => ipcRenderer.removeListener('window:shown', handler);
  },
  onWindowHidden: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window:hidden', handler);
    return () => ipcRenderer.removeListener('window:hidden', handler);
  },
  onFocusInput: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('focus:input', handler);
    return () => ipcRenderer.removeListener('focus:input', handler);
  },

  // Voice input API
  voiceTest: () => ipcRenderer.invoke('voice:test'),
  voiceIsRecording: () => ipcRenderer.invoke('voice:isRecording'),

  onVoiceRecordingStarted: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('voice:recordingStarted', handler);
    return () => ipcRenderer.removeListener('voice:recordingStarted', handler);
  },

  onVoiceRecordingStopped: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('voice:recordingStopped', handler);
    return () => ipcRenderer.removeListener('voice:recordingStopped', handler);
  },

  onVoiceTranscript: (callback: (transcript: string) => void) => {
    const handler = (_: unknown, transcript: string) => callback(transcript);
    ipcRenderer.on('voice:transcript', handler);
    return () => ipcRenderer.removeListener('voice:transcript', handler);
  },

  onVoiceError: (callback: (error: string) => void) => {
    const handler = (_: unknown, error: string) => callback(error);
    ipcRenderer.on('voice:error', handler);
    return () => ipcRenderer.removeListener('voice:error', handler);
  },

  // Timer API
  timerList: () => ipcRenderer.invoke('timer:list'),
  timerGet: (id: string) => ipcRenderer.invoke('timer:get', id),
  timerCreate: (type: string, name: string, options?: { duration?: number; workDuration?: number; breakDuration?: number }) =>
    ipcRenderer.invoke('timer:create', { type, name, options }),
  timerStart: (id: string) => ipcRenderer.invoke('timer:start', id),
  timerPause: (id: string) => ipcRenderer.invoke('timer:pause', id),
  timerReset: (id: string) => ipcRenderer.invoke('timer:reset', id),
  timerDelete: (id: string) => ipcRenderer.invoke('timer:delete', id),
  timerSkip: (id: string) => ipcRenderer.invoke('timer:skip', id),
  onTimerTick: (callback: (timer: unknown) => void) => {
    const handler = (_: unknown, timer: unknown) => callback(timer);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.removeListener('timer:tick', handler);
  },
  onTimerCreated: (callback: (timer: unknown) => void) => {
    const handler = (_: unknown, timer: unknown) => callback(timer);
    ipcRenderer.on('timer:created', handler);
    return () => ipcRenderer.removeListener('timer:created', handler);
  },
  onTimerCompleted: (callback: (timer: unknown) => void) => {
    const handler = (_: unknown, timer: unknown) => callback(timer);
    ipcRenderer.on('timer:completed', handler);
    return () => ipcRenderer.removeListener('timer:completed', handler);
  },
  onTimerDeleted: (callback: (id: string) => void) => {
    const handler = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('timer:deleted', handler);
    return () => ipcRenderer.removeListener('timer:deleted', handler);
  },
  subscribeToTimers: () => ipcRenderer.send('timer:subscribe'),

  // Reminder API
  reminderList: () => ipcRenderer.invoke('reminder:list'),
  reminderCreate: (message: string, delayMinutes?: number, scheduledTime?: string) =>
    ipcRenderer.invoke('reminder:create', { message, delayMinutes, scheduledTime }),
  reminderCancel: (id: string) => ipcRenderer.invoke('reminder:cancel', id),
  reminderDelete: (id: string) => ipcRenderer.invoke('reminder:delete', id),
  onReminderCreated: (callback: (reminder: unknown) => void) => {
    const handler = (_: unknown, reminder: unknown) => callback(reminder);
    ipcRenderer.on('reminder:created', handler);
    return () => ipcRenderer.removeListener('reminder:created', handler);
  },
  onReminderTriggered: (callback: (reminder: unknown) => void) => {
    const handler = (_: unknown, reminder: unknown) => callback(reminder);
    ipcRenderer.on('reminder:triggered', handler);
    return () => ipcRenderer.removeListener('reminder:triggered', handler);
  },
  onReminderCancelled: (callback: (id: string) => void) => {
    const handler = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('reminder:cancelled', handler);
    return () => ipcRenderer.removeListener('reminder:cancelled', handler);
  },
  subscribeToReminders: () => ipcRenderer.send('reminder:subscribe'),

  // Chat history API
  chatStart: (title?: string) => ipcRenderer.invoke('chat:start', title),
  chatGetHistory: (conversationId?: string) => ipcRenderer.invoke('chat:getHistory', conversationId),
  chatGetConversations: () => ipcRenderer.invoke('chat:getConversations'),
  chatLoadConversation: (id: string) => ipcRenderer.invoke('chat:loadConversation', id),
  chatDeleteConversation: (id: string) => ipcRenderer.invoke('chat:deleteConversation', id),
  chatSearch: (query: string) => ipcRenderer.invoke('chat:search', query),
  chatGetStats: () => ipcRenderer.invoke('chat:getStats'),

  // Menu bar API
  menubarInit: (config?: { iconPath?: string; tooltip?: string; showDockIcon?: boolean }) =>
    ipcRenderer.invoke('menubar:init', config),
  menubarShow: () => ipcRenderer.invoke('menubar:show'),
  menubarHide: () => ipcRenderer.invoke('menubar:hide'),
  menubarToggle: () => ipcRenderer.invoke('menubar:toggle'),
  menubarIsActive: () => ipcRenderer.invoke('menubar:isActive'),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getSettings: () => Promise<unknown>;
  setSettings: (settings: Record<string, unknown>) => Promise<unknown>;
  getHistory: () => Promise<unknown>;
  clearHistory: () => Promise<void>;
  hide: () => void;
  resize: (height: number) => void;
  minimize: () => void;
  maximize: () => void;
  fitToScreen: () => void;
  
  windowList: () => Promise<unknown>;
  windowFocus: (params: unknown) => Promise<unknown>;
  windowMove: (params: unknown) => Promise<unknown>;
  windowClose: (params: unknown) => Promise<unknown>;
  windowMinimize: (windowId: string) => Promise<unknown>;
  windowMaximize: (windowId: string) => Promise<unknown>;
  windowArrange: (params: unknown) => Promise<unknown>;
  
  filesList: (params: unknown) => Promise<unknown>;
  filesSearch: (params: unknown) => Promise<unknown>;
  filesMove: (params: unknown) => Promise<unknown>;
  filesCopy: (params: unknown) => Promise<unknown>;
  filesDelete: (params: unknown) => Promise<unknown>;
  filesRename: (params: unknown) => Promise<unknown>;
  filesCreateFolder: (path: string) => Promise<unknown>;
  filesRead: (params: unknown) => Promise<unknown>;
  filesInfo: (path: string) => Promise<unknown>;
  
  appsList: (filter?: string) => Promise<unknown>;
  appsLaunch: (params: unknown) => Promise<unknown>;
  appsQuit: (params: unknown) => Promise<unknown>;
  appsSwitch: (name: string) => Promise<unknown>;
  
  systemVolume: (params: unknown) => Promise<unknown>;
  systemBrightness: (params: unknown) => Promise<unknown>;
  systemScreenshot: (params: unknown) => Promise<unknown>;
  systemDnd: (params: unknown) => Promise<unknown>;
  systemLock: () => Promise<unknown>;
  systemSleep: () => Promise<unknown>;
  
  processList: (params: unknown) => Promise<unknown>;
  processInfo: (params: unknown) => Promise<unknown>;
  processKill: (params: unknown) => Promise<unknown>;
  processTop: (params: unknown) => Promise<unknown>;
  
  clipboardRead: (format?: string) => Promise<string>;
  clipboardWrite: (content: string, format?: string) => Promise<boolean>;
  clipboardClear: () => Promise<boolean>;
  
  sendMessage: (message: string) => Promise<void>;
  cancelMessage: () => Promise<void>;
  clearSession: () => Promise<void>;
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: (error?: { error: string }) => void) => () => void;
  onActionLog: (callback: (log: ActionLog) => void) => () => void;


  onPermissionRequest: (callback: (request: PermissionRequest) => void) => () => void;
  respondPermission: (response: PermissionResponse) => void;
  
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  
  mcpList: () => Promise<unknown>;
  mcpAdd: (config: unknown) => Promise<unknown>;
  mcpUpdate: (id: string, config: unknown) => Promise<unknown>;
  mcpDelete: (id: string) => Promise<boolean>;
  mcpToggle: (id: string) => Promise<unknown>;

  taskList: () => Promise<unknown>;
  taskAdd: (task: unknown) => Promise<unknown>;
  taskUpdate: (id: string, updates: unknown) => Promise<unknown>;
  taskDelete: (id: string) => Promise<boolean>;
  taskToggle: (id: string) => Promise<unknown>;
  taskExecute: (id: string) => Promise<{ success: boolean }>;
  taskLogs: () => Promise<unknown>;

  onNotification: (callback: (options: unknown) => void) => () => void;

  onWindowShown: (callback: () => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  onFocusInput: (callback: () => void) => () => void;

  voiceTest: () => Promise<{ success: boolean }>;
  voiceIsRecording: () => Promise<boolean>;
  onVoiceRecordingStarted: (callback: () => void) => () => void;
  onVoiceRecordingStopped: (callback: () => void) => () => void;
  onVoiceTranscript: (callback: (transcript: string) => void) => () => void;
  onVoiceError: (callback: (error: string) => void) => () => void;

  timerList: () => Promise<unknown[]>;
  timerGet: (id: string) => Promise<unknown>;
  timerCreate: (type: string, name: string, options?: { duration?: number; workDuration?: number; breakDuration?: number }) => Promise<unknown>;
  timerStart: (id: string) => Promise<unknown>;
  timerPause: (id: string) => Promise<unknown>;
  timerReset: (id: string) => Promise<unknown>;
  timerDelete: (id: string) => Promise<boolean>;
  timerSkip: (id: string) => Promise<unknown>;
  onTimerTick: (callback: (timer: unknown) => void) => () => void;
  onTimerCreated: (callback: (timer: unknown) => void) => () => void;
  onTimerCompleted: (callback: (timer: unknown) => void) => () => void;
  onTimerDeleted: (callback: (id: string) => void) => () => void;
  subscribeToTimers: () => void;

  reminderList: () => Promise<unknown[]>;
  reminderCreate: (message: string, delayMinutes?: number, scheduledTime?: string) => Promise<unknown>;
  reminderCancel: (id: string) => Promise<boolean>;
  reminderDelete: (id: string) => Promise<boolean>;
  onReminderCreated: (callback: (reminder: unknown) => void) => () => void;
  onReminderTriggered: (callback: (reminder: unknown) => void) => () => void;
  onReminderCancelled: (callback: (id: string) => void) => () => void;
  subscribeToReminders: () => void;

  chatStart: (title?: string) => Promise<string>;
  chatGetHistory: (conversationId?: string) => Promise<unknown[]>;
  chatGetConversations: () => Promise<unknown[]>;
  chatLoadConversation: (id: string) => Promise<unknown>;
  chatDeleteConversation: (id: string) => Promise<boolean>;
  chatSearch: (query: string) => Promise<unknown[]>;
  chatGetStats: () => Promise<unknown>;

  menubarInit: (config?: { iconPath?: string; tooltip?: string; showDockIcon?: boolean }) => Promise<{ mode: string; platform: string }>;
  menubarShow: () => Promise<void>;
  menubarHide: () => Promise<void>;
  menubarToggle: () => Promise<void>;
  menubarIsActive: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
