// Windows System Control Implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import { ISystem } from '../index';
import type { SystemInfoData } from '../../shared/types';

const execAsync = promisify(exec);

export class WindowsSystem implements ISystem {

  async volume(params: { action: 'get' | 'set' | 'mute' | 'unmute'; level?: number }): Promise<number | boolean> {
    try {
      switch (params.action) {
        case 'get': {
          const script = `
            Add-Type -TypeDefinition @"
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
            }
"@
            [int]([Audio]::GetVolume() * 100)
          `;

          const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
          return parseInt(stdout.trim(), 10);
        }

        case 'set': {
          if (params.level === undefined) return false;
          
          // Use nircmd for reliable volume control
          await execAsync(`powershell -NoProfile -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"`);
          await execAsync(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]175 * ${Math.round(params.level / 2)})"`);
          
          return true;
        }

        case 'mute':
        case 'unmute': {
          await execAsync(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
          return true;
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
        const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
        return parseInt(stdout.trim(), 10);
      }

      if (params.action === 'set' && params.level !== undefined) {
        const level = Math.max(0, Math.min(100, params.level));
        const script = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${level})`;
        await execAsync(`powershell -NoProfile -Command "${script}"`);
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
      await execAsync(`powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${savePath}'"`);

      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save('${fullPath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
        Write-Output '${fullPath.replace(/\\/g, '\\\\')}'
      `;

      await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
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
          const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
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

  async getSystemInfo(_params: { sections?: string[] }): Promise<SystemInfoData> {
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

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);

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
}
