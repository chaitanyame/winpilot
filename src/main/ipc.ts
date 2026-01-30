// IPC Handlers for Main Process

import { ipcMain, clipboard, shell } from 'electron';
import { IPC_CHANNELS, ScheduledTask, Timer } from '../shared/types';
import { MCP_IPC_CHANNELS, MCPServerConfig } from '../shared/mcp-types';
import { getSettings, setSettings, getHistory, addToHistory, clearHistory, getMcpServers, addMcpServer, updateMcpServer, deleteMcpServer, toggleMcpServer, getScheduledTasks, addScheduledTask, updateScheduledTask, deleteScheduledTask, getTaskLogs } from './store';
import { hideCommandWindow, resizeCommandWindow, minimizeCommandWindow, maximizeCommandWindow, fitWindowToScreen, getCommandWindow } from './windows';
import { updateHotkey, registerVoiceHotkey, unregisterVoiceHotkey } from './hotkeys';
import { updateTrayMenu } from './tray';
import { getPlatformAdapter } from '../platform';
import { copilotController } from '../copilot/client';
import { cancelAllPendingPermissions, handlePermissionResponse } from './permission-gate';
import { taskScheduler } from './scheduler';
import { voiceInputManager } from './voice-input';
import { timerManager } from './timers';
import { reminderManager } from './reminders';

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

    return updated;
  });

  ipcMain.handle('app:getHistory', () => getHistory());
  ipcMain.handle('app:clearHistory', () => clearHistory());

  ipcMain.on('app:hide', () => hideCommandWindow());
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

  // Copilot handlers
  ipcMain.handle(IPC_CHANNELS.COPILOT_SEND_MESSAGE, async (event, message: string) => {
    const sender = event.sender;

    console.log('[IPC] Received message:', message);

    // Add to history
    addToHistory(message);

    try {
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
}
