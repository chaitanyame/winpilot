// Unified Platform Adapter
// Wraps the nested platform adapter with a flat interface and consistent result format

import { getPlatformAdapter as getNestedAdapter, IPlatformAdapter } from './index';
import type { WindowInfo, FileInfo, FileFilter, AppInfo, ProcessInfo, SystemInfoData, NetworkInfoData, NetworkTestResult, ServiceInfo } from '../shared/types';
import { clipboard } from 'electron';
import { logger } from '../utils/logger';

// ============================================================================
// Result Types
// ============================================================================

/**
 * Standard operation result with consistent success/error format
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Parameter Types
// ============================================================================

export interface FocusWindowParams {
  windowId?: string;
  appName?: string;
  titleContains?: string;
}

export interface MoveWindowParams {
  windowId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface CloseWindowParams {
  windowId?: string;
  appName?: string;
}

export interface MinimizeWindowParams {
  windowId: string;
}

export interface MaximizeWindowParams {
  windowId: string;
}

export interface ArrangeWindowsParams {
  layout: string;
  windows?: string[];
}

export interface ListFilesParams {
  path: string;
  recursive?: boolean;
  filter?: FileFilter;
}

export interface SearchFilesParams {
  query: string;
  startPath?: string;
  maxResults?: number;
}

export interface MoveFilesParams {
  source: string | string[];
  destination: string;
  overwrite?: boolean;
}

export interface CopyFilesParams {
  source: string | string[];
  destination: string;
  overwrite?: boolean;
}

export interface DeleteFilesParams {
  paths: string[];
  moveToTrash?: boolean;
}

export interface RenameFileParams {
  path: string;
  newName: string;
}

export interface CreateFolderParams {
  path: string;
}

export interface ReadFileParams {
  path: string;
  encoding?: string;
  maxSize?: number;
}

export interface WriteFileParams {
  path: string;
  content: string;
  encoding?: string;
  append?: boolean;
}

export interface GetFileInfoParams {
  path: string;
}

export interface ListAppsParams {
  filter?: 'running' | 'installed' | 'all';
}

export interface LaunchAppParams {
  name?: string;
  path?: string;
  args?: string[];
}

export interface QuitAppParams {
  name: string;
  force?: boolean;
}

export interface SwitchAppParams {
  name: string;
}

export interface VolumeParams {
  action: 'get' | 'set' | 'mute' | 'unmute';
  level?: number;
}

export interface BrightnessParams {
  action: 'get' | 'set';
  level?: number;
}

export interface ScreenshotParams {
  region?: string;
  savePath?: string;
  filename?: string;
}

export interface DndParams {
  action: 'status' | 'on' | 'off';
  duration?: number;
}

export interface ListProcessesParams {
  sortBy?: 'cpu' | 'memory' | 'name';
  limit?: number;
}

export interface GetProcessInfoParams {
  pid?: number;
  name?: string;
}

export interface KillProcessParams {
  pid?: number;
  name?: string;
  force?: boolean;
}

export interface GetTopProcessesParams {
  resource: 'cpu' | 'memory';
  limit?: number;
}

export interface ReadClipboardParams {
  format?: 'text' | 'html';
}

export interface WriteClipboardParams {
  content: string;
  format?: 'text' | 'html';
}

export interface GetSystemInfoParams {
  sections?: string[];
}

export interface GetNetworkInfoParams {
  includeInactive?: boolean;
}

export interface TestNetworkParams {
  test: 'ping' | 'dns' | 'connectivity';
  host?: string;
  count?: number;
}

export interface ListServicesParams {
  filter?: string;
  nameContains?: string;
}

export interface ControlServiceParams {
  service: string;
  action: 'start' | 'stop' | 'restart';
}

// ============================================================================
// Result Data Types
// ============================================================================

export interface VolumeResult {
  level: number;
  muted?: boolean;
}

export interface BrightnessResult {
  level: number;
}

export interface ScreenshotResult {
  path: string;
}

export interface DndResult {
  enabled: boolean;
}

export interface ClipboardResult {
  content: string;
}

export interface SystemInfoResult {
  data: SystemInfoData;
}

export interface NetworkInfoResult {
  data: NetworkInfoData;
}

export interface NetworkTestResultData {
  result: NetworkTestResult;
}

export interface ServicesListResult {
  services: ServiceInfo[];
}

// ============================================================================
// Unified Platform Adapter
// ============================================================================

/**
 * Unified Platform Adapter that wraps the nested platform adapter
 * with a flat interface and consistent { success, data, error } return format
 */
class UnifiedPlatformAdapter {
  private adapter: IPlatformAdapter;

  constructor() {
    this.adapter = getNestedAdapter();
  }

  // ==========================================================================
  // Window Management
  // ==========================================================================

  async listWindows(): Promise<OperationResult<WindowInfo[]>> {
    try {
      const windows = await this.adapter.windowManager.listWindows();
      return { success: true, data: windows };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async focusWindow(params: FocusWindowParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.focusWindow(params);
      if (!result) {
        return { success: false, error: 'Window not found or could not be focused' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async moveWindow(params: MoveWindowParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.moveWindow(params);
      if (!result) {
        return { success: false, error: 'Window not found or could not be moved' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async closeWindow(params: CloseWindowParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.closeWindow(params);
      if (!result) {
        return { success: false, error: 'Window not found or could not be closed' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async minimizeWindow(params: MinimizeWindowParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.minimizeWindow(params.windowId);
      if (!result) {
        return { success: false, error: 'Window not found or could not be minimized' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async maximizeWindow(params: MaximizeWindowParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.maximizeWindow(params.windowId);
      if (!result) {
        return { success: false, error: 'Window not found or could not be maximized' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async arrangeWindows(params: ArrangeWindowsParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.windowManager.arrangeWindows(params);
      if (!result) {
        return { success: false, error: 'Could not arrange windows' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // File System
  // ==========================================================================

  async listFiles(params: ListFilesParams): Promise<OperationResult<FileInfo[]>> {
    try {
      const files = await this.adapter.fileSystem.listFiles(params);
      return { success: true, data: files };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async searchFiles(params: SearchFilesParams): Promise<OperationResult<FileInfo[]>> {
    try {
      const files = await this.adapter.fileSystem.searchFiles(params);
      return { success: true, data: files };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async moveFiles(params: MoveFilesParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.fileSystem.moveFiles(params);
      if (!result) {
        return { success: false, error: 'Failed to move files' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async copyFiles(params: CopyFilesParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.fileSystem.copyFiles(params);
      if (!result) {
        return { success: false, error: 'Failed to copy files' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async deleteFiles(params: DeleteFilesParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.fileSystem.deleteFiles(params);
      if (!result) {
        return { success: false, error: 'Failed to delete files' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async renameFile(params: RenameFileParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.fileSystem.renameFile(params);
      if (!result) {
        return { success: false, error: 'Failed to rename file' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async createFolder(params: CreateFolderParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.fileSystem.createFolder(params.path);
      if (!result) {
        return { success: false, error: 'Failed to create folder' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async readFile(params: ReadFileParams): Promise<OperationResult<string>> {
    try {
      const content = await this.adapter.fileSystem.readFile(params);
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async writeFile(params: WriteFileParams): Promise<OperationResult<boolean>> {
    try {
      const result = await this.adapter.fileSystem.writeFile(params);
      if (!result) {
        return { success: false, error: 'Failed to write file' };
      }
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async getFileInfo(params: GetFileInfoParams): Promise<OperationResult<FileInfo>> {
    try {
      const info = await this.adapter.fileSystem.getFileInfo(params.path);
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Applications
  // ==========================================================================

  async listApps(params: ListAppsParams = {}): Promise<OperationResult<AppInfo[]>> {
    try {
      const apps = await this.adapter.apps.listApps(params.filter);
      return { success: true, data: apps };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async launchApp(params: LaunchAppParams): Promise<OperationResult<void>> {
    try {
      logger.platform('launchApp called', params);
      const result = await this.adapter.apps.launchApp(params);
      logger.platform('launchApp adapter result', { result });
      if (!result) {
        return { success: false, error: 'Failed to launch application' };
      }
      return { success: true };
    } catch (error) {
      logger.error('Platform', 'launchApp error', error);
      return { success: false, error: this.formatError(error) };
    }
  }

  async quitApp(params: QuitAppParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.apps.quitApp(params);
      if (!result) {
        return { success: false, error: 'Failed to quit application' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async switchApp(params: SwitchAppParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.apps.switchToApp(params.name);
      if (!result) {
        return { success: false, error: 'Failed to switch to application' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async createPowerPoint(params: { savePath: string; slides: import('./types').PowerPointSlide[] }): Promise<OperationResult<boolean>> {
    try {
      const result = await this.adapter.apps.createPowerPoint(params);
      if (!result) {
        return { success: false, error: 'Failed to create PowerPoint presentation' };
      }
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // System Control
  // ==========================================================================

  async controlVolume(params: VolumeParams): Promise<OperationResult<VolumeResult>> {
    try {
      const result = await this.adapter.system.volume(params);
      if (params.action === 'get') {
        return { success: true, data: { level: result as number } };
      }
      return { success: true, data: { level: params.level ?? 0 } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async controlBrightness(params: BrightnessParams): Promise<OperationResult<BrightnessResult>> {
    try {
      const result = await this.adapter.system.brightness(params);
      if (params.action === 'get') {
        return { success: true, data: { level: result as number } };
      }
      return { success: true, data: { level: params.level ?? 0 } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async takeScreenshot(params: ScreenshotParams): Promise<OperationResult<ScreenshotResult>> {
    try {
      const path = await this.adapter.system.screenshot(params);
      return { success: true, data: { path } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async controlDnd(params: DndParams): Promise<OperationResult<DndResult>> {
    try {
      const result = await this.adapter.system.doNotDisturb(params);
      if (params.action === 'status') {
        return { success: true, data: { enabled: result as boolean } };
      }
      return { success: true, data: { enabled: params.action === 'on' } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async lockScreen(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.system.lockScreen();
      if (!result) {
        return { success: false, error: 'Failed to lock screen' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async sleep(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.system.sleep();
      if (!result) {
        return { success: false, error: 'Failed to put computer to sleep' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Process Management
  // ==========================================================================

  async listProcesses(params: ListProcessesParams = {}): Promise<OperationResult<ProcessInfo[]>> {
    try {
      const processes = await this.adapter.process.listProcesses(params);
      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async getProcessInfo(params: GetProcessInfoParams): Promise<OperationResult<ProcessInfo | null>> {
    try {
      const info = await this.adapter.process.getProcessInfo(params);
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async killProcess(params: KillProcessParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.process.killProcess(params);
      if (!result) {
        return { success: false, error: 'Failed to kill process' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async getTopProcesses(params: GetTopProcessesParams): Promise<OperationResult<ProcessInfo[]>> {
    try {
      const processes = await this.adapter.process.getTopProcesses(params);
      return { success: true, data: processes };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Clipboard
  // ==========================================================================

  async readClipboard(params: ReadClipboardParams = {}): Promise<OperationResult<ClipboardResult>> {
    try {
      const content = params.format === 'html' 
        ? clipboard.readHTML() 
        : clipboard.readText();
      return { success: true, data: { content } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async writeClipboard(params: WriteClipboardParams): Promise<OperationResult<void>> {
    try {
      if (params.format === 'html') {
        clipboard.writeHTML(params.content);
      } else {
        clipboard.writeText(params.content);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async clearClipboard(): Promise<OperationResult<void>> {
    try {
      clipboard.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // System Information
  // ==========================================================================

  async getSystemInfo(params: GetSystemInfoParams = {}): Promise<OperationResult<SystemInfoResult>> {
    try {
      const data = await this.adapter.system.getSystemInfo(params);
      return { success: true, data: { data } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Network
  // ==========================================================================

  async getNetworkInfo(params: GetNetworkInfoParams = {}): Promise<OperationResult<NetworkInfoResult>> {
    try {
      const data = await this.adapter.network.getNetworkInfo(params);
      return { success: true, data: { data } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async testNetwork(params: TestNetworkParams): Promise<OperationResult<NetworkTestResultData>> {
    try {
      const result = await this.adapter.network.testNetwork(params);
      return { success: true, data: { result } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Services
  // ==========================================================================

  async listServices(params: ListServicesParams = {}): Promise<OperationResult<ServicesListResult>> {
    try {
      const services = await this.adapter.services.listServices(params);
      return { success: true, data: { services } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async controlService(params: ControlServiceParams): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.services.controlService(params);
      if (!result) {
        return { success: false, error: `Failed to ${params.action} service ${params.service}` };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // WiFi Control
  // ==========================================================================

  async getWiFiStatus(): Promise<OperationResult<{ enabled: boolean; connected: boolean; ssid?: string; signalStrength?: number; interfaceName: string }>> {
    try {
      const status = await this.adapter.wifi.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async enableWiFi(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.wifi.enable();
      if (!result) {
        return { success: false, error: 'Failed to enable WiFi' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async disableWiFi(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.wifi.disable();
      if (!result) {
        return { success: false, error: 'Failed to disable WiFi' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async toggleWiFi(): Promise<OperationResult<{ enabled: boolean }>> {
    try {
      const result = await this.adapter.wifi.toggle();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async listWiFiNetworks(): Promise<OperationResult<Array<{ ssid: string; signalStrength: number; authentication: string }>>> {
    try {
      const networks = await this.adapter.wifi.listNetworks();
      return { success: true, data: networks };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async listAvailableWiFi(): Promise<OperationResult<Array<{ ssid: string; signalStrength: number; authentication: string }>>> {
    try {
      const networks = await this.adapter.wifi.listAvailableNetworks();
      return { success: true, data: networks };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Media Control
  // ==========================================================================

  async mediaPlay(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.play();
      if (!result) {
        return { success: false, error: 'Failed to play media' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async mediaPause(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.pause();
      if (!result) {
        return { success: false, error: 'Failed to pause media' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async mediaPlayPause(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.playPause();
      if (!result) {
        return { success: false, error: 'Failed to toggle play/pause' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async mediaNext(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.next();
      if (!result) {
        return { success: false, error: 'Failed to skip to next track' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async mediaPrevious(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.previous();
      if (!result) {
        return { success: false, error: 'Failed to go to previous track' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async mediaStop(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.media.stop();
      if (!result) {
        return { success: false, error: 'Failed to stop media' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Browser Automation
  // ==========================================================================

  async browserOpenUrl(params: { url: string; browser?: string }): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.openUrl(params.url, params.browser);
      if (!result) {
        return { success: false, error: 'Failed to open URL' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserSearch(params: { query: string; engine?: string }): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.search(params.query, params.engine);
      if (!result) {
        return { success: false, error: 'Failed to search' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserNewTab(params: { url?: string } = {}): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.newTab(params.url);
      if (!result) {
        return { success: false, error: 'Failed to open new tab' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserCloseTab(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.closeTab();
      if (!result) {
        return { success: false, error: 'Failed to close tab' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserNextTab(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.nextTab();
      if (!result) {
        return { success: false, error: 'Failed to switch to next tab' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserPreviousTab(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.previousTab();
      if (!result) {
        return { success: false, error: 'Failed to switch to previous tab' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserRefresh(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.refreshTab();
      if (!result) {
        return { success: false, error: 'Failed to refresh page' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async browserBookmark(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.browser.bookmark();
      if (!result) {
        return { success: false, error: 'Failed to bookmark page' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Email Actions
  // ==========================================================================

  async emailCompose(params: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string }): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.email.compose(params);
      if (!result) {
        return { success: false, error: 'Failed to compose email' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async emailOpen(): Promise<OperationResult<void>> {
    try {
      const result = await this.adapter.email.openMailClient();
      if (!result) {
        return { success: false, error: 'Failed to open mail client' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // OCR & Annotation
  // ==========================================================================

  async ocrExtractText(params: { imagePath: string }): Promise<OperationResult<{ text: string }>> {
    try {
      const text = await this.adapter.ocr.extractText(params.imagePath);
      return { success: true, data: { text } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async ocrExtractFromClipboard(): Promise<OperationResult<{ text: string }>> {
    try {
      const text = await this.adapter.ocr.extractTextFromClipboard();
      return { success: true, data: { text } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async ocrExtractFromRegion(): Promise<OperationResult<{ text: string }>> {
    try {
      const text = await this.adapter.ocr.extractTextFromRegion();
      return { success: true, data: { text } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  async screenshotAnnotate(params: { imagePath: string; annotations: import('./index').Annotation[] }): Promise<OperationResult<{ path: string }>> {
    try {
      const outputPath = await this.adapter.ocr.annotateScreenshot(params.imagePath, params.annotations);
      return { success: true, data: { path: outputPath } };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get the current platform
   */
  get platform(): 'windows' | 'macos' | 'linux' {
    return this.adapter.platform;
  }

  /**
   * Format an error into a string message
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let unifiedAdapterInstance: UnifiedPlatformAdapter | null = null;

/**
 * Get the unified platform adapter instance (singleton)
 */
export function getUnifiedAdapter(): UnifiedPlatformAdapter {
  if (!unifiedAdapterInstance) {
    unifiedAdapterInstance = new UnifiedPlatformAdapter();
  }
  return unifiedAdapterInstance;
}

/**
 * Reset the unified adapter instance (useful for testing)
 */
export function resetUnifiedAdapter(): void {
  unifiedAdapterInstance = null;
}

// Export the class for type purposes
export { UnifiedPlatformAdapter };
