// Voice Input Manager

import { getSettings } from './store';
import { getCommandWindow } from './windows';

/**
 * Voice Input Manager
 * Handles speech-to-text functionality using Web Speech API (browser-based)
 * with optional local whisper.cpp support for better accuracy
 */
class VoiceInputManager {
  private isRecording = false;
  private recordingStartTime = 0;

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

    const window = getCommandWindow();
    if (window) {
      window.webContents.send('voice:recordingStarted');
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

    const duration = Date.now() - this.recordingStartTime;
    console.log(`Recording duration: ${duration}ms`);

    const window = getCommandWindow();
    if (window) {
      // Tell renderer to stop and transcribe
      window.webContents.send('voice:recordingStopped');
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
    if (window) {
      window.webContents.send('voice:transcript', transcript);
    }
  }

  /**
   * Send error to renderer
   */
  sendError(error: string): void {
    const window = getCommandWindow();
    if (window) {
      window.webContents.send('voice:error', error);
    }
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
  }
}

export const voiceInputManager = new VoiceInputManager();
