// IPC Handlers for Main Process

import { ipcMain, clipboard, shell, dialog, app, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

import { IPC_CHANNELS, ScheduledTask, Timer, ActionLog, Recording, RecordingType } from '../shared/types';
import { MCP_IPC_CHANNELS, MCPServerConfig } from '../shared/mcp-types';
import { getSettings, setSettings, getHistory, addToHistory, clearHistory, getMcpServers, addMcpServer, updateMcpServer, deleteMcpServer, toggleMcpServer, getScheduledTasks, addScheduledTask, updateScheduledTask, deleteScheduledTask, getTaskLogs } from './store';
import { getAppSetting, setAppSetting, deleteAppSetting } from './database';
import { hideCommandWindow, showCommandWindow, resizeCommandWindow, minimizeCommandWindow, maximizeCommandWindow, fitWindowToScreen, getCommandWindow, setAutoHideSuppressed } from './windows';
import { updateHotkey, registerVoiceHotkey, unregisterVoiceHotkey } from './hotkeys';
import { updateTrayMenu } from './tray';
import { getPlatformAdapter } from '../platform';
import { copilotController } from '../copilot/client';
import { cancelAllPendingPermissions, handlePermissionResponse } from './permission-gate';
import { taskScheduler } from './scheduler';
import { voiceInputManager } from './voice-input';
import { timerManager } from './timers';
import { reminderManager } from './reminders';
import { IntentRouter } from '../intent/router';
import { clipboardMonitor } from './clipboard-monitor';
import { recordingManager } from './recording-manager';

// Initialize intent router
const intentRouter = new IntentRouter();
let intentRouterInitialized = false;

// Initialize intent router on first use
async function ensureIntentRouterInitialized() {
  if (!intentRouterInitialized) {
    await intentRouter.initialize();
    intentRouterInitialized = true;
  }
}

// Helper: Transcribe with OpenAI Whisper API
async function transcribeWithOpenAI(audioBuffer: Buffer, language: string, settings: any): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const apiKey = getAppSetting('openai_whisper_api_key');
  
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'OpenAI API key not configured. Please add your API key in Settings -> Voice.' };
  }

  const model = settings.voiceInput.openaiWhisper?.model || 'whisper-1';

  try {
    // Create form data (multipart/form-data)
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    form.append('model', model);
    form.append('language', language);

    // Make request to OpenAI API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `OpenAI API error: ${response.status} ${errorText}` };
    }

    const result = await response.json() as { text: string };
    const transcript = result.text?.trim();

    if (!transcript) {
      return { success: false, error: 'OpenAI API returned empty transcript.' };
    }

    return { success: true, transcript };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Setup all IPC handlers
 */
export function setupIpcHandlers(): void {
  const platform = getPlatformAdapter();

  // App control handlers
  ipcMain.handle('app:getSettings', () => getSettings());
  
  ipcMain.handle('app:setSettings', async (_event: Electron.IpcMainInvokeEvent, settings) => {
    const updated = setSettings(settings);

    // Update hotkey if changed
    if (settings.hotkey) {
      updateHotkey(settings.hotkey);
    }

    // Update voice hotkey if voice input settings changed
    if (settings.voiceInput) {
      if (settings.voiceInput.enabled) {
        registerVoiceHotkey();
      } else {
        unregisterVoiceHotkey();
      }
    }

    // Update tray menu
    updateTrayMenu();

    // Broadcast settings update to renderer
    const window = getCommandWindow();
    window?.webContents.send(IPC_CHANNELS.APP_SETTINGS_UPDATED, updated);

    return updated;
  });

  ipcMain.handle('app:getHistory', () => getHistory());
  ipcMain.handle('app:clearHistory', () => clearHistory());

  ipcMain.on('app:hide', (event: Electron.IpcMainEvent) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const commandWindow = getCommandWindow();
    if (commandWindow && senderWindow === commandWindow) {
      hideCommandWindow();
      return;
    }
    senderWindow?.hide();
  });
  ipcMain.on('app:show', () => showCommandWindow());
  ipcMain.on('app:autoHideSuppressed', (event: Electron.IpcMainEvent, value: boolean) => {
    setAutoHideSuppressed(Boolean(value));
    event.returnValue = true; // Required for sendSync
  });
  ipcMain.on('app:resize', (_event: Electron.IpcMainEvent, height: number) => resizeCommandWindow(height));

  // Window control handlers
  ipcMain.on('app:window:minimize', () => minimizeCommandWindow());
  ipcMain.on('app:window:maximize', () => maximizeCommandWindow());
  ipcMain.on('app:window:fitToScreen', () => fitWindowToScreen());

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

  // Clipboard history handlers
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_GET, () => {
    return clipboardMonitor.getHistory();
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_DELETE, (_, id: string) => {
    return clipboardMonitor.deleteEntry(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_CLEAR, () => {
    clipboardMonitor.clearHistory();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_PIN, (_, id: string) => {
    return clipboardMonitor.togglePin(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_RESTORE, (_, id: string) => {
    return clipboardMonitor.restoreToClipboard(id);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_SEARCH, (_, query: string) => {
    return clipboardMonitor.searchHistory(query);
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_HISTORY_GET_IMAGE, async (_, imagePath: string) => {
    return clipboardMonitor.getImageDataUrl(imagePath);
  });

  // Clipboard paste with auto-paste (supports text, image, and files)
  ipcMain.handle('clipboard:pasteItem', async (_event, entryId: string) => {
    try {
      console.log('[Paste] Starting paste operation for entry:', entryId);
      const { getPlatformAdapter } = await import('../platform');
      const adapter = getPlatformAdapter();

      // 0. Use captured foreground window handle from when clipboard was opened
      const { getPreviousForegroundWindowHandle } = await import('./windows');
      const foregroundHwnd = getPreviousForegroundWindowHandle();
      console.log('[Paste] Stored foreground window handle:', foregroundHwnd);

      // 1. Restore entry to system clipboard
      const restored = clipboardMonitor.restoreToClipboard(entryId);
      if (!restored) {
        return { success: false, error: 'Failed to restore clipboard entry' };
      }
      console.log('[Paste] Entry restored to clipboard');

      // 2. Hide clipboard window
      const { hideClipboardHistoryWindow } = await import('./windows');
      await hideClipboardHistoryWindow();
      console.log('[Paste] Clipboard window hidden');

      // 3. Restore focus to the original foreground window
      if (foregroundHwnd && foregroundHwnd !== 0) {
        await adapter.system.setForegroundWindow(foregroundHwnd);
        console.log('[Paste] Restored focus to window:', foregroundHwnd);

        // 4. Wait for focus to settle
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log('[Paste] No valid foreground window, waiting for OS to restore focus...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[Paste] About to simulate paste...');

      // 5. Simulate Ctrl+V paste (also sets foreground inside script)
      const success = await adapter.system.simulatePaste(foregroundHwnd ?? undefined);
      console.log('[Paste] Paste simulation result:', success);

      return { success };
    } catch (error) {
      console.error('[Paste] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Copilot handlers
  ipcMain.handle(IPC_CHANNELS.COPILOT_SEND_MESSAGE, async (event, message: string) => {
    const sender = event.sender;

    console.log('[IPC] Received message:', message);

    // Add to history
    addToHistory(message);

    try {
      let routeResult = { handled: false, reason: 'Intent router initializing' } as {
        handled: boolean;
        reason?: string;
        response?: string;
        toolName?: string;
        confidence?: number;
        tier?: number | string;
      };

      if (intentRouterInitialized) {
        // Try intent-based routing first (Tier 1 & 2)
        console.log('[IPC] Attempting intent-based routing...');
        routeResult = await intentRouter.route(message);
      } else {
        console.log('[IPC] Intent router not ready, warming in background...');
        ensureIntentRouterInitialized().catch((error) => {
          console.error('[IPC] Intent router init failed:', error);
        });
      }

      if (routeResult.handled) {
        // Local execution successful - stream result and end
        console.log('[IPC] Intent routing handled locally', {
          tier: routeResult.tier,
          tool: routeResult.toolName,
          confidence: routeResult.confidence?.toFixed(2),
        });

        if (!sender.isDestroyed()) {
          sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, routeResult.response);
          sender.send(IPC_CHANNELS.COPILOT_STREAM_END);
        }
        return;
      }

      // Fall back to LLM for complex queries
      console.log('[IPC] Falling back to LLM', { reason: routeResult.reason });
      console.log('[IPC] Starting sendMessageWithLoop generator...');

      // Ensure tool execution can request permissions from the active window.
      copilotController.setActiveWebContents(sender);

      // Use the AsyncGenerator pattern with agentic loop
      for await (const streamEvent of copilotController.sendMessageWithLoop(message)) {
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
            // Tool execution details are shown in the Logs panel; avoid duplicating in chat output.
            break;
          case 'tool_result':
            // Tool execution details are shown in the Logs panel; avoid duplicating in chat output.
            break;
          case 'iteration_start':
            sender.send(IPC_CHANNELS.COPILOT_STREAM_CHUNK, streamEvent.content || '');
            break;
          case 'iteration_complete':
            // Just log, no need to send to UI unless we want progress indicators
            console.log('[IPC] Iteration complete:', streamEvent.iterationNumber);
            break;
          case 'loop_complete':
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
    } finally {
      cancelAllPendingPermissions();
      copilotController.setActiveWebContents(null);
    }
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CANCEL, async () => {
    cancelAllPendingPermissions();
    await copilotController.cancel();
  });

  ipcMain.handle(IPC_CHANNELS.COPILOT_CLEAR_SESSION, async () => {
    await copilotController.clearHistory();
  });

  // Permission handlers
  ipcMain.on(IPC_CHANNELS.APP_PERMISSION_RESPONSE, (_event: Electron.IpcMainEvent, response: unknown) => {
    handlePermissionResponse(response as import('../shared/types').PermissionResponse);
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

  // Scheduled Tasks handlers
  ipcMain.handle('task:list', () => {
    return getScheduledTasks();
  });

  ipcMain.handle('task:add', async (_, task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask = addScheduledTask(task);

    if (newTask.enabled) {
      taskScheduler.scheduleTask(newTask);
    }

    return newTask;
  });

  ipcMain.handle('task:update', async (_, id: string, updates: Partial<ScheduledTask>) => {
    const updated = updateScheduledTask(id, updates);

    if (!updated) {
      throw new Error('Task not found');
    }

    // Reschedule if enabled
    if (updated.enabled) {
      taskScheduler.scheduleTask(updated);
    } else {
      taskScheduler.unscheduleTask(id);
    }

    return updated;
  });

  ipcMain.handle('task:delete', async (_, id: string) => {
    taskScheduler.unscheduleTask(id);
    return deleteScheduledTask(id);
  });

  ipcMain.handle('task:toggle', async (_, id: string) => {
    const task = getScheduledTasks().find(t => t.id === id);
    if (!task) throw new Error('Task not found');

    const updated = updateScheduledTask(id, { enabled: !task.enabled });

    if (updated && updated.enabled) {
      taskScheduler.scheduleTask(updated);
    } else if (updated) {
      taskScheduler.unscheduleTask(id);
    }

    return updated;
  });

  ipcMain.handle('task:execute', async (_, id: string) => {
    await taskScheduler.executeTask(id);
    return { success: true };
  });

  ipcMain.handle('task:logs', () => {
    return getTaskLogs();
  });

  // Voice input handlers
  ipcMain.handle('voice:test', async () => {
    // Test voice recognition by toggling
    await voiceInputManager.toggleRecording();
    return { success: true };
  });

  ipcMain.handle('voice:isRecording', () => {
    return voiceInputManager.getIsRecording();
  });

  ipcMain.handle('voice:transcript', (_, transcript: string) => {
    // This is called from renderer when browser speech recognition completes
    voiceInputManager.sendTranscript(transcript);
    return { success: true };
  });

  ipcMain.handle('voice:transcribe', async (_evt, payload: { audio: ArrayBuffer; mimeType: string; language?: string }) => {
    try {
      const settings = getSettings();
      if (!settings.voiceInput?.enabled) {
        return { success: false, error: 'Voice input is disabled in settings.' };
      }

      const provider = settings.voiceInput.provider;
      const audioBuffer = Buffer.from(payload.audio);
      const language = payload.language?.trim() || 'en';

      // Route to appropriate provider
      if (provider === 'openai_whisper') {
        return await transcribeWithOpenAI(audioBuffer, language, settings);
      } else if (provider === 'browser') {
        // Browser provider is handled in renderer, this should not be called
        return { success: false, error: 'Browser provider should be handled in renderer process.' };
      } else {
        return { success: false, error: `Unknown provider: ${provider}. Use browser or openai_whisper.` };
      }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  // OpenAI API key management (never sent to renderer)
  ipcMain.handle('voice:getApiKeyStatus', () => {
    const apiKey = getAppSetting('openai_whisper_api_key');
    return { hasKey: Boolean(apiKey && apiKey.trim()) };
  });

  ipcMain.handle('voice:setApiKey', (_evt, apiKey: string) => {
    if (apiKey && apiKey.trim()) {
      setAppSetting('openai_whisper_api_key', apiKey.trim());
      return { success: true };
    } else {
      deleteAppSetting('openai_whisper_api_key');
      return { success: true };
    }
  });

  ipcMain.handle('voice:clearApiKey', () => {
    deleteAppSetting('openai_whisper_api_key');
    return { success: true };
  });

  // Action logs export (renderer keeps logs in-memory; this just persists them to disk)
  ipcMain.handle('logs:export', async (_evt, payload: { logs: ActionLog[]; suggestedName?: string }) => {
    try {
      const suggestedName = (payload.suggestedName && payload.suggestedName.trim()) || `desktop-commander-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const result = await dialog.showSaveDialog({
        title: 'Export Logs',
        defaultPath: path.join(app.getPath('documents'), suggestedName),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      // Electron's typings have varied across versions (some return a string filePath).
      const resultAny: any = result as any;
      const filePath = typeof result === 'string' ? result : resultAny.filePath;
      const cancelled = typeof result === 'string' ? !result : resultAny.canceled;

      if (cancelled || !filePath) {
        return { success: true, cancelled: true };
      }

      const output = {
        exportedAt: Date.now(),
        app: {
          name: 'Desktop Commander',
          version: app.getVersion(),
        },
        logs: payload.logs || [],
      };

      await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf8');
      return { success: true, path: filePath };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  // Timer handlers
  ipcMain.handle('timer:list', () => {
    return timerManager.getAllTimers();
  });

  ipcMain.handle('timer:get', (_, id: string) => {
    return timerManager.getTimer(id);
  });

  ipcMain.handle('timer:create', (_, { type, name, options }) => {
    const timer = timerManager.createTimer(type, name, options);
    // Notify renderer about timer update
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:start', (_, id: string) => {
    const timer = timerManager.startTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:pause', (_, id: string) => {
    const timer = timerManager.pauseTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:reset', (_, id: string) => {
    const timer = timerManager.resetTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  ipcMain.handle('timer:delete', (_, id: string) => {
    const success = timerManager.deleteTimer(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:deleted', id);
    }
    return success;
  });

  ipcMain.handle('timer:skip', (_, id: string) => {
    const timer = timerManager.skipPomodoroPhase(id);
    const mainWindow = getCommandWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:updated', timer);
    }
    return timer;
  });

  // Subscribe to timer updates
  ipcMain.on('timer:subscribe', (event: Electron.IpcMainEvent) => {
    const timerTickHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:tick', timer);
      }
    };

    const timerCreatedHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:created', timer);
      }
    };

    const timerCompletedHandler = (timer: Timer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('timer:completed', timer);
      }
    };

    timerManager.on('timer-tick', timerTickHandler);
    timerManager.on('timer-created', timerCreatedHandler);
    timerManager.on('timer-completed', timerCompletedHandler);

    // Clean up on window close
    event.sender.on('destroyed', () => {
      timerManager.off('timer-tick', timerTickHandler);
      timerManager.off('timer-created', timerCreatedHandler);
      timerManager.off('timer-completed', timerCompletedHandler);
    });
  });

  // Reminder handlers
  ipcMain.handle('reminder:list', () => {
    return reminderManager.getActiveReminders();
  });

  ipcMain.handle('reminder:cancel', async (_event: Electron.IpcMainInvokeEvent, id: string) => {
    return reminderManager.cancelReminder(id);
  });

  ipcMain.handle('reminder:delete', async (_event: Electron.IpcMainInvokeEvent, id: string) => {
    return reminderManager.cancelReminder(id);
  });

  ipcMain.handle('reminder:create', async (_event: Electron.IpcMainInvokeEvent, { message, delayMinutes, scheduledTime }) => {
    const time = scheduledTime ? new Date(scheduledTime) : undefined;
    const reminder = delayMinutes
      ? reminderManager.createReminderWithDelay(message, delayMinutes)
      : reminderManager.createReminder(message, time!);
    return reminder;
  });

  // Subscribe to reminder events
  ipcMain.on('reminder:subscribe', (event: Electron.IpcMainEvent) => {
    const reminderCreatedHandler = (reminder: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:created', reminder);
      }
    };

    const reminderTriggeredHandler = (reminder: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:triggered', reminder);
      }
    };

    const reminderCancelledHandler = (id: unknown) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('reminder:cancelled', id);
      }
    };

    reminderManager.on('reminder-created', reminderCreatedHandler);
    reminderManager.on('reminder-triggered', reminderTriggeredHandler);
    reminderManager.on('reminder-cancelled', reminderCancelledHandler);

    // Clean up on window close
    event.sender.on('destroyed', () => {
      reminderManager.off('reminder-created', reminderCreatedHandler);
      reminderManager.off('reminder-triggered', reminderTriggeredHandler);
      reminderManager.off('reminder-cancelled', reminderCancelledHandler);
    });
  });

  // Chat history handlers
  ipcMain.handle('chat:start', (_, title) => {
    const { startChatSession } = require('./chat-history');
    return startChatSession(title);
  });

  ipcMain.handle('chat:getHistory', (_, conversationId) => {
    const { getConversationHistory } = require('./chat-history');
    return getConversationHistory(conversationId);
  });

  ipcMain.handle('chat:getConversations', () => {
    const { getAllConversations } = require('./chat-history');
    return getAllConversations();
  });

  ipcMain.handle('chat:loadConversation', (_, id) => {
    const { loadConversation } = require('./chat-history');
    return loadConversation(id);
  });

  ipcMain.handle('chat:deleteConversation', (_, id) => {
    const { deleteConversation } = require('./chat-history');
    return deleteConversation(id);
  });

  ipcMain.handle('chat:search', (_, query) => {
    const { searchConversations } = require('./chat-history');
    return searchConversations(query);
  });

  ipcMain.handle('chat:getStats', () => {
    const { getChatStatistics } = require('./chat-history');
    return getChatStatistics();
  });

  // Menu bar mode handlers
  ipcMain.handle('menubar:init', (_, config) => {
    const { initCompactWindow } = require('./menubar');
    const platform = process.platform;

    if (platform === 'darwin') {
      const { initMenuBar } = require('./menubar');
      initMenuBar(config);
      return { mode: 'menubar', platform };
    } else {
      initCompactWindow();
      return { mode: 'compact', platform };
    }
  });

  ipcMain.handle('menubar:show', () => {
    if (process.platform === 'darwin') {
      const { showMenuBar } = require('./menubar');
      showMenuBar();
    } else {
      const { showCompactWindow } = require('./menubar');
      showCompactWindow();
    }
  });

  ipcMain.handle('menubar:hide', () => {
    if (process.platform === 'darwin') {
      const { hideMenuBar } = require('./menubar');
      hideMenuBar();
    } else {
      const { hideCompactWindow } = require('./menubar');
      hideCompactWindow();
    }
  });

  ipcMain.handle('menubar:toggle', () => {
    if (process.platform === 'darwin') {
      const { toggleMenuBar } = require('./menubar');
      toggleMenuBar();
    } else {
      const { toggleCompactWindow } = require('./menubar');
      toggleCompactWindow();
    }
  });

  ipcMain.handle('menubar:isActive', () => {
    if (process.platform === 'darwin') {
      const { isMenuBarActive } = require('./menubar');
      return isMenuBarActive();
    } else {
      return true; // Compact window is always "active" if initialized
    }
  });

  // Folder selection dialog
  ipcMain.handle('dialog:selectFolder', async (_, options?: { title?: string; defaultPath?: string }) => {
    const result: { canceled: boolean; filePaths: string[] } = await dialog.showOpenDialog({
      title: options?.title || 'Select Folder',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    }) as any;

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }

    return { cancelled: false, path: result.filePaths[0] };
  });

  // Get app path (for default recording location)
  ipcMain.handle('app:getAppPath', () => {
    return app.isPackaged
      ? path.dirname(app.getPath('exe'))
      : app.getAppPath();
  });

  // Recording handlers
  ipcMain.handle(IPC_CHANNELS.RECORDING_LIST, () => {
    return recordingManager.getAllRecordings();
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_GET, (_, idOrType?: string) => {
    return recordingManager.getStatus(idOrType);
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_DELETE, async (_, id: string) => {
    const recording = recordingManager.getStatus(id);
    if (!recording) {
      return { success: false, error: 'Recording not found' };
    }

    // Delete the file
    try {
      if (fsSync.existsSync(recording.outputPath)) {
        await fs.unlink(recording.outputPath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete recording' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_OPEN, async (_, filePath: string) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open recording' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_OPEN_FOLDER, (_, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async (_, idOrType?: string | RecordingType) => {
    try {
      const recording = await recordingManager.stopRecording(idOrType);
      return { success: true, recording };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to stop recording' };
    }
  });

  // Subscribe to recording events
  ipcMain.on(IPC_CHANNELS.RECORDING_SUBSCRIBE, (event: Electron.IpcMainEvent) => {
    const progressHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_PROGRESS, recording);
      }
    };

    const startedHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    const stoppedHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    const errorHandler = (recording: Recording) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.RECORDING_UPDATED, recording);
      }
    };

    recordingManager.on('recording-progress', progressHandler);
    recordingManager.on('recording-started', startedHandler);
    recordingManager.on('recording-stopped', stoppedHandler);
    recordingManager.on('recording-error', errorHandler);

    // Clean up on window close
    event.sender.on('destroyed', () => {
      recordingManager.off('recording-progress', progressHandler);
      recordingManager.off('recording-started', startedHandler);
      recordingManager.off('recording-stopped', stoppedHandler);
      recordingManager.off('recording-error', errorHandler);
    });
  });
}
