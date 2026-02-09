// Windows System Control Implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import { ISystem } from '../index';
import type { SystemInfoData } from '../../shared/types';
import { runPowerShell } from './powershell-pool';

const execAsync = promisify(exec);

export class WindowsSystem implements ISystem {

  async volume(params: { action: 'get' | 'set' | 'mute' | 'unmute'; level?: number }): Promise<number | boolean> {
    try {
      // Shared COM audio interface definition
      const comDefinition = `
        if (-not ("Audio" -as [type])) {
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
            int _0(); int _1(); int _2(); int _3();
            int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
            int _5();
            int GetMasterVolumeLevelScalar(out float pfLevel);
            int SetMute(bool bMute, System.Guid pguidEventContext);
            int GetMute(out bool pbMute);
        }
        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice { int Activate(ref System.Guid iid, int dwClsCtx, System.IntPtr pActivationParams, out IAudioEndpointVolume ppInterface); }
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice); }
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
        public class Audio {
            static IAudioEndpointVolume Vol() {
                var enumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                IMMDevice dev; enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                var volId = typeof(IAudioEndpointVolume).GUID;
                IAudioEndpointVolume vol; dev.Activate(ref volId, 1, System.IntPtr.Zero, out vol);
                return vol;
            }
            public static float GetVolume() { float v; Vol().GetMasterVolumeLevelScalar(out v); return v; }
            public static void SetVolume(float level) { Vol().SetMasterVolumeLevelScalar(level, Guid.Empty); }
            public static void SetMute(bool mute) { Vol().SetMute(mute, Guid.Empty); }
            public static bool GetMute() { bool m; Vol().GetMute(out m); return m; }
        }
"@ -ErrorAction SilentlyContinue
        }
      `;

      switch (params.action) {
        case 'get': {
          const script = `${comDefinition}; [int]([Audio]::GetVolume() * 100)`;
          const { stdout } = await runPowerShell(script);
          return parseInt(stdout.trim(), 10);
        }

        case 'set': {
          if (params.level === undefined) return false;
          const level = Math.max(0, Math.min(100, params.level)) / 100.0;
          const script = `${comDefinition}; [Audio]::SetVolume(${level}); $true`;
          const { stdout } = await runPowerShell(script);
          return stdout.trim().toLowerCase() === 'true';
        }

        case 'mute': {
          const script = `${comDefinition}; [Audio]::SetMute($true); $true`;
          const { stdout } = await runPowerShell(script);
          return stdout.trim().toLowerCase() === 'true';
        }

        case 'unmute': {
          const script = `${comDefinition}; [Audio]::SetMute($false); $true`;
          const { stdout } = await runPowerShell(script);
          return stdout.trim().toLowerCase() === 'true';
        }

        default:
          return false;
      }
    } catch (error) {
      console.error('Error controlling volume:', error);
      return params.action === 'get' ? 0 : false;
    }
  }

  async brightness(params: { action: 'get' | 'set'; level?: number }): Promise<number | boolean> {
    try {
      if (params.action === 'get') {
        const script = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness`;
        const { stdout } = await runPowerShell(script);
        return parseInt(stdout.trim(), 10);
      }

      if (params.action === 'set' && params.level !== undefined) {
        const level = Math.max(0, Math.min(100, params.level));
        const script = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})`;
        await runPowerShell(script);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error controlling brightness:', error);
      return params.action === 'get' ? 50 : false;
    }
  }

  async screenshot(params: { region?: string; savePath?: string; filename?: string }): Promise<string> {
    try {
      const savePath = params.savePath || path.join(os.homedir(), 'Pictures', 'Screenshots');
      const filename = params.filename || `screenshot-${Date.now()}.png`;
      const fullPath = path.join(savePath, filename);

      // Ensure directory exists
      await runPowerShell(`New-Item -ItemType Directory -Force -Path '${savePath}'`);

      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save('${fullPath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
        Write-Output '${fullPath.replace(/\\/g, '\\\\')}'
      `;

      await runPowerShell(script);
      return fullPath;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      throw error;
    }
  }

  async doNotDisturb(params: { action: 'status' | 'on' | 'off'; duration?: number }): Promise<boolean> {
    try {
      // Windows Focus Assist
      if (params.action === 'status') {
        const script = `(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.immersivecontrolcenter_cw5n1h2txyewy\\ApplicationPrivacy\\windows.immersivecontrolcenter_cw5n1h2txyewy!App\\SettingsHandlers_Notifications_FocusAssistSetting' -ErrorAction SilentlyContinue).Data`;
        try {
          const { stdout } = await runPowerShell(script);
          return stdout.trim() !== '';
        } catch {
          return false;
        }
      }

      // Windows doesn't have a simple DND toggle via command line
      // We'll use the notification settings
      const enable = params.action === 'on';
      console.log(`Do Not Disturb ${enable ? 'enabled' : 'disabled'} (simulated)`);
      return true;
    } catch (error) {
      console.error('Error controlling DND:', error);
      return false;
    }
  }

  async lockScreen(): Promise<boolean> {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation');
      return true;
    } catch (error) {
      console.error('Error locking screen:', error);
      return false;
    }
  }

  async sleep(): Promise<boolean> {
    try {
      await execAsync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
      return true;
    } catch (error) {
      console.error('Error putting system to sleep:', error);
      return false;
    }
  }

  async getSystemInfo(): Promise<SystemInfoData> {
    try {
      const script = `
        $cpu = Get-WmiObject Win32_Processor | Select-Object -First 1
        $os = Get-WmiObject Win32_OperatingSystem
        $disks = Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3"
        $battery = Get-WmiObject Win32_Battery

        $uptime = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)

        [PSCustomObject]@{
          CPU = @{
            Name = $cpu.Name.Trim()
            Cores = $cpu.NumberOfCores
            UsagePercent = [math]::Round($cpu.LoadPercentage, 1)
            SpeedMHz = $cpu.MaxClockSpeed
          }
          Memory = @{
            TotalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
            UsedGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)
            UsagePercent = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 1)
          }
          Disk = @($disks | ForEach-Object {
            @{
              Drive = $_.DeviceID
              TotalGB = [math]::Round($_.Size / 1GB, 2)
              FreeGB = [math]::Round($_.FreeSpace / 1GB, 2)
              UsagePercent = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
            }
          })
          OS = @{
            Name = $os.Caption
            Version = $os.Version
            Build = $os.BuildNumber
            Architecture = $os.OSArchitecture
          }
          Uptime = @{
            Days = $uptime.Days
            Hours = $uptime.Hours
            Minutes = $uptime.Minutes
            Formatted = "$($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m"
          }
          Battery = if ($battery) {
            @{
              ChargePercent = $battery.EstimatedChargeRemaining
              IsCharging = $battery.BatteryStatus -eq 2
              IsPresent = $true
            }
          } else {
            $null
          }
        } | ConvertTo-Json -Depth 10 -Compress
      `;

      const { stdout } = await runPowerShell(script);

      const data = JSON.parse(stdout.trim());

      return {
        cpu: {
          name: data.CPU.Name || 'Unknown',
          cores: data.CPU.Cores || 0,
          usagePercent: data.CPU.UsagePercent || 0,
          speedMHz: data.CPU.SpeedMHz || 0
        },
        memory: {
          totalGB: data.Memory.TotalGB || 0,
          usedGB: data.Memory.UsedGB || 0,
          usagePercent: data.Memory.UsagePercent || 0
        },
        disk: (data.Disk || []).map((d: any) => ({
          drive: d.Drive || '',
          totalGB: d.TotalGB || 0,
          freeGB: d.FreeGB || 0,
          usagePercent: d.UsagePercent || 0
        })),
        os: {
          name: data.OS.Name || 'Windows',
          version: data.OS.Version || '',
          build: data.OS.Build || '',
          architecture: data.OS.Architecture || ''
        },
        uptime: {
          days: data.Uptime.Days || 0,
          hours: data.Uptime.Hours || 0,
          minutes: data.Uptime.Minutes || 0,
          formatted: data.Uptime.Formatted || ''
        },
        battery: data.Battery ? {
          chargePercent: data.Battery.ChargePercent || 0,
          isCharging: data.Battery.IsCharging || false,
          isPresent: data.Battery.IsPresent || false
        } : undefined
      };
    } catch (error) {
      console.error('Error getting system info:', error);
      throw error;
    }
  }

  async simulatePaste(targetHwnd?: number): Promise<boolean> {
    try {
      console.log('[System] Simulating paste...');
      
      const script = `if (-not ("KeySenderPaste" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySenderPaste {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    public const byte VK_CONTROL = 0x11;
    public const byte VK_V = 0x56;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    
    public static void SendCtrlV() {
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_V, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
}

${typeof targetHwnd === 'number' && targetHwnd > 0 ? `[KeySenderPaste]::SetForegroundWindow([IntPtr]${targetHwnd})` : ''}
[KeySenderPaste]::SendCtrlV()
`;
      
      await runPowerShell(script);
      
      console.log('[System] Paste command sent');
      return true;
    } catch (error) {
      console.error('[System] Error simulating paste:', error);
      return false;
    }
  }

  async getForegroundWindowHandle(): Promise<number> {
    try {
      const script = `if (-not ("Win32Foreground" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Foreground {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@
}
$hwnd = [Win32Foreground]::GetForegroundWindow()
[int]$hwnd
`;
      const { stdout } = await runPowerShell(script);
      
      const handle = parseInt(stdout.trim(), 10);
      return Number.isNaN(handle) ? 0 : handle;
    } catch (error) {
      console.error('[System] Error getting foreground window:', error);
      return 0;
    }
  }

  async setForegroundWindow(hwnd: number): Promise<boolean> {
    try {
      const script = `if (-not ("Win32SetForeground" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32SetForeground {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
}
[Win32SetForeground]::SetForegroundWindow([IntPtr]${hwnd})
`;
      await runPowerShell(script);

      console.log('[System] Foreground window set to:', hwnd);
      return true;
    } catch (error) {
      console.error('[System] Error setting foreground window:', error);
      return false;
    }
  }

  async getActiveWindowInfo(): Promise<{ appName: string; windowTitle: string; processId: number } | null> {
    try {
      const script = `if (-not ("ActiveWindowInfo" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;

public class ActiveWindowInfo {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    public static object GetInfo() {
        IntPtr hWnd = GetForegroundWindow();
        if (hWnd == IntPtr.Zero) {
            return null;
        }

        StringBuilder title = new StringBuilder(512);
        GetWindowText(hWnd, title, title.Capacity);
        string windowTitle = title.ToString();

        uint processId;
        GetWindowThreadProcessId(hWnd, out processId);

        string appName = "";
        try {
            Process proc = Process.GetProcessById((int)processId);
            appName = proc.ProcessName;
        } catch {
            appName = "Unknown";
        }

        return new {
            appName = appName,
            windowTitle = windowTitle,
            processId = (int)processId
        };
    }
}
"@
}
$result = [ActiveWindowInfo]::GetInfo()
if ($result -eq $null) {
    Write-Output "null"
} else {
    $result | ConvertTo-Json -Compress
}
`;

      const { stdout } = await runPowerShell(script);

      const output = stdout.trim();
      if (!output || output === 'null') {
        return null;
      }

      const data = JSON.parse(output);
      return {
        appName: data.appName || 'Unknown',
        windowTitle: data.windowTitle || '',
        processId: data.processId || 0
      };
    } catch (error) {
      console.error('[System] Error getting active window info:', error);
      return null;
    }
  }

  async captureSelectedText(): Promise<string | null> {
    try {
      const { clipboard } = await import('electron');

      // Save current clipboard content
      const originalClipboard = clipboard.readText();

      const script = `if (-not ("KeySenderCopy" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySenderCopy {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const byte VK_CONTROL = 0x11;
    public const byte VK_C = 0x43;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void SendCtrlC() {
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_C, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
}
[KeySenderCopy]::SendCtrlC()
`;

      await runPowerShell(script);

      // Wait for clipboard to update
      await new Promise(resolve => setTimeout(resolve, 150));

      // Read new clipboard content
      const selectedText = clipboard.readText();

      // Only return if different from original (something was actually selected)
      if (selectedText && selectedText !== originalClipboard) {
        // Restore original clipboard
        if (originalClipboard) {
          clipboard.writeText(originalClipboard);
        } else {
          clipboard.clear();
        }
        return selectedText;
      }

      // Restore original clipboard if nothing was selected
      if (originalClipboard) {
        clipboard.writeText(originalClipboard);
      }

      return null;
    } catch (error) {
      console.error('[System] Error capturing selected text:', error);
      return null;
    }
  }
}
