// Global Hotkey Registration

import { globalShortcut } from 'electron';
import { toggleCommandWindow } from './windows';
import { getSettings } from './store';
import { voiceInputManager } from './voice-input';

let registeredHotkey: string | null = null;
let registeredVoiceHotkey: string | null = null;

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
    globalShortcut.register(hotkey, () => {
      console.log('Hotkey triggered:', hotkey);
      toggleCommandWindow();
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
  globalShortcut.unregisterAll();
}

/**
 * Update the registered hotkey
 */
export function updateHotkey(newHotkey: string): boolean {
  try {
    // Try to register the new hotkey first
    globalShortcut.register(newHotkey, () => {
      toggleCommandWindow();
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
