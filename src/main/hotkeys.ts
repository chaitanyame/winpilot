// Global Hotkey Registration

import { globalShortcut } from 'electron';
import { toggleCommandWindow } from './windows';
import { getSettings } from './store';

let registeredHotkey: string | null = null;

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
    const success = globalShortcut.register(hotkey, () => {
      console.log('Hotkey triggered:', hotkey);
      toggleCommandWindow();
    });

    if (success) {
      registeredHotkey = hotkey;
      console.log('Hotkey registered:', hotkey);
    } else {
      console.error('Failed to register hotkey:', hotkey);
    }
  } catch (error) {
    console.error('Error registering hotkey:', error);
  }
}

/**
 * Unregister all hotkeys
 */
export function unregisterHotkeys(): void {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey);
    registeredHotkey = null;
  }
  globalShortcut.unregisterAll();
}

/**
 * Update the registered hotkey
 */
export function updateHotkey(newHotkey: string): boolean {
  try {
    // Try to register the new hotkey first
    const success = globalShortcut.register(newHotkey, () => {
      toggleCommandWindow();
    });

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
