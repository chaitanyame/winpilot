// Voice-to-Clipboard Controller
// Manages voice recording → transcription → clipboard/paste workflow

import { BrowserWindow, screen } from 'electron';
import { getSettings } from './store';
import { getPlatformAdapter } from '../platform';
import path from 'path';

interface RecordingState {
  isRecording: boolean;
  startTime: number;
  voiceWindow: BrowserWindow | null;
  previousForegroundWindowHandle: number | null;
  pendingStop: boolean;
}

class VoiceToClipboardManager {
  private state: RecordingState = {
    isRecording: false,
    startTime: 0,
    voiceWindow: null,
    previousForegroundWindowHandle: null,
    pendingStop: false,
  };

  async toggleRecording(): Promise<void> {
    if (this.state.pendingStop) {
      console.log('[VoiceToClipboard] Stop already in progress, ignoring toggle');
      return;
    }

    if (this.state.isRecording) {
      await this.stopRecording();
    } else if (!this.state.voiceWindow || this.state.voiceWindow.isDestroyed()) {
      await this.startRecording();
    } else {
      console.log('[VoiceToClipboard] Window already open, ignoring toggle');
    }
  }

  async startRecording(): Promise<void> {
    if (this.state.isRecording) {
      console.log('[VoiceToClipboard] Already recording');
      return;
    }

    const settings = getSettings();
    if (!settings.voiceInput?.enabled) {
      console.log('[VoiceToClipboard] Voice input disabled');
      return;
    }

    console.log('[VoiceToClipboard] Starting recording...');
    this.state.isRecording = true;
    this.state.startTime = Date.now();

    // Capture the current foreground window before showing our UI
    try {
      const adapter = getPlatformAdapter();
      this.state.previousForegroundWindowHandle = await adapter.system.getForegroundWindowHandle();
      console.log('[VoiceToClipboard] Captured foreground handle:', this.state.previousForegroundWindowHandle);
    } catch (error) {
      console.error('[VoiceToClipboard] Failed to capture foreground handle:', error);
      this.state.previousForegroundWindowHandle = null;
    }

    // Create and show the voice window
    this.state.voiceWindow = this.createVoiceWindow();
  }

  async stopRecording(): Promise<void> {
    if (!this.state.isRecording) {
      console.log('[VoiceToClipboard] Not recording');
      return;
    }

    console.log('[VoiceToClipboard] Stopping recording...');
    this.state.isRecording = false;
    this.state.pendingStop = true;

    const duration = Date.now() - this.state.startTime;
    console.log(`[VoiceToClipboard] Recording duration: ${duration}ms`);

    // Tell window to stop recording and transcribe
    if (this.state.voiceWindow && !this.state.voiceWindow.isDestroyed()) {
      this.state.voiceWindow.webContents.send('voiceToClipboard:stop');
    }
  }

  private createVoiceWindow(): BrowserWindow {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
      width: 600,
      height: 400,
      x: Math.floor((screenWidth - 600) / 2),
      y: Math.floor((screenHeight - 400) / 2),
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      backgroundColor: '#1f2937',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    // Load the voice-to-clipboard window
    if (isDev) {
      // In development, Vite serves multiple entry points
      win.loadURL('http://localhost:5173/src/renderer/voice-to-clipboard/index.html');
    } else {
      win.loadFile(path.join(__dirname, '../renderer/voice-to-clipboard/index.html'));
    }

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    win.on('closed', () => {
      this.cleanup();
    });

    return win;
  }

  async handlePaste(force = false): Promise<void> {
    const settings = getSettings();
    const autoPaste = force || settings.voiceInput?.autoPasteOnTranscribe !== false;

    if (autoPaste) {
      // Small delay to ensure clipboard is written
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        console.log('[VoiceToClipboard] Simulating paste...');
        await this.restoreForegroundFocus();
        await this.simulatePaste();
        console.log('[VoiceToClipboard] Paste complete');
      } catch (err) {
        console.error('[VoiceToClipboard] Paste failed:', err);
        throw err;
      }
    } else {
      console.log('[VoiceToClipboard] Auto-paste disabled, skipping');
    }
  }

  private async simulatePaste(): Promise<void> {
    const adapter = getPlatformAdapter();
    const handle = this.state.previousForegroundWindowHandle ?? undefined;
    console.log('[VoiceToClipboard] Simulating paste with handle:', handle ?? 'none');
    const success = await adapter.system.simulatePaste(handle);
    console.log('[VoiceToClipboard] Paste simulation result:', success);
    if (!success) {
      throw new Error('Paste simulation failed');
    }
  }

  private async restoreForegroundFocus(): Promise<void> {
    const handle = this.state.previousForegroundWindowHandle;
    if (!handle || handle === 0) {
      console.log('[VoiceToClipboard] No valid foreground handle to restore');
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }

    try {
      const adapter = getPlatformAdapter();
      await adapter.system.setForegroundWindow(handle);
      console.log('[VoiceToClipboard] Restored focus to window:', handle);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('[VoiceToClipboard] Failed to restore focus:', error);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  getIsRecording(): boolean {
    return this.state.isRecording;
  }

  cleanup(): void {
    this.state.isRecording = false;
    if (this.state.voiceWindow && !this.state.voiceWindow.isDestroyed()) {
      this.state.voiceWindow.close();
    }
    this.state.voiceWindow = null;
    this.state.previousForegroundWindowHandle = null;
    this.state.pendingStop = false;
  }
}

// Singleton instance
export const voiceToClipboardManager = new VoiceToClipboardManager();
