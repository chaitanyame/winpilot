// macOS Platform Adapter (Stub - To be implemented in Phase 5)

import { IPlatformAdapter, IWindowManager, IFileSystem, IApps, ISystem, IProcess } from '../index';
import { WindowInfo, FileInfo, FileFilter, AppInfo, ProcessInfo } from '../../shared/types';

class MacOSWindowManager implements IWindowManager {
  async listWindows(): Promise<WindowInfo[]> {
    console.warn('macOS window manager not yet implemented');
    return [];
  }
  async focusWindow(): Promise<boolean> { return false; }
  async moveWindow(): Promise<boolean> { return false; }
  async closeWindow(): Promise<boolean> { return false; }
  async minimizeWindow(): Promise<boolean> { return false; }
  async maximizeWindow(): Promise<boolean> { return false; }
  async arrangeWindows(): Promise<boolean> { return false; }
}

class MacOSFileSystem implements IFileSystem {
  async listFiles(): Promise<FileInfo[]> { return []; }
  async searchFiles(): Promise<FileInfo[]> { return []; }
  async moveFiles(): Promise<boolean> { return false; }
  async copyFiles(): Promise<boolean> { return false; }
  async deleteFiles(): Promise<boolean> { return false; }
  async renameFile(): Promise<boolean> { return false; }
  async createFolder(): Promise<boolean> { return false; }
  async readFile(): Promise<string> { return ''; }
  async getFileInfo(): Promise<FileInfo> { throw new Error('Not implemented'); }
}

class MacOSApps implements IApps {
  async listApps(): Promise<AppInfo[]> { return []; }
  async launchApp(): Promise<boolean> { return false; }
  async quitApp(): Promise<boolean> { return false; }
  async switchToApp(): Promise<boolean> { return false; }
}

class MacOSSystem implements ISystem {
  async volume(): Promise<number | boolean> { return 0; }
  async brightness(): Promise<number | boolean> { return 0; }
  async screenshot(): Promise<string> { return ''; }
  async doNotDisturb(): Promise<boolean> { return false; }
  async lockScreen(): Promise<boolean> { return false; }
  async sleep(): Promise<boolean> { return false; }
}

class MacOSProcess implements IProcess {
  async listProcesses(): Promise<ProcessInfo[]> { return []; }
  async getProcessInfo(): Promise<ProcessInfo | null> { return null; }
  async killProcess(): Promise<boolean> { return false; }
  async getTopProcesses(): Promise<ProcessInfo[]> { return []; }
}

const macosAdapter: IPlatformAdapter = {
  platform: 'macos',
  windowManager: new MacOSWindowManager(),
  fileSystem: new MacOSFileSystem(),
  apps: new MacOSApps(),
  system: new MacOSSystem(),
  process: new MacOSProcess(),
};

export default macosAdapter;
