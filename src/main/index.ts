// Electron Main Process Entry Point

import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { createTray, destroyTray } from './tray';
import { createCommandWindow, getCommandWindow } from './windows';
import { registerHotkeys, unregisterHotkeys } from './hotkeys';
import { setupIpcHandlers } from './ipc';
import { initStore } from './store';

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

  // Disable GPU to avoid cache permission issues
  app.disableHardwareAcceleration();

  // Disable all caching in development to avoid permission issues
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disk-cache-size', '1');
  app.commandLine.appendSwitch('media-cache-size', '1');
  app.commandLine.appendSwitch('disable-application-cache');
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

  // Create the command window (hidden initially)
  await createCommandWindow();

  // Create system tray
  createTray();

  // Register global hotkeys
  registerHotkeys();

  // Setup IPC handlers for tool communication
  setupIpcHandlers();

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
app.on('before-quit', () => {
  unregisterHotkeys();
  destroyTray();
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
