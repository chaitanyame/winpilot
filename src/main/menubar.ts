// Menu Bar Mode for Desktop Commander
// Provides a menu bar app experience similar to Copilot Bar

import * as path from 'path';
import { BrowserWindow, app } from 'electron';

let mb: any = null;

export interface MenuBarConfig {
  iconPath?: string;
  tooltip?: string;
  showDockIcon?: boolean;
}

/**
 * Initialize menu bar mode (macOS primarily)
 */
export function initMenuBar(config: MenuBarConfig = {}): void {
  // Only enable on macOS by default, as that's where menu bars are standard
  if (process.platform !== 'darwin') {
    console.log('Menu bar mode is primarily for macOS. On Windows/Linux, use system tray mode.');
    return;
  }

  // Dynamically import menubar only on macOS
  try {
    const menubarModule = require('menubar');
    const iconPath = config.iconPath || path.join(__dirname, '../../resources/icon.png');
    const tooltip = config.tooltip || 'WinPilot';

    mb = menubarModule({
      index: getHtmlUrl(),
      icon: iconPath,
      tooltip: tooltip,
      showDockIcon: config.showDockIcon ?? false,
      preloadWindow: true,
      windowOptions: {
        width: 600,
        height: 700,
        resizable: true,
        fullscreenable: false,
        title: 'WinPilot',
        webPreferences: {
          preload: path.join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      },
    });

    // Handle window show/hide
    mb.on('show', () => {
      console.log('Menu bar window shown');
    });

    mb.on('after-show', () => {
      console.log('Menu bar window after show');
      // Focus the input when shown
      const win = mb.window;
      if (win && !win.isDestroyed()) {
        win.webContents.send('focus:input');
      }
    });

    mb.on('hide', () => {
      console.log('Menu bar window hidden');
    });

    mb.on('after-hide', () => {
      console.log('Menu bar window after hide');
    });

    console.log('Menu bar mode initialized');
  } catch (error) {
    console.error('Failed to initialize menubar:', error);
  }
}

/**
 * Get the HTML URL (same logic as command window)
 */
function getHtmlUrl(): string {
  const isDev = !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  return isDev ? devServerUrl : `file://${path.join(__dirname, '../renderer/index.html')}`;
}

/**
 * Show the menu bar window
 */
export function showMenuBar(): void {
  if (mb) {
    mb.showWindow();
  }
}

/**
 * Hide the menu bar window
 */
export function hideMenuBar(): void {
  if (mb) {
    mb.hideWindow();
  }
}

/**
 * Toggle menu bar window visibility
 */
export function toggleMenuBar(): void {
  if (mb) {
    if (mb.window && mb.window.isVisible()) {
      mb.hideWindow();
    } else {
      mb.showWindow();
    }
  }
}

/**
 * Check if menu bar is active
 */
export function isMenuBarActive(): boolean {
  return mb !== null;
}

/**
 * Get the menu bar window (if available)
 */
export function getMenuBarWindow(): BrowserWindow | null {
  return mb?.window || null;
}

/**
 * Clean up menu bar
 */
export function destroyMenuBar(): void {
  if (mb) {
    mb.app.quit();
    mb = null;
  }
}

/**
 * Compact window mode for Windows/Linux
 * Similar to menu bar but using regular Electron window
 */
let compactWindow: BrowserWindow | null = null;

export function initCompactWindow(): void {
  if (process.platform === 'darwin') {
    // Use menubar on macOS
    initMenuBar();
    return;
  }

  // For Windows/Linux, create a compact window
  const { BrowserWindow, screen } = require('electron');

  // Position at top center of screen for menu bar feel
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const windowWidth = 500;
  const x = Math.round((screenWidth - windowWidth) / 2);

  compactWindow = new BrowserWindow({
    width: windowWidth,
    height: 600,
    x,
    y: 0,
    resizable: true,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    frame: true,
    title: 'WinPilot',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (compactWindow) {
    compactWindow.loadURL(getHtmlUrl());
  }

  if (compactWindow) {
      // Optionally hide when focus is lost (like menu bar apps)
    // compactWindow.hide();
  }

  console.log('Compact window mode initialized');
}

/**
 * Show compact window
 */
export function showCompactWindow(): void {
  if (compactWindow && !compactWindow.isDestroyed()) {
    if (compactWindow.isMinimized()) {
      compactWindow.restore();
    }
    compactWindow.show();
    compactWindow.focus();
  }
}

/**
 * Hide compact window
 */
export function hideCompactWindow(): void {
  if (compactWindow && !compactWindow.isDestroyed()) {
    compactWindow.hide();
  }
}

/**
 * Toggle compact window visibility
 */
export function toggleCompactWindow(): void {
  if (process.platform === 'darwin') {
    toggleMenuBar();
  } else if (compactWindow && !compactWindow.isDestroyed()) {
    if (compactWindow.isVisible()) {
      hideCompactWindow();
    } else {
      showCompactWindow();
    }
  }
}

/**
 * Clean up compact window
 */
export function destroyCompactWindow(): void {
  if (compactWindow && !compactWindow.isDestroyed()) {
    compactWindow.destroy();
    compactWindow = null;
  }
}
