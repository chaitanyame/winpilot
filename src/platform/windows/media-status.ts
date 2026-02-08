// Media status via Windows GSMTC (Global System Media Transport Controls)

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

export async function getMediaStatus(): Promise<MediaStatus> {
  const script = `Add-Type -AssemblyName System.Runtime.WindowsRuntime; $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]; $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync(); $taskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1; $task = $taskGeneric.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($asyncOp)); $null = $task.Wait(-1); $sessionManager = $task.Result; $session = $sessionManager.GetCurrentSession(); if ($null -eq $session) { Write-Output 'NO_SESSION'; return }; $info = $session.TryGetMediaPropertiesAsync(); $taskInfo = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' } | Select-Object -First 1; $infoTask = $taskInfo.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($info)); $null = $infoTask.Wait(-1); $mediaProps = $infoTask.Result; $playback = $session.GetPlaybackInfo(); $status = $playback.PlaybackStatus; @{ isPlaying = ($status -eq 4); title = $mediaProps.Title; artist = $mediaProps.Artist; album = $mediaProps.AlbumTitle; app = $session.SourceAppUserModelId } | ConvertTo-Json -Compress`;

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${script}"`,
      { timeout: 10000 }
    );

    const trimmed = stdout.trim();
    if (trimmed === 'NO_SESSION') {
      return { isPlaying: false };
    }

    const data = JSON.parse(trimmed);
    if (data.app) {
      data.app = data.app.replace(/\.exe$/i, '').split('\\').pop()?.split('!')[0] || data.app;
    }
    return data;
  } catch {
    return { isPlaying: false };
  }
}
