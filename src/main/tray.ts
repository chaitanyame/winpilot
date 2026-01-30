// System Tray Management

import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { getCommandWindow, showCommandWindow } from './windows';
import { getSettings } from './store';

let tray: Tray | null = null;

/**
 * Create the system tray icon and menu
 */
export function createTray(): Tray {
  // Create tray icon
  const iconPath = path.join(__dirname, '../../resources/icon.png');
  
  // Create a fallback icon if the file doesn't exist
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createDefaultIcon();
    }
  } catch {
    icon = createDefaultIcon();
  }

  tray = new Tray(icon);
  tray.setToolTip('WinPilot');

  // Create context menu
  updateTrayMenu();

  // Click handler - toggle command window
  tray.on('click', () => {
    showCommandWindow();
  });

  return tray;
}

/**
 * Create a default icon programmatically
 */
function createDefaultIcon(): Electron.NativeImage {
  // Create a simple 16x16 icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  
  // Fill with a blue color
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 59;      // R
    canvas[i * 4 + 1] = 130; // G
    canvas[i * 4 + 2] = 246; // B
    canvas[i * 4 + 3] = 255; // A
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Update the tray context menu
 */
export function updateTrayMenu(): void {
  if (!tray) return;

  const settings = getSettings();
  const hotkeyDisplay = settings.hotkey
    .replace('CommandOrControl', process.platform === 'darwin' ? '⌘' : 'Ctrl')
    .replace('+', ' + ');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open Commander (${hotkeyDisplay})`,
      click: () => showCommandWindow(),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        showCommandWindow();
        const window = getCommandWindow();
        window?.webContents.send('ui:openSettings');
      },
    },
    {
      label: 'View History',
      click: () => {
        showCommandWindow();
        const window = getCommandWindow();
        window?.webContents.send('ui:openHistory');
      },
    },
    { type: 'separator' },
    {
      label: 'About Desktop Commander',
      click: () => {
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: 'About Desktop Commander',
          message: 'Desktop Commander',
          detail: 'Control your entire desktop with natural language.\n\nVersion: 0.1.0',
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Set tray icon state (idle, active, error)
 */
export function setTrayState(state: 'idle' | 'active' | 'error'): void {
  if (!tray) return;

  // In a full implementation, we'd have different icons for each state
  const tooltips: Record<string, string> = {
    idle: 'Desktop Commander',
    active: 'Desktop Commander - Processing...',
    error: 'Desktop Commander - Error',
  };

  tray.setToolTip(tooltips[state] || tooltips.idle);
}

/**
 * Destroy the tray icon
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Get the tray instance
 */
export function getTray(): Tray | null {
  return tray;
}
