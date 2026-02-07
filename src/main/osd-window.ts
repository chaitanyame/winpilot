// OSD (On-Screen Display) Feedback Window
// Transparent overlay that shows visual feedback for volume, brightness, mute

import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export type OSDType = 'volume' | 'brightness' | 'mute';

export interface OSDData {
  type: OSDType;
  value: number;      // 0-100 for volume/brightness, 0 or 1 for mute
  label?: string;     // Optional override label
}

let osdWindow: BrowserWindow | null = null;
let dismissTimer: NodeJS.Timeout | null = null;

/**
 * Pre-warm the OSD window on app startup (hidden).
 * This eliminates first-show latency.
 */
export function createOSDWindow(): void {
  if (osdWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  osdWindow = new BrowserWindow({
    width: 200,
    height: 200,
    x: Math.round((screenWidth - 200) / 2),
    y: screenHeight - 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Make click-through (Windows)
  osdWindow.setIgnoreMouseEvents(true);

  // Load the OSD HTML
  if (process.env.VITE_DEV_SERVER_URL) {
    osdWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#osd`);
  } else {
    osdWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'osd',
    });
  }

  osdWindow.on('closed', () => {
    osdWindow = null;
  });
}

/**
 * Show the OSD with given data.
 * Debounces: rapid calls reset the dismiss timer.
 */
export function showOSD(data: OSDData): void {
  if (!osdWindow) {
    createOSDWindow();
  }

  // Clear previous dismiss timer
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  // Send data to renderer
  osdWindow!.webContents.send('osd:update', data);

  // Show window
  if (!osdWindow!.isVisible()) {
    osdWindow!.showInactive(); // Show without stealing focus
  }

  // Auto-dismiss after 1500ms
  dismissTimer = setTimeout(() => {
    if (osdWindow && osdWindow.isVisible()) {
      osdWindow.webContents.send('osd:hide');
      // Give animation time to complete before actually hiding
      setTimeout(() => {
        if (osdWindow) osdWindow.hide();
      }, 300);
    }
    dismissTimer = null;
  }, 1500);
}

/**
 * Clean up OSD window.
 */
export function destroyOSDWindow(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  if (osdWindow) {
    osdWindow.destroy();
    osdWindow = null;
  }
}
