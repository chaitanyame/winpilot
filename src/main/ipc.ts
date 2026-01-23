// IPC Handlers for Main Process

import { ipcMain, clipboard, shell } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import { MCP_IPC_CHANNELS, MCPServerConfig } from '../shared/mcp-types';
import { getSettings, setSettings, getHistory, addToHistory, clearHistory, getMcpServers, addMcpServer, updateMcpServer, deleteMcpServer, toggleMcpServer } from './store';
import { hideCommandWindow, resizeCommandWindow } from './windows';
import { updateHotkey } from './hotkeys';
import { updateTrayMenu } from './tray';
import { getPlatformAdapter } from '../platform';
import { copilotController } from '../copilot/client';

/**
 * Setup all IPC handlers
 */
export function setupIpcHandlers(): void {
  const platform = getPlatformAdapter();

  // App control handlers
  ipcMain.handle('app:getSettings', () => getSettings());
  
  ipcMain.handle('app:setSettings', async (_, settings) => {
    const updated = setSettings(settings);
    
    // Update hotkey if changed
    if (settings.hotkey) {
      updateHotkey(settings.hotkey);
    }
    
    // Update tray menu
    updateTrayMenu();
    
    return updated;
  });

  ipcMain.handle('app:getHistory', () => getHistory());
  ipcMain.handle('app:clearHistory', () => clearHistory());
  
  ipcMain.on('app:hide', () => hideCommandWindow());
  ipcMain.on('app:resize', (_, height: number) => resizeCommandWindow(height));

  // Window management handlers
  ipcMain.handle(IPC_CHANNELS.WINDOW_LIST, async () => {
    return platform.windowManager.listWindows();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, async (_, params) => {
    return platform.windowManager.focusWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MOVE, async (_, params) => {
    return platform.windowManager.moveWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (_, params) => {
    return platform.windowManager.closeWindow(params);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (_, windowId) => {
    return platform.windowManager.minimizeWindow(windowId);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (_, windowId) => {
    return platform.windowManager.maximizeWindow(windowId);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_ARRANGE, async (_, params) => {
    return platform.windowManager.arrangeWindows(params);
  });

  // File system handlers
  ipcMain.handle(IPC_CHANNELS.FILES_LIST, async (_, params) => {
    return platform.fileSystem.listFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_SEARCH, async (_, params) => {
    return platform.fileSystem.searchFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_MOVE, async (_, params) => {
    return platform.fileSystem.moveFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_COPY, async (_, params) => {
    return platform.fileSystem.copyFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_DELETE, async (_, params) => {
    return platform.fileSystem.deleteFiles(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_RENAME, async (_, params) => {
    return platform.fileSystem.renameFile(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_CREATE_FOLDER, async (_, path) => {
    return platform.fileSystem.createFolder(path);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_READ, async (_, params) => {
    return platform.fileSystem.readFile(params);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_INFO, async (_, path) => {
    return platform.fileSystem.getFileInfo(path);
  });

  // Application handlers
  ipcMain.handle(IPC_CHANNELS.APPS_LIST, async (_, filter) => {
    return platform.apps.listApps(filter);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_LAUNCH, async (_, params) => {
    return platform.apps.launchApp(params);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_QUIT, async (_, params) => {
    return platform.apps.quitApp(params);
  });

  ipcMain.handle(IPC_CHANNELS.APPS_SWITCH, async (_, name) => {
    return platform.apps.switchToApp(name);
  });

  // System control handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_VOLUME, async (_, params) => {
    return platform.system.volume(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_BRIGHTNESS, async (_, params) => {
    return platform.system.brightness(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SCREENSHOT, async (_, params) => {
    return platform.system.screenshot(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_DND, async (_, params) => {
    return platform.system.doNotDisturb(params);
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_LOCK, async () => {
    return platform.system.lockScreen();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SLEEP, async () => {
    return platform.system.sleep();
  });

  // Process handlers
  ipcMain.handle(IPC_CHANNELS.PROCESS_LIST, async (_, params) => {
    return platform.process.listProcesses(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_INFO, async (_, params) => {
    return platform.process.getProcessInfo(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_KILL, async (_, params) => {
    return platform.process.killProcess(params);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_TOP, async (_, params) => {
    return platform.process.getTopProcesses(params);
  });

  // Clipboard handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ, async (_, format) => {
    switch (format) {
      case 'html':
        return clipboard.readHTML();
      case 'image':
        return clipboard.readImage().toDataURL();
      default:
        return clipboard.readText();
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE, async (_, { content, format }) => {
    if (format === 'html') {
      clipboard.writeHTML(content);
    } else {
      clipboard.writeText(content);
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CLEAR, async () => {
    clipboard.clear();
    return true;
  });

  // Copilot handlers
  ipcMain.handle(IPC_CHANNELS.COPILOT_SEND_MESSAGE, async (event, message: string) => {
    const sender = event.sender;
    
    console.log('[IPC] Received message:', message);
    
    // Add to history
    addToHistory(message);

    try {
      console.log('[IPC] Starting sendMessage generator...');
      // Use the AsyncGenerator pattern from copilotController
      for await (const streamEvent of copilotController.sendMessage(message)) {
        // Check if sender is still valid before sending
        if (sender.isDestroyed()) {
          console.log('[IPC] Sender destroyed, stopping stream');
          return;
        }
        console.log('[IPC] Stream event:', streamEvent.type, streamEvent.content?.substring(0, 50));
        switch (streamEvent.type) {
          case 'text':
            sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content);
            break;
          case 'tool_call':
            sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content);
            break;
          case 'tool_result':
            sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content);
            break;
          case 'error':
            console.error('[IPC] Stream error:', streamEvent.error);
            if (!sender.isDestroyed()) {
              sender.send(IPC_CHANNELS.COPILOT_STREAM_END, { error: streamEvent.error });
            }
            return;
          case 'done':
            console.log('[IPC] Stream done');
            if (!sender.isDestroyed()) {
              sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
            }
            return;
        }
      }
      console.log('[IPC] Generator exhausted');
      if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
      }
    } catch (error) {
      console.error('Copilot error:', error);
      if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.COPILOT_STREAM_END, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CANCEL, async () => {
    await copilotController.cancel();
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CLEAR_SESSION, async () => {
    await copilotController.clearHistory();
  });

  // Shell handlers
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    // Validate URL protocol to prevent arbitrary protocol execution
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http and https URLs are allowed');
    }
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    // Block dangerous executable file types
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse',
      '.ws', '.wsf', '.wsc', '.wsh', '.msc', '.msi', '.msp', '.com',
      '.scr', '.hta', '.cpl', '.jar', '.reg'
    ];
    const ext = path.toLowerCase().slice(path.lastIndexOf('.'));
    if (dangerousExtensions.includes(ext)) {
      throw new Error(`Opening ${ext} files is not allowed for security reasons`);
    }
    await shell.openPath(path);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, path: string) => {
    shell.showItemInFolder(path);
  });

  // MCP Server handlers
  ipcMain.handle(MCP_IPC_CHANNELS.MCP_LIST, () => {
    return getMcpServers();
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_ADD, async (_, config: MCPServerConfig) => {
    const server = addMcpServer(config);
    // Notify copilot to update session with new MCP servers
    copilotController.notifyMcpServersChanged();
    return server;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_UPDATE, async (_, id: string, config: Partial<MCPServerConfig>) => {
    const server = updateMcpServer(id, config);
    if (server) {
      copilotController.notifyMcpServersChanged();
    }
    return server;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_DELETE, async (_, id: string) => {
    const success = deleteMcpServer(id);
    if (success) {
      copilotController.notifyMcpServersChanged();
    }
    return success;
  });

  ipcMain.handle(MCP_IPC_CHANNELS.MCP_TOGGLE, async (_, id: string) => {
    const server = toggleMcpServer(id);
    if (server) {
      copilotController.notifyMcpServersChanged();
    }
    return server;
  });
}
