// Windows Media Control via Media Keys and GSMTC

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MediaStatus {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  app?: string;
}

async function sendMediaKey(key: 'play_pause' | 'next' | 'previous' | 'stop'): Promise<boolean> {
  const vkCodes: Record<string, number> = { play_pause: 0xB3, next: 0xB0, previous: 0xB1, stop: 0xB2 };
  const vk = vkCodes[key];
  if (!vk) return false;

  const script = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MediaKeys {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Send(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }
}
"@
[MediaKeys]::Send(${vk})`;

  try {
    await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}" `);
    return true;
  } catch { return false; }
}

async function getMediaStatus(): Promise<MediaStatus> {
  const script = 'Add-Type -AssemblyName System.Runtime.WindowsRuntime; try { $sm = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]; $op = $sm::RequestAsync(); $task = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where {$_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1} | Select -First 1; $t = $task.MakeGenericMethod($sm).Invoke($null, @($op)); $t.Wait(-1); $s = $t.Result.GetCurrentSession(); if (!$s) { Write-Output "NO"; return }; $pi = $s.TryGetMediaPropertiesAsync(); $pt = $task.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($pi)); $pt.Wait(-1); $p = $pt.Result; $pb = $s.GetPlaybackInfo(); @{isPlaying=($pb.PlaybackStatus -eq 4);title=$p.Title;artist=$p.Artist;album=$p.AlbumTitle;app=$s.SourceAppUserModelId} | ConvertTo-Json -Compress } catch { Write-Output "NO" }';

  try {
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 10000 });
    if (stdout.trim() === 'NO') return { isPlaying: false };
    const data = JSON.parse(stdout.trim());
    if (data.app) data.app = data.app.replace(/\.exe$/i, '').split('\\').pop()?.split('!')[0] || data.app;
    return data;
  } catch { return { isPlaying: false }; }
}

export class WindowsMedia {
  async play(): Promise<boolean> { return this.playPause(); }
  async pause(): Promise<boolean> { return this.playPause(); }
  async playPause(): Promise<boolean> { return sendMediaKey('play_pause'); }
  async next(): Promise<boolean> { return sendMediaKey('next'); }
  async nextTrack(): Promise<boolean> { return this.next(); }
  async previous(): Promise<boolean> { return sendMediaKey('previous'); }
  async previousTrack(): Promise<boolean> { return this.previous(); }
  async stop(): Promise<boolean> { return sendMediaKey('stop'); }
  async getStatus(): Promise<MediaStatus> { return getMediaStatus(); }
}

export const windowsMedia = new WindowsMedia();
