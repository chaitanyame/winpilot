// Platform Adapter Interface and Factory

import type { WindowInfo, FileInfo, FileFilter, AppInfo, ProcessInfo, SystemInfoData, NetworkInfoData, NetworkTestResult, ServiceInfo } from '../shared/types';

// Window Manager Interface
export interface IWindowManager {
  listWindows(): Promise<WindowInfo[]>;
  focusWindow(params: { windowId?: string; appName?: string; titleContains?: string }): Promise<boolean>;
  moveWindow(params: { windowId: string; x?: number; y?: number; width?: number; height?: number }): Promise<boolean>;
  closeWindow(params: { windowId?: string; appName?: string }): Promise<boolean>;
  minimizeWindow(windowId: string): Promise<boolean>;
  maximizeWindow(windowId: string): Promise<boolean>;
  arrangeWindows(params: { layout: string; windows?: string[] }): Promise<boolean>;
}

// File System Interface
export interface IFileSystem {
  listFiles(params: { path: string; recursive?: boolean; filter?: FileFilter }): Promise<FileInfo[]>;
  searchFiles(params: { query: string; startPath?: string; maxResults?: number }): Promise<FileInfo[]>;
  moveFiles(params: { source: string | string[]; destination: string; overwrite?: boolean }): Promise<boolean>;
  copyFiles(params: { source: string | string[]; destination: string; overwrite?: boolean }): Promise<boolean>;
  deleteFiles(params: { paths: string[]; moveToTrash?: boolean }): Promise<boolean>;
  renameFile(params: { path: string; newName: string }): Promise<boolean>;
  createFolder(path: string): Promise<boolean>;
  readFile(params: { path: string; encoding?: string; maxSize?: number }): Promise<string>;
  writeFile(params: { path: string; content: string; encoding?: string; append?: boolean }): Promise<boolean>;
  getFileInfo(path: string): Promise<FileInfo>;
}

// Apps Interface
export interface IApps {
  listApps(filter?: 'running' | 'installed' | 'all'): Promise<AppInfo[]>;
  launchApp(params: { name?: string; path?: string; args?: string[] }): Promise<boolean>;
  quitApp(params: { name: string; force?: boolean }): Promise<boolean>;
  switchToApp(name: string): Promise<boolean>;
  createPowerPoint(params: { savePath: string; slides: import('./types').PowerPointSlide[] }): Promise<boolean>;
}

// System Control Interface
export interface ISystem {
  volume(params: { action: 'get' | 'set' | 'mute' | 'unmute'; level?: number }): Promise<number | boolean>;
  brightness(params: { action: 'get' | 'set'; level?: number }): Promise<number | boolean>;
  screenshot(params: { region?: string; savePath?: string; filename?: string }): Promise<string>;
  doNotDisturb(params: { action: 'status' | 'on' | 'off'; duration?: number }): Promise<boolean>;
  lockScreen(): Promise<boolean>;
  sleep(): Promise<boolean>;
  getSystemInfo(params: { sections?: string[] }): Promise<SystemInfoData>;
}

// Process Interface
export interface IProcess {
  listProcesses(params?: { sortBy?: 'cpu' | 'memory' | 'name'; limit?: number }): Promise<ProcessInfo[]>;
  getProcessInfo(params: { pid?: number; name?: string }): Promise<ProcessInfo | null>;
  killProcess(params: { pid?: number; name?: string; force?: boolean }): Promise<boolean>;
  getTopProcesses(params: { resource: 'cpu' | 'memory'; limit?: number }): Promise<ProcessInfo[]>;
}

// Network Interface
export interface INetwork {
  getNetworkInfo(params: { includeInactive?: boolean }): Promise<NetworkInfoData>;
  testNetwork(params: { test: 'ping' | 'dns' | 'connectivity'; host?: string; count?: number }): Promise<NetworkTestResult>;
}

// Services Interface
export interface IServices {
  listServices(params: { filter?: string; nameContains?: string }): Promise<ServiceInfo[]>;
  controlService(params: { service: string; action: 'start' | 'stop' | 'restart' }): Promise<boolean>;
}

// Complete Platform Adapter Interface
export interface IPlatformAdapter {
  readonly platform: 'windows' | 'macos' | 'linux';
  readonly windowManager: IWindowManager;
  readonly fileSystem: IFileSystem;
  readonly apps: IApps;
  readonly system: ISystem;
  readonly process: IProcess;
  readonly network: INetwork;
  readonly services: IServices;
}

// Import all platform adapters statically
import windowsAdapter from './windows';
import macosAdapter from './macos';
import linuxAdapter from './linux';

// Get the platform adapter for the current OS
export function getPlatformAdapter(): IPlatformAdapter {
  const platform = process.platform;

  switch (platform) {
    case 'win32':
      return windowsAdapter;
    case 'darwin':
      return macosAdapter;
    case 'linux':
      return linuxAdapter;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Execute a tool by name with the given arguments
 * Dispatches to the appropriate platform adapter method
 */
export async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const adapter = getPlatformAdapter();
  const [category, action] = toolName.split('.');

  switch (category) {
    case 'window':
      return executeWindowTool(adapter.windowManager, action, args);
    case 'files':
      return executeFilesTool(adapter.fileSystem, action, args);
    case 'apps':
      return executeAppsTool(adapter.apps, action, args);
    case 'system':
      return executeSystemTool(adapter.system, action, args);
    case 'process':
      return executeProcessTool(adapter.process, action, args);
    case 'clipboard':
      return executeClipboardTool(action, args);
    default:
      throw new Error(`Unknown tool category: ${category}`);
  }
}

async function executeWindowTool(wm: IWindowManager, action: string, args: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'list':
      return wm.listWindows();
    case 'focus':
      return wm.focusWindow(args as any);
    case 'move':
      return wm.moveWindow(args as any);
    case 'close':
      return wm.closeWindow(args as any);
    case 'minimize':
      return wm.minimizeWindow(args.windowId as string);
    case 'maximize':
      return wm.maximizeWindow(args.windowId as string);
    case 'arrange':
      return wm.arrangeWindows(args as any);
    default:
      throw new Error(`Unknown window action: ${action}`);
  }
}

async function executeFilesTool(fs: IFileSystem, action: string, args: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'list':
      return fs.listFiles(args as any);
    case 'search':
      return fs.searchFiles(args as any);
    case 'move':
      return fs.moveFiles(args as any);
    case 'copy':
      return fs.copyFiles(args as any);
    case 'delete':
      return fs.deleteFiles(args as any);
    case 'rename':
      return fs.renameFile(args as any);
    case 'create_folder':
      return fs.createFolder(args.path as string);
    case 'read':
      return fs.readFile(args as any);
    case 'info':
      return fs.getFileInfo(args.path as string);
    default:
      throw new Error(`Unknown files action: ${action}`);
  }
}

async function executeAppsTool(apps: IApps, action: string, args: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'list':
      return apps.listApps(args.filter as any);
    case 'launch':
      return apps.launchApp(args as any);
    case 'quit':
      return apps.quitApp(args as any);
    case 'switch':
      return apps.switchToApp(args.name as string);
    default:
      throw new Error(`Unknown apps action: ${action}`);
  }
}

async function executeSystemTool(system: ISystem, action: string, args: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'volume':
      return system.volume(args as any);
    case 'brightness':
      return system.brightness(args as any);
    case 'screenshot':
      return system.screenshot(args as any);
    case 'dnd':
      return system.doNotDisturb(args as any);
    case 'lock':
      return system.lockScreen();
    case 'sleep':
      return system.sleep();
    default:
      throw new Error(`Unknown system action: ${action}`);
  }
}

async function executeProcessTool(proc: IProcess, action: string, args: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'list':
      return proc.listProcesses(args as any);
    case 'info':
      return proc.getProcessInfo(args as any);
    case 'kill':
      return proc.killProcess(args as any);
    case 'top':
      return proc.getTopProcesses(args as any);
    default:
      throw new Error(`Unknown process action: ${action}`);
  }
}

async function executeClipboardTool(action: string, args: Record<string, unknown>): Promise<unknown> {
  // Clipboard is handled via Electron's clipboard module
  const { clipboard } = await import('electron');
  
  switch (action) {
    case 'read':
      return args.format === 'html' ? clipboard.readHTML() : clipboard.readText();
    case 'write':
      if (args.format === 'html') {
        clipboard.writeHTML(args.content as string);
      } else {
        clipboard.writeText(args.content as string);
      }
      return true;
    case 'clear':
      clipboard.clear();
      return true;
    default:
      throw new Error(`Unknown clipboard action: ${action}`);
  }
}
