// Windows Media Control Implementation
// Uses system media keys via PowerShell for universal media control

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Media Control Interface
 */
export interface IMedia {
  play(): Promise<boolean>;
  pause(): Promise<boolean>;
  playPause(): Promise<boolean>;
  next(): Promise<boolean>;
  previous(): Promise<boolean>;
  stop(): Promise<boolean>;
}

/**
 * Send a media key using PowerShell and user32.dll
 * VK_MEDIA_PLAY_PAUSE = 0xB3
 * VK_MEDIA_NEXT_TRACK = 0xB0
 * VK_MEDIA_PREV_TRACK = 0xB1
 * VK_MEDIA_STOP = 0xB2
 */
async function sendMediaKey(keyCode: number): Promise<boolean> {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MediaKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const int KEYEVENTF_KEYUP = 0x0002;

    public static void SendMediaKey(byte key) {
        keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
[MediaKeys]::SendMediaKey(${keyCode})
`;

  try {
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      timeout: 5000,
    });
    return true;
  } catch (error) {
    console.error('Failed to send media key:', error);
    return false;
  }
}

/**
 * Windows Media Control Implementation
 * Uses system media keys that work with any media player
 */
export class WindowsMedia implements IMedia {
  // Media key codes
  private static readonly VK_MEDIA_PLAY_PAUSE = 0xB3;
  private static readonly VK_MEDIA_NEXT_TRACK = 0xB0;
  private static readonly VK_MEDIA_PREV_TRACK = 0xB1;
  private static readonly VK_MEDIA_STOP = 0xB2;

  async play(): Promise<boolean> {
    // Play/Pause toggle - same key for both
    return sendMediaKey(WindowsMedia.VK_MEDIA_PLAY_PAUSE);
  }

  async pause(): Promise<boolean> {
    // Play/Pause toggle - same key for both
    return sendMediaKey(WindowsMedia.VK_MEDIA_PLAY_PAUSE);
  }

  async playPause(): Promise<boolean> {
    return sendMediaKey(WindowsMedia.VK_MEDIA_PLAY_PAUSE);
  }

  async next(): Promise<boolean> {
    return sendMediaKey(WindowsMedia.VK_MEDIA_NEXT_TRACK);
  }

  async previous(): Promise<boolean> {
    return sendMediaKey(WindowsMedia.VK_MEDIA_PREV_TRACK);
  }

  async stop(): Promise<boolean> {
    return sendMediaKey(WindowsMedia.VK_MEDIA_STOP);
  }
}

export const windowsMedia = new WindowsMedia();
