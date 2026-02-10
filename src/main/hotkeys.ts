// Global Hotkey Registration

import { globalShortcut } from 'electron';
import { showCommandWindow, toggleClipboardHistoryWindow, toggleVoiceRecordingWindow, toggleAudioRecordingWindow, toggleVideoRecordingWindow, toggleChatPanelWindow } from './windows';
import { getSettings } from './store';
import { voiceInputManager } from './voice-input';
import { contextCaptureService } from './context-capture';
import { voiceToClipboardManager } from './voice-to-clipboard';

let registeredHotkey: string | null = null;
let registeredVoiceHotkey: string | null = null;
let registeredClipboardHistoryHotkey: string | null = null;
let registeredVoiceTranscribeHotkey: string | null = null;
let registeredVoiceCommandHotkey: string | null = null;
let registeredAudioRecordingHotkey: string | null = null;
let registeredVideoRecordingHotkey: string | null = null;
let registeredChatHotkey: string | null = null;
let registeredVoiceToClipboardHotkey: string | null = null;

/**
 * Register global hotkeys
 */
export function registerHotkeys(): void {
  const settings = getSettings();
  const hotkey = settings.hotkey;

  try {
    // Unregister any existing hotkey
    if (registeredHotkey) {
      globalShortcut.unregister(registeredHotkey);
    }

    // Register the new hotkey
    globalShortcut.register(hotkey, async () => {
      console.log('Hotkey triggered:', hotkey);

      // Capture context BEFORE showing our window
      // This is critical - the external app must still be focused
      const settings = getSettings();
      if (settings.contextAwareness?.enabled) {
        await contextCaptureService.captureContext();
      }

      showCommandWindow();
    });

    const success = globalShortcut.isRegistered(hotkey);
    if (success) {
      registeredHotkey = hotkey;
      console.log('Hotkey registered:', hotkey);
    } else {
      console.error('Failed to register hotkey:', hotkey);
    }
  } catch (error) {
    console.error('Error registering hotkey:', error);
  }

  // Register voice input hotkey if enabled
  registerVoiceHotkey();
  
  // Register all feature hotkeys
  registerFeatureHotkeys();
}

/**
 * Unregister all hotkeys
 */
export function unregisterHotkeys(): void {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey);
    registeredHotkey = null;
  }
  if (registeredVoiceHotkey) {
    globalShortcut.unregister(registeredVoiceHotkey);
    registeredVoiceHotkey = null;
  }
  unregisterFeatureHotkeys();
  globalShortcut.unregisterAll();
}

/**
 * Update the registered hotkey
 */
export function updateHotkey(newHotkey: string): boolean {
  try {
    // Try to register the new hotkey first
    globalShortcut.register(newHotkey, async () => {
      // Capture context BEFORE showing our window
      // This is critical - the external app must still be focused
      const settings = getSettings();
      if (settings.contextAwareness?.enabled) {
        await contextCaptureService.captureContext();
      }

      showCommandWindow();
    });

    const success = globalShortcut.isRegistered(newHotkey);
    if (success) {
      // Unregister old hotkey
      if (registeredHotkey) {
        globalShortcut.unregister(registeredHotkey);
      }
      registeredHotkey = newHotkey;
      console.log('Hotkey updated to:', newHotkey);
      return true;
    } else {
      console.error('Failed to register new hotkey:', newHotkey);
      return false;
    }
  } catch (error) {
    console.error('Error updating hotkey:', error);
    return false;
  }
}

/**
 * Check if a hotkey is registered
 */
export function isHotkeyRegistered(hotkey: string): boolean {
  return globalShortcut.isRegistered(hotkey);
}

/**
 * Get the currently registered hotkey
 */
export function getRegisteredHotkey(): string | null {
  return registeredHotkey;
}

/**
 * Register voice input hotkey
 */
export function registerVoiceHotkey(): void {
  const settings = getSettings();

  if (!settings.voiceInput?.enabled) {
    console.log('Voice input is disabled, skipping hotkey registration');
    return;
  }

  const voiceHotkey = settings.voiceInput.hotkey;

  try {
    // Unregister any existing voice hotkey
    if (registeredVoiceHotkey) {
      globalShortcut.unregister(registeredVoiceHotkey);
    }

    // Register the voice hotkey with toggle behavior
    globalShortcut.register(voiceHotkey, () => {
      console.log('Voice hotkey triggered:', voiceHotkey);
      voiceInputManager.toggleRecording();
    });

    const success = globalShortcut.isRegistered(voiceHotkey);
    if (success) {
      registeredVoiceHotkey = voiceHotkey;
      console.log('Voice hotkey registered:', voiceHotkey);
    } else {
      console.error('Failed to register voice hotkey:', voiceHotkey);
    }
  } catch (error) {
    console.error('Error registering voice hotkey:', error);
  }
}

/**
 * Unregister voice input hotkey
 */
export function unregisterVoiceHotkey(): void {
  if (registeredVoiceHotkey) {
    globalShortcut.unregister(registeredVoiceHotkey);
    registeredVoiceHotkey = null;
    console.log('Voice hotkey unregistered');
  }
}

/**
 * Register all feature hotkeys (clipboard, transcribe, command, recording)
 */
export function registerFeatureHotkeys(): void {
  const settings = getSettings();
  const hotkeys = settings.hotkeys;
  
  if (!hotkeys) return;

  // Clipboard History Hotkey
  try {
    if (registeredClipboardHistoryHotkey) {
      globalShortcut.unregister(registeredClipboardHistoryHotkey);
    }
    
    globalShortcut.register(hotkeys.clipboardHistory, () => {
      console.log('Clipboard history hotkey triggered');
      toggleClipboardHistoryWindow().catch(err => {
        console.error('Failed to toggle clipboard history window:', err);
      });
    });
    
    if (globalShortcut.isRegistered(hotkeys.clipboardHistory)) {
      registeredClipboardHistoryHotkey = hotkeys.clipboardHistory;
      console.log('Clipboard history hotkey registered:', hotkeys.clipboardHistory);
    }
  } catch (error) {
    console.error('Error registering clipboard history hotkey:', error);
  }

  // Voice Transcribe Hotkey (speech-to-text only)
  try {
    if (registeredVoiceTranscribeHotkey) {
      globalShortcut.unregister(registeredVoiceTranscribeHotkey);
    }
    
    globalShortcut.register(hotkeys.voiceTranscribe, () => {
      console.log('Voice transcribe hotkey triggered');
      toggleVoiceRecordingWindow('transcribe').catch(err => {
        console.error('Failed to toggle voice transcribe window:', err);
      });
    });
    
    if (globalShortcut.isRegistered(hotkeys.voiceTranscribe)) {
      registeredVoiceTranscribeHotkey = hotkeys.voiceTranscribe;
      console.log('Voice transcribe hotkey registered:', hotkeys.voiceTranscribe);
    }
  } catch (error) {
    console.error('Error registering voice transcribe hotkey:', error);
  }

  // Voice Command Hotkey (speech-to-command)
  try {
    if (registeredVoiceCommandHotkey) {
      globalShortcut.unregister(registeredVoiceCommandHotkey);
    }
    
    globalShortcut.register(hotkeys.voiceCommand, () => {
      console.log('Voice command hotkey triggered');
      toggleVoiceRecordingWindow('command').catch(err => {
        console.error('Failed to toggle voice command window:', err);
      });
    });
    
    if (globalShortcut.isRegistered(hotkeys.voiceCommand)) {
      registeredVoiceCommandHotkey = hotkeys.voiceCommand;
      console.log('Voice command hotkey registered:', hotkeys.voiceCommand);
    }
  } catch (error) {
    console.error('Error registering voice command hotkey:', error);
  }

  // Audio Recording Hotkey
  try {
    if (registeredAudioRecordingHotkey) {
      globalShortcut.unregister(registeredAudioRecordingHotkey);
    }
    
    globalShortcut.register(hotkeys.audioRecording, () => {
      console.log('Audio recording hotkey triggered');
      toggleAudioRecordingWindow().catch(err => {
        console.error('Failed to toggle audio recording window:', err);
      });
    });
    
    if (globalShortcut.isRegistered(hotkeys.audioRecording)) {
      registeredAudioRecordingHotkey = hotkeys.audioRecording;
      console.log('Audio recording hotkey registered:', hotkeys.audioRecording);
    }
  } catch (error) {
    console.error('Error registering audio recording hotkey:', error);
  }

  // Video Recording Hotkey
  try {
    if (registeredVideoRecordingHotkey) {
      globalShortcut.unregister(registeredVideoRecordingHotkey);
    }

    globalShortcut.register(hotkeys.videoRecording, () => {
      console.log('Video recording hotkey triggered');
      toggleVideoRecordingWindow().catch(err => {
        console.error('Failed to toggle video recording window:', err);
      });
    });

    if (globalShortcut.isRegistered(hotkeys.videoRecording)) {
      registeredVideoRecordingHotkey = hotkeys.videoRecording;
      console.log('Video recording hotkey registered:', hotkeys.videoRecording);
    }
  } catch (error) {
    console.error('Error registering video recording hotkey:', error);
  }

  // Chat Panel Hotkey
  try {
    if (registeredChatHotkey) {
      globalShortcut.unregister(registeredChatHotkey);
    }

    globalShortcut.register(hotkeys.chat, () => {
      console.log('Chat panel hotkey triggered');
      toggleChatPanelWindow().catch(err => {
        console.error('Failed to toggle chat panel window:', err);
      });
    });

    if (globalShortcut.isRegistered(hotkeys.chat)) {
      registeredChatHotkey = hotkeys.chat;
      console.log('Chat panel hotkey registered:', hotkeys.chat);
    }
  } catch (error) {
    console.error('Error registering chat panel hotkey:', error);
  }

  // Voice-to-Clipboard Hotkey (Ctrl+Shift+W)
  try {
    const voiceToClipboardHotkey = 'CommandOrControl+Shift+W';
    
    if (registeredVoiceToClipboardHotkey) {
      globalShortcut.unregister(registeredVoiceToClipboardHotkey);
    }

    globalShortcut.register(voiceToClipboardHotkey, () => {
      console.log('Voice-to-clipboard hotkey triggered');
      voiceToClipboardManager.toggleRecording().catch(err => {
        console.error('Failed to toggle voice-to-clipboard:', err);
      });
    });

    if (globalShortcut.isRegistered(voiceToClipboardHotkey)) {
      registeredVoiceToClipboardHotkey = voiceToClipboardHotkey;
      console.log('Voice-to-clipboard hotkey registered:', voiceToClipboardHotkey);
    }
  } catch (error) {
    console.error('Error registering voice-to-clipboard hotkey:', error);
  }
}

/**
 * Unregister all feature hotkeys
 */
export function unregisterFeatureHotkeys(): void {
  if (registeredClipboardHistoryHotkey) {
    globalShortcut.unregister(registeredClipboardHistoryHotkey);
    registeredClipboardHistoryHotkey = null;
  }
  if (registeredVoiceTranscribeHotkey) {
    globalShortcut.unregister(registeredVoiceTranscribeHotkey);
    registeredVoiceTranscribeHotkey = null;
  }
  if (registeredVoiceCommandHotkey) {
    globalShortcut.unregister(registeredVoiceCommandHotkey);
    registeredVoiceCommandHotkey = null;
  }
  if (registeredAudioRecordingHotkey) {
    globalShortcut.unregister(registeredAudioRecordingHotkey);
    registeredAudioRecordingHotkey = null;
  }
  if (registeredVideoRecordingHotkey) {
    globalShortcut.unregister(registeredVideoRecordingHotkey);
    registeredVideoRecordingHotkey = null;
  }
  if (registeredChatHotkey) {
    globalShortcut.unregister(registeredChatHotkey);
    registeredChatHotkey = null;
  }
  if (registeredVoiceToClipboardHotkey) {
    globalShortcut.unregister(registeredVoiceToClipboardHotkey);
    registeredVoiceToClipboardHotkey = null;
  }
}
