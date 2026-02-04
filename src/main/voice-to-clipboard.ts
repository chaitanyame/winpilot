// Voice-to-Clipboard Controller
// Manages voice recording → transcription → clipboard/paste workflow

import { clipboard, BrowserWindow } from 'electron';
import { getSettings } from './store';
import { showVoicePill, hideVoicePill, updateVoicePillState } from './voice-pill-window';
import { execAsync } from './utils/exec';

interface RecordingState {
  isRecording: boolean;
  startTime: number;
  recorderWindow: BrowserWindow | null;
}

class VoiceToClipboardManager {
  private state: RecordingState = {
    isRecording: false,
    startTime: 0,
    recorderWindow: null,
  };

  async toggleRecording(): Promise<void> {
    if (this.state.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
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
      showVoicePill('error', 'Voice input disabled');
      setTimeout(() => hideVoicePill(), 2000);
      return;
    }

    console.log('[VoiceToClipboard] Starting recording...');
    this.state.isRecording = true;
    this.state.startTime = Date.now();

    // Show listening pill
    showVoicePill('listening', 'Listening...');

    // Create an invisible recorder window that will handle getUserMedia
    this.state.recorderWindow = this.createRecorderWindow();
  }

  async stopRecording(): Promise<void> {
    if (!this.state.isRecording) {
      console.log('[VoiceToClipboard] Not recording');
      return;
    }

    console.log('[VoiceToClipboard] Stopping recording...');
    this.state.isRecording = false;

    const duration = Date.now() - this.state.startTime;
    console.log(`[VoiceToClipboard] Recording duration: ${duration}ms`);

    // Update pill to show transcribing state
    updateVoicePillState('transcribing', 'Transcribing...');

    // Tell recorder window to stop and transcribe
    if (this.state.recorderWindow && !this.state.recorderWindow.isDestroyed()) {
      this.state.recorderWindow.webContents.send('voiceToClipboard:stop');
    }
  }

  private createRecorderWindow(): BrowserWindow {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    
    const win = new BrowserWindow({
      width: 1,
      height: 1,
      x: -1000,
      y: -1000,
      frame: false,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Load the recorder HTML
    const recorderPath = isDev
      ? require('path').join(__dirname, '../../src/renderer/voice-recorder/index.html')
      : require('path').join(__dirname, '../renderer/voice-recorder/index.html');
    
    win.loadFile(recorderPath);

    // Start recording once loaded
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('voiceToClipboard:start');
    });

    return win;
  }

  async handleTranscriptionComplete(transcript: string): Promise<void> {
    if (!transcript || transcript.trim().length === 0) {
      updateVoicePillState('error', 'No speech detected');
      setTimeout(() => hideVoicePill(), 2000);
      this.cleanupRecorderWindow();
      return;
    }

    console.log('[VoiceToClipboard] Transcription complete:', transcript);

    // Copy to clipboard
    clipboard.writeText(transcript);
    console.log('[VoiceToClipboard] Copied to clipboard');

    // Check if auto-paste is enabled
    const settings = getSettings();
    const autoPaste = settings.voiceInput?.autoPasteOnTranscribe !== false; // Default true

    if (autoPaste) {
      // Show success state briefly
      updateVoicePillState('success', 'Pasting...');

      // Small delay to ensure clipboard is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate Ctrl+V to paste
      try {
        await this.simulatePaste();
        console.log('[VoiceToClipboard] Auto-paste complete');
      } catch (err) {
        console.error('[VoiceToClipboard] Auto-paste failed:', err);
      }

      // Hide pill after paste
      setTimeout(() => hideVoicePill(), 800);
    } else {
      // Just show success without pasting
      updateVoicePillState('success', 'Copied!');
      setTimeout(() => hideVoicePill(), 1500);
    }

    this.cleanupRecorderWindow();
  }

  async handleTranscriptionError(error: string): Promise<void> {
    console.error('[VoiceToClipboard] Transcription error:', error);
    updateVoicePillState('error', error || 'Transcription failed');
    setTimeout(() => hideVoicePill(), 2000);
    this.cleanupRecorderWindow();
  }

  private async simulatePaste(): Promise<void> {
    // Use PowerShell SendKeys to simulate Ctrl+V
    // This works better than robotjs for simple paste operations
    const cmd = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    `;
    
    await execAsync(`powershell -Command "${cmd.replace(/\n/g, ' ')}"`);
  }

  private cleanupRecorderWindow(): void {
    if (this.state.recorderWindow && !this.state.recorderWindow.isDestroyed()) {
      this.state.recorderWindow.close();
    }
    this.state.recorderWindow = null;
  }

  getIsRecording(): boolean {
    return this.state.isRecording;
  }

  cleanup(): void {
    this.state.isRecording = false;
    hideVoicePill();
    this.cleanupRecorderWindow();
  }
}

// Singleton instance
export const voiceToClipboardManager = new VoiceToClipboardManager();
