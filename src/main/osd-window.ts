// OSD (On-Screen Display) Window Manager
// Displays transparent overlay feedback for volume, brightness, and mute changes

import { BrowserWindow, screen, app } from 'electron';
import path from 'path';

export type OSDType = 'volume' | 'brightness' | 'mute';

export interface OSDData {
  type: OSDType;
  value: number;      // 0-100 for volume/brightness, 0 or 1 for mute
  label?: string;     // Optional override label
}

let osdWindow: BrowserWindow | null = null;
let dismissTimer: NodeJS.Timeout | null = null;

/**
 * Create the OSD overlay window (pre-warmed, hidden).
 * Call this once during app initialization so the window is ready
 * to show instantly when an OSD event fires.
 */
export function createOSDWindow(): void {
  if (osdWindow && !osdWindow.isDestroyed()) {
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const displayBounds = primaryDisplay.bounds;

  const windowWidth = 200;
  const windowHeight = 200;

  // Position: bottom-center of primary display, 300px from bottom
  const x = displayBounds.x + Math.floor((screenWidth - windowWidth) / 2);
  const y = displayBounds.y + screenHeight - windowHeight - 300;

  osdWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Make the window click-through so it never intercepts user input
  osdWindow.setIgnoreMouseEvents(true);

  // Load the renderer with the #osd hash route
  const isDev = !app.isPackaged;
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (isDev && VITE_DEV_SERVER_URL) {
    osdWindow.loadURL(`${VITE_DEV_SERVER_URL}#osd`);
  } else {
    osdWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'osd',
    });
  }

  osdWindow.on('closed', () => {
    osdWindow = null;
  });

  console.log('[OSD] Window created (pre-warmed, hidden)');
}

/**
 * Show the OSD overlay with the given data.
 * Sends data to the renderer, shows the window without stealing focus,
 * and auto-dismisses after 1500ms with a fade-out animation.
 */
export function showOSD(data: OSDData): void {
  // Ensure the window exists
  if (!osdWindow || osdWindow.isDestroyed()) {
    createOSDWindow();
  }

  if (!osdWindow || osdWindow.isDestroyed()) {
    console.warn('[OSD] Failed to create OSD window');
    return;
  }

  // Clear any existing dismiss timer (debounce rapid calls)
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  // Send the OSD data to the renderer
  osdWindow.webContents.send('osd:update', data);

  // Show without stealing focus
  if (!osdWindow.isVisible()) {
    osdWindow.showInactive();
  }

  // Set auto-dismiss timer: send hide signal, then actually hide after animation
  dismissTimer = setTimeout(() => {
    if (osdWindow && !osdWindow.isDestroyed()) {
      // Tell renderer to start fade-out animation
      osdWindow.webContents.send('osd:hide');

      // Wait for the CSS animation to complete (300ms), then hide the window
      setTimeout(() => {
        if (osdWindow && !osdWindow.isDestroyed()) {
          osdWindow.hide();
        }
      }, 300);
    }
    dismissTimer = null;
  }, 1500);
}

/**
 * Destroy the OSD window and clean up timers.
 * Call this during app shutdown.
 */
export function destroyOSDWindow(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  if (osdWindow && !osdWindow.isDestroyed()) {
    // Remove closable restriction so we can actually destroy it
    osdWindow.setClosable(true);
    osdWindow.destroy();
  }
  osdWindow = null;

  console.log('[OSD] Window destroyed');
}
