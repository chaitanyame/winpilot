// Linux Platform Adapter (Stub - To be implemented in Phase 6)

import { IPlatformAdapter, IWindowManager, IFileSystem, IApps, ISystem, IProcess } from '../index';
import { WindowInfo, FileInfo, AppInfo, ProcessInfo } from '../../shared/types';

class LinuxWindowManager implements IWindowManager {
  async listWindows(): Promise<WindowInfo[]> {
    console.warn('Linux window manager not yet implemented');
    return [];
  }
  async focusWindow(): Promise<boolean> { return false; }
  async moveWindow(): Promise<boolean> { return false; }
  async closeWindow(): Promise<boolean> { return false; }
  async minimizeWindow(): Promise<boolean> { return false; }
  async maximizeWindow(): Promise<boolean> { return false; }
  async arrangeWindows(): Promise<boolean> { return false; }
}

class LinuxFileSystem implements IFileSystem {
  async listFiles(): Promise<FileInfo[]> { return []; }
  async searchFiles(): Promise<FileInfo[]> { return []; }
  async moveFiles(): Promise<boolean> { return false; }
  async copyFiles(): Promise<boolean> { return false; }
  async deleteFiles(): Promise<boolean> { return false; }
  async renameFile(): Promise<boolean> { return false; }
  async createFolder(): Promise<boolean> { return false; }
  async readFile(): Promise<string> { return ''; }
  async writeFile(): Promise<boolean> { return false; }
  async getFileInfo(): Promise<FileInfo> { throw new Error('Not implemented'); }
}

class LinuxApps implements IApps {
  async listApps(): Promise<AppInfo[]> { return []; }
  async launchApp(): Promise<boolean> { return false; }
  async quitApp(): Promise<boolean> { return false; }
  async switchToApp(): Promise<boolean> { return false; }
  async createPowerPoint(): Promise<boolean> { return false; }
}

class LinuxSystem implements ISystem {
  async volume(): Promise<number | boolean> { return 0; }
  async brightness(): Promise<number | boolean> { return 0; }
  async screenshot(): Promise<string> { return ''; }
  async doNotDisturb(): Promise<boolean> { return false; }
  async lockScreen(): Promise<boolean> { return false; }
  async sleep(): Promise<boolean> { return false; }
}

class LinuxProcess implements IProcess {
  async listProcesses(): Promise<ProcessInfo[]> { return []; }
  async getProcessInfo(): Promise<ProcessInfo | null> { return null; }
  async killProcess(): Promise<boolean> { return false; }
  async getTopProcesses(): Promise<ProcessInfo[]> { return []; }
}

const linuxAdapter: IPlatformAdapter = {
  platform: 'linux',
  windowManager: new LinuxWindowManager(),
  fileSystem: new LinuxFileSystem(),
  apps: new LinuxApps(),
  system: new LinuxSystem(),
  process: new LinuxProcess(),
};

export default linuxAdapter;
