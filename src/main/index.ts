// Electron Main Process Entry Point

import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { createTray, destroyTray } from './tray';
import { createCommandWindow, getCommandWindow } from './windows';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { setupIpcHandlers } from './ipc';
import { initStore } from './store';
import { taskScheduler } from './scheduler';
import { timerManager } from './timers';
import { initDatabase, closeDatabase } from './database';
import { reminderManager } from './reminders';
import { copilotController } from '../copilot/client';
import { clipboardMonitor } from './clipboard-monitor';
import { clipboardWatcher } from './clipboard-watcher';
import { ensureInstalledAppsCache } from './app-indexer';
import { screenSharePrivacyService } from './screen-share-privacy';
import { screenShareDetector } from './screen-share-detector';
import { getSettings } from './store';
import { hideCommandWindow } from './windows';
import { voiceInputManager } from './voice-input';
import { createOSDWindow, destroyOSDWindow } from './osd-window';

// In development, use a separate userData directory to avoid conflicts
if (!app.isPackaged) {
  // Use a unique dev directory in the project folder itself
  const devUserData = path.join(__dirname, '../../.electron-dev');

  // Ensure directory exists with proper permissions
  try {
    if (!fs.existsSync(devUserData)) {
      fs.mkdirSync(devUserData, { recursive: true });
    }
    // Create cache directories with proper permissions
    const cacheDir = path.join(devUserData, 'Cache');
    const gpuCacheDir = path.join(devUserData, 'GPUCache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    if (!fs.existsSync(gpuCacheDir)) {
      fs.mkdirSync(gpuCacheDir, { recursive: true });
    }
  } catch (e) {
    console.log('Could not create dev userData dir:', e);
  }

  app.setPath('userData', devUserData);

  // Disable all caching in development to avoid permission issues
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disk-cache-size', '1');
  app.commandLine.appendSwitch('media-cache-size', '1');
  app.commandLine.appendSwitch('disable-application-cache');
}

// CRITICAL: Disable hardware acceleration to fix getUserMedia crash with transparent windows
// This affects both dev and production builds on Windows
// The crash occurs because of how Chromium handles media capture with GPU-accelerated transparent windows
app.disableHardwareAcceleration();

// Add flags to fix getUserMedia crash with transparent windows on Windows
// These need to be set before app is ready
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');
// Use software rendering for transparency to avoid GPU-related crashes
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not available, ignore
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getCommandWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// App initialization
async function initApp() {
  // Initialize settings store
  initStore();

  // Initialize SQLite database
  initDatabase();
  screenSharePrivacyService.init();

  // Setup media permissions - CRITICAL for getUserMedia to work without crashes
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Allow all media permissions (media covers both microphone and camera)
    if (permission === 'media') {
      console.log('[Permissions] Granting media permission:', permission);
      callback(true);
      return;
    }
    // Allow other common permissions
    if (permission === 'notifications' || permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
      callback(true);
      return;
    }
    console.log('[Permissions] Denying permission:', permission);
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, _requestingOrigin) => {
    // Always allow media permissions
    if (permission === 'media') {
      return true;
    }
    return true; // Allow other permissions by default
  });

  // Refresh installed apps cache (skip if last run < 6 hours)
  await ensureInstalledAppsCache();

  // Create the command window (hidden initially)
  await createCommandWindow();

  // Pre-warm OSD window for instant display
  createOSDWindow();

  screenShareDetector.start();
  screenShareDetector.onChange((active) => {
    console.log('[ScreenShareDetector] onChange fired, active:', active);
    if (!active) return;
    const settings = getSettings();
    if (settings.screenSharePrivacy?.autoHideOnShare) {
      const isRecording = voiceInputManager.getIsRecording();
      console.log('[ScreenShareDetector] Voice recording status:', isRecording);
      // Don't auto-hide if voice recording is active
      if (!isRecording) {
        console.log('[ScreenShareDetector] Auto-hiding window due to screen share detection');
        hideCommandWindow(true);
      } else {
        console.log('[ScreenShareDetector] Skipping auto-hide because voice recording is active');
      }
    }
  });

  // Create system tray
  createTray();

  // Register global hotkeys
  registerHotkeys();

  // Setup IPC handlers for tool communication
  setupIpcHandlers();

  // Initialize task scheduler
  await taskScheduler.init();

  // Start clipboard monitoring (event-driven on Windows; polling fallback)
  const usingEvents = clipboardWatcher.start();
  clipboardMonitor.startMonitoring(!usingEvents);
  if (usingEvents) {
    clipboardWatcher.on('change', () => {
      clipboardMonitor.checkClipboard();
    });
  }

  // Pre-initialize the copilot session to reduce first-question latency
  try {
    await copilotController.initialize();
    console.log('Copilot session pre-initialized');
  } catch (error) {
    console.error('Failed to pre-initialize copilot session:', error);
    // Don't block app startup if copilot fails to initialize
    // It will be retried when the user sends their first message
  }

  console.log('Desktop Commander initialized');
}

// App ready
app.whenReady().then(initApp);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createCommandWindow();
  }
});

  // Cleanup before quit
  app.on('before-quit', async () => {
    await copilotController.destroy();
    taskScheduler.destroy();
    timerManager.destroy();
    reminderManager.destroy();
    clipboardWatcher.stop();
    clipboardMonitor.destroy();
    screenSharePrivacyService.clear();
    screenShareDetector.stop();
    closeDatabase();
    unregisterHotkeys();
    destroyTray();
    destroyOSDWindow();
  });

// Handle certificate errors (for development)
app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Export for use in other modules
export { app };
