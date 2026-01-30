// Windows WiFi Control Implementation

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WiFiStatus {
  enabled: boolean;
  connected: boolean;
  ssid?: string;
  signalStrength?: number;
  interfaceName: string;
}

export interface WiFiNetwork {
  ssid: string;
  signalStrength: number;
  authentication: string;
}

export class WindowsWiFi {
  private static readonly WIFI_INTERFACE_NAME = 'Wi-Fi';

  /**
   * Get the WiFi interface name (handles different locale names)
   */
  private async getWiFiInterfaceName(): Promise<string> {
    try {
      // Get all interfaces and find the WiFi one
      const script = `
        (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.Virtual -eq $false } |
        Where-Object { $_.Name -like '*Wi-Fi*' -or $_.Name -like '*Wireless*' -or $_.Name -like '*WLAN*' }).Name
      `;
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
      const name = stdout.trim();
      return name || WindowsWiFi.WIFI_INTERFACE_NAME;
    } catch {
      return WindowsWiFi.WIFI_INTERFACE_NAME;
    }
  }

  /**
   * Get WiFi status
   */
  async getStatus(): Promise<WiFiStatus> {
    try {
      const interfaceName = await this.getWiFiInterfaceName();

      // Check if WiFi is enabled and get connection info
      const script = `
        $interface = Get-NetAdapter -Name '${interfaceName}' -ErrorAction SilentlyContinue
        if ($interface) {
          $enabled = $interface.Status -eq 'Up'
          $connection = Get-NetConnectionProfile -InterfaceAlias '${interfaceName}' -ErrorAction SilentlyContinue
          if ($connection -and $enabled) {
            $connected = $true
            $ssid = (netsh wlan show interfaces | Select-String 'SSID' | Select-Object -First 1).ToString().Split(':')[1].Trim()
            $signal = (netsh wlan show interfaces | Select-String 'Signal' | Select-Object -First 1).ToString().Split(':')[1].Trim().Replace('%','')
            @{
              Enabled = $enabled
              Connected = $connected
              SSID = $ssid
              SignalStrength = [int]$signal
              InterfaceName = '${interfaceName}'
            }
          } else {
            @{
              Enabled = $enabled
              Connected = $false
              InterfaceName = '${interfaceName}'
            }
          }
        } else {
          @{
            Enabled = $false
            Connected = $false
            InterfaceName = '${interfaceName}'
          }
        }
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);

      // Parse the PowerShell output
      const lines = stdout.trim().split('\n');
      const result: WiFiStatus = {
        enabled: false,
        connected: false,
        interfaceName
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Enabled :')) {
          result.enabled = trimmed.includes('True');
        } else if (trimmed.startsWith('Connected :')) {
          result.connected = trimmed.includes('True');
        } else if (trimmed.startsWith('SSID :')) {
          result.ssid = trimmed.split(':')[1].trim();
        } else if (trimmed.startsWith('SignalStrength :')) {
          result.signalStrength = parseInt(trimmed.split(':')[1].trim(), 10);
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting WiFi status:', error);
      return {
        enabled: false,
        connected: false,
        interfaceName: WindowsWiFi.WIFI_INTERFACE_NAME
      };
    }
  }

  /**
   * Turn on WiFi
   */
  async enable(): Promise<boolean> {
    try {
      const interfaceName = await this.getWiFiInterfaceName();
      await execAsync(`netsh interface set interface "${interfaceName}" enabled`);
      return true;
    } catch (error) {
      console.error('Error enabling WiFi:', error);
      return false;
    }
  }

  /**
   * Turn off WiFi
   */
  async disable(): Promise<boolean> {
    try {
      const interfaceName = await this.getWiFiInterfaceName();
      await execAsync(`netsh interface set interface "${interfaceName}" disabled`);
      return true;
    } catch (error) {
      console.error('Error disabling WiFi:', error);
      return false;
    }
  }

  /**
   * Toggle WiFi
   */
  async toggle(): Promise<{ enabled: boolean }> {
    const status = await this.getStatus();
    if (status.enabled) {
      await this.disable();
      return { enabled: false };
    } else {
      await this.enable();
      return { enabled: true };
    }
  }

  /**
   * List saved WiFi networks
   */
  async listNetworks(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync('netsh wlan show profiles');
      const profileLines = stdout.split('\n').filter(line => line.includes('All User Profile'));

      const networks: WiFiNetwork[] = [];

      for (const line of profileLines) {
        const ssid = line.split(':')[1].trim();
        if (ssid) {
          networks.push({
            ssid,
            signalStrength: 0, // Not available for saved networks
            authentication: 'Unknown'
          });
        }
      }

      return networks;
    } catch (error) {
      console.error('Error listing WiFi networks:', error);
      return [];
    }
  }

  /**
   * List available WiFi networks (in range)
   */
  async listAvailableNetworks(): Promise<WiFiNetwork[]> {
    try {
      const { stdout } = await execAsync('netsh wlan show networks mode=bssid');
      const lines = stdout.split('\n');

      const networks: WiFiNetwork[] = [];
      let currentNetwork: Partial<WiFiNetwork> | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('SSID')) {
          if (currentNetwork && currentNetwork.ssid) {
            networks.push(currentNetwork as WiFiNetwork);
          }
          const ssid = trimmed.split(':')[1].trim();
          currentNetwork = { ssid, signalStrength: 0, authentication: '' };
        } else if (currentNetwork && trimmed.includes('Network type')) {
          // Skip
        } else if (currentNetwork && trimmed.includes('Authentication')) {
          currentNetwork.authentication = trimmed.split(':')[1].trim();
        } else if (currentNetwork && trimmed.includes('Signal')) {
          const signalStr = trimmed.split(':')[1].trim().replace('%', '');
          currentNetwork.signalStrength = parseInt(signalStr, 10);
        }
      }

      if (currentNetwork && currentNetwork.ssid) {
        networks.push(currentNetwork as WiFiNetwork);
      }

      return networks;
    } catch (error) {
      console.error('Error listing available WiFi networks:', error);
      return [];
    }
  }
}

export const windowsWiFi = new WindowsWiFi();
