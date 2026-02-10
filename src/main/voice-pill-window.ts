// Voice Pill Window Manager
// Displays a floating pill UI during voice-to-clipboard recording

import { BrowserWindow, screen } from 'electron';
import path from 'path';

let pillWindow: BrowserWindow | null = null;

export function createVoicePillWindow(): BrowserWindow {
  if (pillWindow && !pillWindow.isDestroyed()) {
    return pillWindow;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  pillWindow = new BrowserWindow({
    width: 200,
    height: 44,
    x: Math.floor((screenWidth - 200) / 2), // Center horizontally
    y: 60, // Near top of screen
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Set window to be ignored by mouse events (click-through)
  pillWindow.setIgnoreMouseEvents(true);

  // Load the pill HTML
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDev) {
    pillWindow.loadFile(path.join(__dirname, '../../src/renderer/voice-pill/index.html'));
  } else {
    pillWindow.loadFile(path.join(__dirname, '../renderer/voice-pill/index.html'));
  }

  pillWindow.on('closed', () => {
    pillWindow = null;
  });

  return pillWindow;
}

export function showVoicePill(state: 'listening' | 'transcribing' | 'success' | 'error', message?: string): void {
  const window = createVoicePillWindow();
  
  if (window && !window.isDestroyed()) {
    // Send state to renderer
    window.webContents.send('pill:setState', { state, message });
    
    // Show window
    if (!window.isVisible()) {
      window.show();
    }
  }
}

export function hideVoicePill(): void {
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.hide();
  }
}

export function updateVoicePillState(state: 'listening' | 'transcribing' | 'success' | 'error', message?: string): void {
  if (pillWindow && !pillWindow.isDestroyed() && pillWindow.webContents) {
    pillWindow.webContents.send('pill:setState', { state, message });
  }
}

export function destroyVoicePill(): void {
  if (pillWindow && !pillWindow.isDestroyed()) {
    pillWindow.close();
  }
  pillWindow = null;
}
