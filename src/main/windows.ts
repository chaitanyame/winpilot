// Electron Window Management

import { BrowserWindow, screen, app, ipcMain } from 'electron';
import path from 'path';
import { COMMAND_PALETTE_WIDTH, COMMAND_PALETTE_HEIGHT } from '../shared/constants';

let commandWindow: BrowserWindow | null = null;
let clipboardHistoryWindow: BrowserWindow | null = null;
let voiceRecordingWindow: BrowserWindow | null = null;
let audioRecordingWindow: BrowserWindow | null = null;
let videoRecordingWindow: BrowserWindow | null = null;
let previouslyFocusedWindow: BrowserWindow | null = null;
let previousForegroundWindowHandle: number | null = null;
let suppressAutoHide = false;

export function setAutoHideSuppressed(value: boolean): void {
  console.log('[Windows] setAutoHideSuppressed:', value);
  suppressAutoHide = value;
}

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
    transparent: false, // DISABLED - causes getUserMedia crash on Windows
    backgroundColor: '#1a1a2e', // Dark background to match UI
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: false,
    alwaysOnTop: false,
    skipTaskbar: false, // Show in taskbar when minimized
    title: 'Desktop Commander',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false, // Prevent throttling when window loses focus (important for voice recording)
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

  // Keep window visible; only hide/minimize via explicit user actions.
  // NOTE: Auto-minimize on blur is DISABLED - it causes issues with voice recording
  // and other features that temporarily steal focus. Users can manually minimize.

  // Track if we're in a restore cycle to prevent endless loops
  let restoreInProgress = false;
  let lastBlurTime = 0;

  // Add event listeners to track window state changes
  commandWindow.on('blur', () => {
    console.log('[Windows] blur event, suppressAutoHide:', suppressAutoHide);
    
    // Don't let blur hide the window during voice recording
    // But avoid endless blur/focus loops by rate-limiting restores
    if (suppressAutoHide && !restoreInProgress) {
      const now = Date.now();
      // Only attempt restore if it's been at least 1 second since last blur
      if (now - lastBlurTime < 1000) {
        console.log('[Windows] blur during voice recording - skipping restore (rate limited)');
        return;
      }
      lastBlurTime = now;
      
      console.log('[Windows] blur during voice recording - will restore once');
      restoreInProgress = true;
      
      // Single restore attempt after a delay
      setTimeout(() => {
        if (!commandWindow || commandWindow.isDestroyed() || !suppressAutoHide) {
          restoreInProgress = false;
          return;
        }
        
        console.log('[Windows] Restoring window after blur');
        const bounds = commandWindow.getBounds();
        console.log('[Windows] Current bounds:', JSON.stringify(bounds));
        
        // Keep window on top and visible, but don't aggressively steal focus
        commandWindow.setAlwaysOnTop(true, 'screen-saver');
        if (commandWindow.isMinimized()) {
          commandWindow.restore();
        }
        commandWindow.show();
        commandWindow.moveTop();
        // Only focus if window is not currently focused elsewhere
        if (!commandWindow.isFocused()) {
          commandWindow.focus();
        }
        
        restoreInProgress = false;
      }, 500);
    }
  });

  commandWindow.on('minimize', () => {
    console.log('[Windows] minimize event, suppressAutoHide:', suppressAutoHide);
    console.log('[Windows] Window state after minimize - isMinimized:', commandWindow?.isMinimized(), 'isVisible:', commandWindow?.isVisible());
    // Prevent minimize during voice recording
    if (suppressAutoHide) {
      console.log('[Windows] Preventing minimize during voice recording - will restore');
      setTimeout(() => {
        if (commandWindow && !commandWindow.isDestroyed() && suppressAutoHide) {
          console.log('[Windows] Restoring from minimize');
          commandWindow.setAlwaysOnTop(true, 'screen-saver');
          commandWindow.restore();
          commandWindow.show();
          commandWindow.moveTop();
          commandWindow.focus();
        }
      }, 100);
    }
  });

  commandWindow.on('hide', () => {
    console.log('[Windows] hide event, suppressAutoHide:', suppressAutoHide);
    console.log('[Windows] Window state after hide - isMinimized:', commandWindow?.isMinimized(), 'isVisible:', commandWindow?.isVisible());
    // Prevent hide during voice recording
    if (suppressAutoHide) {
      console.log('[Windows] Preventing hide during voice recording - will show');
      setTimeout(() => {
        if (commandWindow && !commandWindow.isDestroyed() && suppressAutoHide) {
          console.log('[Windows] Re-showing from hide');
          commandWindow.setAlwaysOnTop(true, 'screen-saver');
          if (commandWindow.isMinimized()) {
            commandWindow.restore();
          }
          commandWindow.show();
          commandWindow.moveTop();
          commandWindow.focus();
        }
      }, 100);
    }
  });

  commandWindow.on('show', () => {
    console.log('[Windows] show event');
    console.log('[Windows] Window state after show - isMinimized:', commandWindow?.isMinimized(), 'isVisible:', commandWindow?.isVisible());
  });

  commandWindow.on('focus', () => {
    console.log('[Windows] focus event');
  });

  // Handle renderer process crash/termination (newer API)
  commandWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Windows] Renderer process gone!', JSON.stringify(details));
    console.error('[Windows] Reason:', details.reason, 'Exit code:', details.exitCode);
    // Reload the window to recover
    setTimeout(() => {
      if (commandWindow && !commandWindow.isDestroyed()) {
        console.log('[Windows] Reloading window after crash...');
        commandWindow.reload();
      }
    }, 500);
  });

  // Handle renderer becoming unresponsive
  commandWindow.webContents.on('unresponsive', () => {
    console.warn('[Windows] Renderer became unresponsive');
  });

  commandWindow.webContents.on('responsive', () => {
    console.log('[Windows] Renderer is responsive again');
  });

  // Log when renderer is destroyed
  commandWindow.webContents.on('destroyed', () => {
    console.warn('[Windows] Renderer webContents destroyed');
  });

  // Prevent window from being destroyed, just hide it
  commandWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      // Don't force hide if auto-hide is suppressed (e.g., during voice recording)
      hideCommandWindow(!suppressAutoHide);
    }
  });

  return commandWindow;
}

// Audio capture helper window for voice recording
// This is a hidden, non-transparent window that handles getUserMedia
// to avoid crashes in the transparent command window
let audioCaptureWindow: BrowserWindow | null = null;
let audioCaptureResolve: ((sampleRate: number) => void) | null = null;
let audioCaptureReject: ((error: string) => void) | null = null;
let audioCaptureWindowReady = false;
let audioCaptureWindowReadyResolve: (() => void) | null = null;

/**
 * Create or get the audio capture helper window
 * This window is non-transparent and handles getUserMedia safely
 */
export async function createAudioCaptureWindow(): Promise<BrowserWindow> {
  if (audioCaptureWindow && !audioCaptureWindow.isDestroyed()) {
    return audioCaptureWindow;
  }

  console.log('[Windows] Creating audio capture helper window...');
  
  // Reset ready flag since we're creating a new window
  audioCaptureWindowReady = false;
  
  audioCaptureWindow = new BrowserWindow({
    width: 200,
    height: 100,
    show: true, // Show for debugging
    frame: true,
    transparent: false, // NOT transparent - this is key!
    skipTaskbar: false,
    backgroundColor: '#000000',
    title: 'Audio Capture (Debug)',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // Add crash detection for the audio capture window
  audioCaptureWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Windows] Audio capture window crashed!', details);
    audioCaptureWindowReady = false;
    if (audioCaptureReject) {
      audioCaptureReject('Audio capture window crashed: ' + details.reason);
      audioCaptureResolve = null;
      audioCaptureReject = null;
    }
  });

  audioCaptureWindow.on('closed', () => {
    console.log('[Windows] Audio capture window closed');
    audioCaptureWindow = null;
    audioCaptureWindowReady = false;
  });

  // Load the audio capture HTML page
  const isDev = !app.isPackaged;
  if (isDev) {
    // In dev, load from file system
    const htmlPath = path.join(__dirname, '../../src/renderer/audio-capture/index.html');
    await audioCaptureWindow.loadFile(htmlPath);
  } else {
    // In production, load from dist
    const htmlPath = path.join(__dirname, '../renderer/audio-capture/index.html');
    await audioCaptureWindow.loadFile(htmlPath);
  }
  
  console.log('[Windows] Audio capture helper window created');
  return audioCaptureWindow;
}

/**
 * Get the audio capture window (returns null if not created)
 */
export function getAudioCaptureWindow(): BrowserWindow | null {
  return audioCaptureWindow && !audioCaptureWindow.isDestroyed() ? audioCaptureWindow : null;
}

/**
 * Mark audio capture window as ready (called from IPC handler)
 */
export function markAudioCaptureWindowReady(): void {
  console.log('[Windows] Audio capture window marked ready');
  audioCaptureWindowReady = true;
  if (audioCaptureWindowReadyResolve) {
    audioCaptureWindowReadyResolve();
    audioCaptureWindowReadyResolve = null;
  }
}

/**
 * Start audio capture in the helper window
 */
export async function startAudioCapture(): Promise<number> {
  const window = await createAudioCaptureWindow();
  
  // Wait for the window to be ready if it's not already
  if (!audioCaptureWindowReady) {
    console.log('[Windows] Waiting for audio capture window to be ready...');
    await new Promise<void>((resolve) => {
      audioCaptureWindowReadyResolve = resolve;
      // Timeout after 5 seconds
      setTimeout(() => {
        if (audioCaptureWindowReadyResolve) {
          console.log('[Windows] Audio capture window ready timeout, proceeding anyway');
          audioCaptureWindowReadyResolve();
          audioCaptureWindowReadyResolve = null;
        }
      }, 5000);
    });
  }
  
  console.log('[Windows] Sending audioCapture:start to helper window');
  
  return new Promise((resolve, reject) => {
    audioCaptureResolve = resolve;
    audioCaptureReject = reject;
    
    // Tell the audio capture window to start recording
    window.webContents.send('audioCapture:start');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (audioCaptureReject) {
        audioCaptureReject('Audio capture timed out');
        audioCaptureResolve = null;
        audioCaptureReject = null;
      }
    }, 10000);
  });
}

/**
 * Stop audio capture and get the samples
 */
export async function stopAudioCapture(): Promise<{ samples: number[][]; sampleRate: number }> {
  const window = getAudioCaptureWindow();
  if (!window) {
    throw new Error('Audio capture window not available');
  }
  
  // Check if the window's webContents is still valid
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    throw new Error('Audio capture window was destroyed');
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ipcMain.removeListener('audioCapture:stopped', handler);
      reject(new Error('Stop audio capture timed out'));
    }, 5000);
    
    // One-time listener for the stopped event
    const handler = (_event: Electron.IpcMainEvent, samples: number[][], sampleRate: number) => {
      clearTimeout(timeout);
      ipcMain.removeListener('audioCapture:stopped', handler);
      resolve({ samples, sampleRate });
    };
    ipcMain.on('audioCapture:stopped', handler);
    
    // Tell the window to stop
    try {
      window.webContents.send('audioCapture:stop');
    } catch (err) {
      clearTimeout(timeout);
      ipcMain.removeListener('audioCapture:stopped', handler);
      reject(err);
    }
  });
}

/**
 * Handle audio capture ready event
 */
export function handleAudioCaptureReady(sampleRate: number): void {
  if (audioCaptureResolve) {
    audioCaptureResolve(sampleRate);
    audioCaptureResolve = null;
    audioCaptureReject = null;
  }
}

/**
 * Handle audio capture error event
 */
export function handleAudioCaptureError(error: string): void {
  if (audioCaptureReject) {
    audioCaptureReject(error);
    audioCaptureResolve = null;
    audioCaptureReject = null;
  }
}

/**
 * Destroy the audio capture helper window
 */
export function destroyAudioCaptureWindow(): void {
  if (audioCaptureWindow && !audioCaptureWindow.isDestroyed()) {
    audioCaptureWindow.destroy();
    audioCaptureWindow = null;
  }
}

/**
 * Show the command window
 */
export function showCommandWindow(): void {
  if (!commandWindow || commandWindow.isDestroyed()) {
    console.warn('[Windows] showCommandWindow: window is null or destroyed');
    return;
  }

  console.log('[Windows] showCommandWindow called, isMinimized:', commandWindow.isMinimized(), 'isVisible:', commandWindow.isVisible());

  // FIRST: Always restore and show the window before doing anything else
  try {
    // Only force alwaysOnTop during voice recording
    if (suppressAutoHide) {
      commandWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      commandWindow.setAlwaysOnTop(false);
    }
    
    if (commandWindow.isMinimized()) {
      console.log('[Windows] Restoring minimized window');
      commandWindow.restore();
    }
    commandWindow.show();
    commandWindow.moveTop();
    commandWindow.focus();
    
    // During voice recording, flash taskbar and toggle alwaysOnTop to force z-order
    if (suppressAutoHide) {
      // Flash to get attention in case window is behind
      commandWindow.flashFrame(true);
      setTimeout(() => {
        if (commandWindow && !commandWindow.isDestroyed()) {
          commandWindow.flashFrame(false);
        }
      }, 500);
    }
  } catch (err) {
    console.error('[Windows] Failed to restore/show/focus window:', err);
  }

  // THEN: Try to position the window (non-critical)
  try {
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

    if (Number.isFinite(x) && Number.isFinite(y)) {
      commandWindow.setPosition(x, y);
    } else {
      commandWindow.center();
    }
  } catch (error) {
    console.warn('[Windows] Failed to position window:', error);
    // Still try to center as last resort
    try { commandWindow.center(); } catch (e) { /* ignore */ }
  }

  // FINALLY: Notify renderer (completely non-critical, wrapped in try-catch)
  try {
    if (commandWindow.webContents && !commandWindow.webContents.isDestroyed()) {
      commandWindow.webContents.send('window:shown');
    }
  } catch (err) {
    // Silently ignore - window is shown, that's what matters
  }

  console.log('[Windows] showCommandWindow complete, isVisible:', commandWindow.isVisible());
}

/**
 * Hide the command window
 */
export function hideCommandWindow(force = false): void {
  const stack = new Error().stack;
  console.log('[Windows] hideCommandWindow called, force:', force, 'suppressAutoHide:', suppressAutoHide);
  console.log('[Windows] Called from:', stack?.split('\n')[2]?.trim());
  if (!commandWindow) return;
  if (suppressAutoHide && !force) {
    console.log('[Windows] hide suppressed');
    return;
  }

  console.log('[Windows] hiding window');
  commandWindow.hide();

  // Notify renderer that window is hidden (with safety check)
  try {
    if (commandWindow.webContents && !commandWindow.webContents.isDestroyed()) {
      commandWindow.webContents.send('window:hidden');
    }
  } catch (err) {
    console.warn('Failed to send window:hidden event:', err);
  }
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
  const stack = new Error().stack;
  console.log('[Windows] minimizeCommandWindow called');
  console.log('[Windows] Called from:', stack?.split('\n')[2]?.trim());
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

// ============================================================================
// Clipboard History Window
// ============================================================================

/**
 * Create clipboard history window
 */
export async function createClipboardHistoryWindow(): Promise<BrowserWindow> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  // Position at right side of screen
  const windowWidth = 400;
  const windowHeight = 600;
  const x = screenWidth - windowWidth - 20;
  const y = 100;

  clipboardHistoryWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Clipboard History',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the same main HTML for now (will be separate later)
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  if (VITE_DEV_SERVER_URL) {
    await clipboardHistoryWindow.loadURL(`${VITE_DEV_SERVER_URL}#clipboard-history`);
  } else {
    await clipboardHistoryWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'clipboard-history'
    });
  }

  // Start clipboard monitoring when window is shown
  clipboardHistoryWindow.once('show', () => {
    const { clipboardMonitor } = require('./clipboard-monitor');
    clipboardMonitor.startMonitoring(true);
    console.log('[ClipboardWindow] Started monitoring');
  });

  clipboardHistoryWindow.on('closed', () => {
    const { clipboardMonitor } = require('./clipboard-monitor');
    clipboardMonitor.stopMonitoring();
    console.log('[ClipboardWindow] Stopped monitoring on close');
    clipboardHistoryWindow = null;
  });

  // Close on blur and stop monitoring
  clipboardHistoryWindow.on('blur', () => {
    if (!app.isQuitting && clipboardHistoryWindow) {
      clipboardHistoryWindow.hide();
      const { clipboardMonitor } = require('./clipboard-monitor');
      clipboardMonitor.stopMonitoring();
      console.log('[ClipboardWindow] Stopped monitoring on blur');
    }
  });

  return clipboardHistoryWindow;
}

/**
 * Toggle clipboard history window
 */
export async function toggleClipboardHistoryWindow(): Promise<void> {
  if (!clipboardHistoryWindow || clipboardHistoryWindow.isDestroyed()) {
    // Store currently focused window BEFORE showing clipboard
    // Get all windows except our own app windows
    const allWindows = BrowserWindow.getAllWindows();
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    // Store the focused window if it's not the command window or clipboard window
    if (focusedWindow && focusedWindow !== commandWindow && focusedWindow !== clipboardHistoryWindow) {
      previouslyFocusedWindow = focusedWindow;
      console.log('[Windows] Storing previous window (focused):', previouslyFocusedWindow.getTitle());
    } else {
      // Fall back to finding any visible window that's not ours
      previouslyFocusedWindow = allWindows.find(w => 
        w !== commandWindow && 
        w !== clipboardHistoryWindow && 
        w.isVisible()
      ) || null;
      console.log('[Windows] Storing previous window (fallback):', previouslyFocusedWindow ? previouslyFocusedWindow.getTitle() : 'None');
    }
    
    // Capture current OS foreground window handle for later paste
    try {
      const { getPlatformAdapter } = await import('../platform');
      const adapter = getPlatformAdapter();
      previousForegroundWindowHandle = await adapter.system.getForegroundWindowHandle();
      console.log('[Windows] Captured foreground handle:', previousForegroundWindowHandle);
    } catch (error) {
      console.error('[Windows] Failed to capture foreground handle:', error);
      previousForegroundWindowHandle = null;
    }

    // Create new window
    await createClipboardHistoryWindow();
    clipboardHistoryWindow?.show();
    clipboardHistoryWindow?.focus();
  } else if (clipboardHistoryWindow.isVisible()) {
    // Hide if visible
    clipboardHistoryWindow.hide();
  } else {
    // Store currently focused window when showing again
    const allWindows = BrowserWindow.getAllWindows();
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    if (focusedWindow && focusedWindow !== commandWindow && focusedWindow !== clipboardHistoryWindow) {
      previouslyFocusedWindow = focusedWindow;
      console.log('[Windows] Storing previous window (focused):', previouslyFocusedWindow.getTitle());
    } else {
      previouslyFocusedWindow = allWindows.find(w => 
        w !== commandWindow && 
        w !== clipboardHistoryWindow && 
        w.isVisible()
      ) || null;
      console.log('[Windows] Storing previous window (fallback):', previouslyFocusedWindow ? previouslyFocusedWindow.getTitle() : 'None');
    }
    
    // Capture current OS foreground window handle for later paste
    try {
      const { getPlatformAdapter } = await import('../platform');
      const adapter = getPlatformAdapter();
      previousForegroundWindowHandle = await adapter.system.getForegroundWindowHandle();
      console.log('[Windows] Captured foreground handle:', previousForegroundWindowHandle);
    } catch (error) {
      console.error('[Windows] Failed to capture foreground handle:', error);
      previousForegroundWindowHandle = null;
    }

    // Show if hidden
    clipboardHistoryWindow.show();
    clipboardHistoryWindow.focus();
  }
}

export async function hideClipboardHistoryWindow(): Promise<void> {
  if (clipboardHistoryWindow && !clipboardHistoryWindow.isDestroyed()) {
    clipboardHistoryWindow.hide();
  }
}

export function getPreviouslyFocusedWindow(): BrowserWindow | null {
  return previouslyFocusedWindow;
}

export function getPreviousForegroundWindowHandle(): number | null {
  return previousForegroundWindowHandle;
}

/**
 * Get clipboard history window instance
 */
export function getClipboardHistoryWindow(): BrowserWindow | null {
  return clipboardHistoryWindow;
}

// ============================================================================
// Voice Recording Window
// ============================================================================

/**
 * Create voice recording window
 */
export async function createVoiceRecordingWindow(mode: 'transcribe' | 'command'): Promise<BrowserWindow> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Center on screen
  const windowWidth = 350;
  const windowHeight = 200;
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);

  voiceRecordingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: mode === 'transcribe' ? 'Voice Transcribe' : 'Voice Command',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  if (VITE_DEV_SERVER_URL) {
    await voiceRecordingWindow.loadURL(`${VITE_DEV_SERVER_URL}#voice-recording?mode=${mode}`);
  } else {
    await voiceRecordingWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: `voice-recording?mode=${mode}`
    });
  }

  voiceRecordingWindow.on('closed', () => {
    voiceRecordingWindow = null;
  });

  return voiceRecordingWindow;
}

/**
 * Toggle voice recording window
 */
export async function toggleVoiceRecordingWindow(mode: 'transcribe' | 'command'): Promise<void> {
  if (!voiceRecordingWindow || voiceRecordingWindow.isDestroyed()) {
    await createVoiceRecordingWindow(mode);
    voiceRecordingWindow?.show();
    voiceRecordingWindow?.focus();
  } else if (voiceRecordingWindow.isVisible()) {
    voiceRecordingWindow.hide();
  } else {
    voiceRecordingWindow.show();
    voiceRecordingWindow.focus();
  }
}

/**
 * Get voice recording window instance
 */
export function getVoiceRecordingWindow(): BrowserWindow | null {
  return voiceRecordingWindow;
}

// ============================================================================
// Audio Recording Window
// ============================================================================

/**
 * Create audio recording window
 */
export async function createAudioRecordingWindow(): Promise<BrowserWindow> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = 300;
  const windowHeight = 150;
  const x = screenWidth - windowWidth - 20;
  const y = screenHeight - windowHeight - 100;

  audioRecordingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Audio Recording',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  if (VITE_DEV_SERVER_URL) {
    await audioRecordingWindow.loadURL(`${VITE_DEV_SERVER_URL}#audio-recording`);
  } else {
    await audioRecordingWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'audio-recording'
    });
  }

  audioRecordingWindow.on('closed', () => {
    audioRecordingWindow = null;
  });

  return audioRecordingWindow;
}

/**
 * Toggle audio recording window
 */
export async function toggleAudioRecordingWindow(): Promise<void> {
  if (!audioRecordingWindow || audioRecordingWindow.isDestroyed()) {
    await createAudioRecordingWindow();
    audioRecordingWindow?.show();
    audioRecordingWindow?.focus();
  } else if (audioRecordingWindow.isVisible()) {
    audioRecordingWindow.hide();
  } else {
    audioRecordingWindow.show();
    audioRecordingWindow.focus();
  }
}

/**
 * Get audio recording window instance
 */
export function getAudioRecordingWindow(): BrowserWindow | null {
  return audioRecordingWindow;
}

// ============================================================================
// Video Recording Window
// ============================================================================

/**
 * Create video recording window
 */
export async function createVideoRecordingWindow(): Promise<BrowserWindow> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = 300;
  const windowHeight = 150;
  const x = 20;
  const y = screenHeight - windowHeight - 100;

  videoRecordingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Video Recording',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  if (VITE_DEV_SERVER_URL) {
    await videoRecordingWindow.loadURL(`${VITE_DEV_SERVER_URL}#video-recording`);
  } else {
    await videoRecordingWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'video-recording'
    });
  }

  videoRecordingWindow.on('closed', () => {
    videoRecordingWindow = null;
  });

  return videoRecordingWindow;
}

/**
 * Toggle video recording window
 */
export async function toggleVideoRecordingWindow(): Promise<void> {
  if (!videoRecordingWindow || videoRecordingWindow.isDestroyed()) {
    await createVideoRecordingWindow();
    videoRecordingWindow?.show();
    videoRecordingWindow?.focus();
  } else if (videoRecordingWindow.isVisible()) {
    videoRecordingWindow.hide();
  } else {
    videoRecordingWindow.show();
    videoRecordingWindow.focus();
  }
}

/**
 * Get video recording window instance
 */
export function getVideoRecordingWindow(): BrowserWindow | null {
  return videoRecordingWindow;
}

// ============================================================================
// Chat Panel Window
// ============================================================================

let chatPanelWindow: BrowserWindow | null = null;

export async function createChatPanelWindow(): Promise<BrowserWindow> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Center on screen
  const windowWidth = 600;
  const windowHeight = 700;
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);

  chatPanelWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Quick Chat',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
  if (VITE_DEV_SERVER_URL) {
    await chatPanelWindow.loadURL(`${VITE_DEV_SERVER_URL}#chat-panel`);
  } else {
    await chatPanelWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: 'chat-panel'
    });
  }

  chatPanelWindow.on('closed', () => {
    chatPanelWindow = null;
  });

  chatPanelWindow.on('blur', () => {
    if (!app.isQuitting && chatPanelWindow) {
      chatPanelWindow.hide();
    }
  });

  return chatPanelWindow;
}

export async function toggleChatPanelWindow(): Promise<void> {
  if (!chatPanelWindow || chatPanelWindow.isDestroyed()) {
    await createChatPanelWindow();
    chatPanelWindow?.show();
    chatPanelWindow?.focus();
  } else if (chatPanelWindow.isVisible()) {
    chatPanelWindow.hide();
  } else {
    chatPanelWindow.show();
    chatPanelWindow.focus();
  }
}

export function getChatPanelWindow(): BrowserWindow | null {
  return chatPanelWindow;
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
