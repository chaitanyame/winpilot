// Electron Window Management

import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { COMMAND_PALETTE_WIDTH, COMMAND_PALETTE_HEIGHT } from '../shared/constants';

let commandWindow: BrowserWindow | null = null;

/**
 * Create the command palette window
 */
export async function createCommandWindow(): Promise<BrowserWindow> {
  // Get the primary display's work area
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate center position
  const x = Math.round((screenWidth - COMMAND_PALETTE_WIDTH) / 2);
  const y = Math.round((screenHeight - COMMAND_PALETTE_HEIGHT) / 3); // Upper third for better visibility

  commandWindow = new BrowserWindow({
    width: COMMAND_PALETTE_WIDTH,
    height: COMMAND_PALETTE_HEIGHT,
    x,
    y,
    show: false, // Start hidden
    frame: false, // Frameless window
    transparent: true,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false, // Show in taskbar when minimized
    title: 'Desktop Commander',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the renderer - detect dev mode
  const isDev = !app.isPackaged;
  const rawDevServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const devServerUrl = rawDevServerUrl;

  console.log(`Desktop Commander: isDev=${isDev}, devServerUrl=${devServerUrl}`);

  if (isDev) {
    // In development, load from Vite dev server with retry logic
    let loaded = false;
    let attempts = 0;
    const maxAttempts = 15;
    const retryDelay = 500; // Start with shorter delay

    while (!loaded && attempts < maxAttempts && commandWindow && !commandWindow.isDestroyed()) {
      attempts++;
      try {
        console.log(`Attempt ${attempts}/${maxAttempts}: Loading ${devServerUrl}...`);

        // Set a timeout for the load operation
        const loadPromise = commandWindow.loadURL(devServerUrl);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Load timeout')), 5000)
        );

        await Promise.race([loadPromise, timeoutPromise]);
        loaded = true;
        console.log('Successfully loaded dev server');

        // Uncomment to open DevTools automatically in development
        // commandWindow.webContents.openDevTools({ mode: 'detach' });
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.log(`Attempt ${attempts} failed: ${errorMsg}`);

        if (attempts < maxAttempts) {
          // Exponential backoff for retries
          const delay = retryDelay * Math.min(attempts, 3);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('All attempts to load dev server failed');
          console.error('Make sure Vite dev server is running on', devServerUrl);
          throw new Error(`Failed to load dev server after ${maxAttempts} attempts`);
        }
      }
    }
  } else {
    await commandWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Hide window when it loses focus
  commandWindow.on('blur', () => {
    if (commandWindow && !commandWindow.webContents.isDevToolsFocused()) {
      hideCommandWindow();
    }
  });

  // Prevent window from being destroyed, just hide it
  commandWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      hideCommandWindow();
    }
  });

  return commandWindow;
}

/**
 * Show the command window
 */
export function showCommandWindow(): void {
  if (!commandWindow || commandWindow.isDestroyed()) return;

  // Center on current screen
  const safeNumber = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay();
  const screenWidth = safeNumber(display.workAreaSize.width, COMMAND_PALETTE_WIDTH);
  const screenHeight = safeNumber(display.workAreaSize.height, COMMAND_PALETTE_HEIGHT);
  const screenX = safeNumber(display.bounds.x, 0);
  const screenY = safeNumber(display.bounds.y, 0);

  const windowBounds = commandWindow.getBounds();
  const windowWidth = safeNumber(windowBounds.width, COMMAND_PALETTE_WIDTH);
  const windowHeight = safeNumber(windowBounds.height, COMMAND_PALETTE_HEIGHT);

  const rawX = screenX + (screenWidth - windowWidth) / 2;
  const rawY = screenY + (screenHeight - windowHeight) / 3;
  const x = Math.round(safeNumber(rawX, screenX));
  const y = Math.round(safeNumber(rawY, screenY));

  let positioned = false;

  if (Number.isFinite(x) && Number.isFinite(y)) {
    try {
      commandWindow.setPosition(x, y);
      positioned = true;
    } catch (error) {
      console.warn('Failed to set window position, falling back to center:', error);
    }
  }

  if (!positioned) {
    try {
      commandWindow.center();
    } catch (error) {
      console.warn('Failed to center window:', error);
    }
  }
  commandWindow.show();
  commandWindow.focus();

  // Notify renderer that window is shown
  commandWindow.webContents.send('window:shown');
}

/**
 * Hide the command window
 */
export function hideCommandWindow(): void {
  if (!commandWindow) return;
  
  commandWindow.hide();
  
  // Notify renderer that window is hidden
  commandWindow.webContents.send('window:hidden');
}

/**
 * Toggle command window visibility
 */
export function toggleCommandWindow(): void {
  if (!commandWindow) return;

  if (commandWindow.isVisible()) {
    hideCommandWindow();
  } else {
    showCommandWindow();
  }
}

/**
 * Get the command window instance
 */
export function getCommandWindow(): BrowserWindow | null {
  return commandWindow;
}

/**
 * Focus the command window input
 */
export function focusCommandInput(): void {
  if (commandWindow && commandWindow.isVisible()) {
    commandWindow.webContents.send('focus:input');
  }
}

/**
 * Minimize the command window
 */
export function minimizeCommandWindow(): void {
  if (commandWindow) {
    commandWindow.minimize();
  }
}

/**
 * Maximize the command window
 */
export function maximizeCommandWindow(): void {
  if (commandWindow) {
    if (commandWindow.isMaximized()) {
      commandWindow.unmaximize();
    } else {
      commandWindow.maximize();
    }
  }
}

/**
 * Fit window to screen (maximize but keep always on top)
 */
export function fitWindowToScreen(): void {
  if (!commandWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Set window to fill most of the screen with some margin
  const margin = 40;
  commandWindow.setBounds({
    x: margin,
    y: margin,
    width: screenWidth - (margin * 2),
    height: screenHeight - (margin * 2),
  });
  commandWindow.show();
  commandWindow.focus();
}

/**
 * Resize command window based on content
 */
export function resizeCommandWindow(height: number): void {
  if (!commandWindow) return;
  
  const bounds = commandWindow.getBounds();
  const newHeight = Math.max(120, Math.min(height, 600));
  
  commandWindow.setBounds({
    ...bounds,
    height: newHeight,
  });
}

// Add isQuitting flag to app
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

app.on('before-quit', () => {
  app.isQuitting = true;
});
