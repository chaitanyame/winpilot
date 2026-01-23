// Preload Script - Bridge between main and renderer

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { MCP_IPC_CHANNELS } from '../shared/mcp-types';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App control
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('app:setSettings', settings),
  getHistory: () => ipcRenderer.invoke('app:getHistory'),
  clearHistory: () => ipcRenderer.invoke('app:clearHistory'),
  hide: () => ipcRenderer.send('app:hide'),
  resize: (height: number) => ipcRenderer.send('app:resize', height),

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
});

// Type definitions for the exposed API
export interface ElectronAPI {
  getSettings: () => Promise<unknown>;
  setSettings: (settings: Record<string, unknown>) => Promise<unknown>;
  getHistory: () => Promise<unknown>;
  clearHistory: () => Promise<void>;
  hide: () => void;
  resize: (height: number) => void;
  
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
  
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  
  mcpList: () => Promise<unknown>;
  mcpAdd: (config: unknown) => Promise<unknown>;
  mcpUpdate: (id: string, config: unknown) => Promise<unknown>;
  mcpDelete: (id: string) => Promise<boolean>;
  mcpToggle: (id: string) => Promise<unknown>;
  
  onWindowShown: (callback: () => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  onFocusInput: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
