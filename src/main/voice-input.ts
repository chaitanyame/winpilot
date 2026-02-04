// Voice Input Manager

import { getSettings } from './store';
import { getCommandWindow, setAutoHideSuppressed, showCommandWindow } from './windows';

/**
 * Voice Input Manager
 * Handles speech-to-text functionality using Web Speech API (browser-based)
 * with optional local whisper.cpp support for better accuracy
 */
class VoiceInputManager {
  private isRecording = false;
  private recordingStartTime = 0;
  private windowRestoreInterval: NodeJS.Timeout | null = null;

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.log('Already recording, ignoring start request');
      return;
    }

    const settings = getSettings();
    if (!settings.voiceInput?.enabled) {
      console.log('Voice input is disabled in settings');
      return;
    }

    console.log('Starting voice recording...');
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    // Ensure window stays visible during voice recording
    setAutoHideSuppressed(true);

    // Show and focus the window
    const window = getCommandWindow();
    if (window && !window.isDestroyed()) {
      try {
        showCommandWindow();
      } catch (err) {
        console.warn('Failed to show window during voice recording:', err);
      }
      
      // Start a polling loop to keep restoring the window
      // This handles the case where getUserMedia causes focus loss
      this.startWindowRestoreLoop();
      
      // Send recording started event with safety check
      try {
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('voice:recordingStarted');
        }
      } catch (err) {
        console.warn('Failed to send voice:recordingStarted:', err);
      }
    }
  }

  /**
   * Stop recording and trigger transcription
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) {
      console.log('Not recording, ignoring stop request');
      return;
    }

    console.log('Stopping voice recording...');
    this.isRecording = false;
    this.stopWindowRestoreLoop();
    setAutoHideSuppressed(true);

    const duration = Date.now() - this.recordingStartTime;
    console.log(`Recording duration: ${duration}ms`);

    const window = getCommandWindow();
    if (window && !window.isDestroyed()) {
      // Tell renderer to stop and transcribe
      try {
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('voice:recordingStopped');
        }
      } catch (err) {
        console.warn('Failed to send voice:recordingStopped:', err);
      }
    }
  }

  /**
   * Toggle recording state
   */
  async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * Send transcript to renderer
   */
  sendTranscript(transcript: string): void {
    const window = getCommandWindow();
    if (window && !window.isDestroyed()) {
      try {
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('voice:transcript', transcript);
        }
      } catch (err) {
        console.warn('Failed to send voice:transcript:', err);
      }
    }
    setAutoHideSuppressed(false);
  }

  /**
   * Send error to renderer
   */
  sendError(error: string): void {
    const window = getCommandWindow();
    if (window && !window.isDestroyed()) {
      try {
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('voice:error', error);
        }
      } catch (err) {
        console.warn('Failed to send voice:error:', err);
      }
    }
    setAutoHideSuppressed(false);
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Reset recording state (cleanup)
   */
  reset(): void {
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.stopWindowRestoreLoop();
    setAutoHideSuppressed(false);
  }

  /**
   * Start a polling loop that keeps trying to restore the window
   * This handles the case where getUserMedia steals focus
   * Only runs for the first 3 seconds after recording starts
   */
  private startWindowRestoreLoop(): void {
    this.stopWindowRestoreLoop(); // Clear any existing loop
    
    let attempts = 0;
    const maxAttempts = 6; // 3 seconds max (500ms interval)
    
    this.windowRestoreInterval = setInterval(() => {
      attempts++;
      
      if (!this.isRecording || attempts >= maxAttempts) {
        this.stopWindowRestoreLoop();
        return;
      }
      
      const window = getCommandWindow();
      if (!window || window.isDestroyed()) {
        this.stopWindowRestoreLoop();
        return;
      }
      
      // Only force restore if window is minimized or not visible
      // Don't fight for focus - just ensure visibility
      if (window.isMinimized() || !window.isVisible()) {
        console.log(`[Voice] Window restore loop attempt ${attempts} - window hidden/minimized, restoring...`);
        try {
          window.setAlwaysOnTop(true, 'screen-saver');
          if (window.isMinimized()) {
            window.restore();
          }
          window.show();
          window.moveTop();
        } catch (err) {
          console.warn('[Voice] Failed to restore window in loop:', err);
        }
      }
    }, 500);
  }

  /**
   * Stop the window restore polling loop
   */
  private stopWindowRestoreLoop(): void {
    if (this.windowRestoreInterval) {
      clearInterval(this.windowRestoreInterval);
      this.windowRestoreInterval = null;
    }
  }
}

export const voiceInputManager = new VoiceInputManager();
