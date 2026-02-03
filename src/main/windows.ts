// Electron Window Management

import { BrowserWindow, screen, app } from 'electron';
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

  // Keep window visible; only hide/minimize via explicit user actions.

  // Minimize when window loses focus (with debounce to allow IPC suppression to take effect)
  let blurTimeout: NodeJS.Timeout | null = null;
  commandWindow.on('blur', () => {
    console.log('[Windows] blur event, suppressAutoHide:', suppressAutoHide);
    if (!commandWindow || commandWindow.isDestroyed()) return;
    
    // Check suppression immediately - if already suppressed, don't even schedule
    if (suppressAutoHide) {
      console.log('[Windows] blur suppressed, not minimizing');
      return;
    }
    
    // Clear any pending blur timeout
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    
    // Debounce the minimize to allow setAutoHideSuppressed IPC to arrive
    blurTimeout = setTimeout(() => {
      console.log('[Windows] blur timeout fired, suppressAutoHide:', suppressAutoHide);
      if (!commandWindow || commandWindow.isDestroyed()) return;
      if (suppressAutoHide) {
        console.log('[Windows] blur timeout suppressed, not minimizing');
        return;
      }
      console.log('[Windows] minimizing window');
      commandWindow.minimize();
    }, 100);
  });

  // Also clear blur timeout when window gains focus
  commandWindow.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
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
  if (commandWindow.isMinimized()) {
    commandWindow.restore();
  }
  commandWindow.show();
  commandWindow.focus();

  // Notify renderer that window is shown
  commandWindow.webContents.send('window:shown');
}

/**
 * Hide the command window
 */
export function hideCommandWindow(force = false): void {
  console.log('[Windows] hideCommandWindow called, force:', force, 'suppressAutoHide:', suppressAutoHide);
  if (!commandWindow) return;
  if (suppressAutoHide && !force) {
    console.log('[Windows] hide suppressed');
    return;
  }

  console.log('[Windows] hiding window');
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
  console.log('[Windows] minimizeCommandWindow called');
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

  clipboardHistoryWindow.on('closed', () => {
    clipboardHistoryWindow = null;
  });

  // Close on blur (optional - can be removed if you want it to persist)
  clipboardHistoryWindow.on('blur', () => {
    if (!app.isQuitting && clipboardHistoryWindow) {
      clipboardHistoryWindow.hide();
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
