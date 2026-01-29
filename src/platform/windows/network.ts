// Windows Network Implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import { INetwork } from '../index';
import type { NetworkInfoData, NetworkTestResult } from '../../shared/types';

const execAsync = promisify(exec);

export class WindowsNetwork implements INetwork {

  async getNetworkInfo(params: { includeInactive?: boolean }): Promise<NetworkInfoData> {
    try {
      // Get hostname
      const { stdout: hostnameOutput } = await execAsync('hostname');
      const hostname = hostnameOutput.trim();

      // Get network interfaces
      const interfaceScript = `
        Get-NetAdapter | Where-Object { ${params.includeInactive ? '$true' : '$_.Status -eq "Up"'} } | ForEach-Object {
          $adapter = $_
          $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
          [PSCustomObject]@{
            Name = $adapter.Name
            Type = $adapter.InterfaceDescription
            Status = $adapter.Status
            IPv4 = if ($ipConfig) { $ipConfig.IPAddress } else { $null }
            MAC = $adapter.MacAddress
          }
        } | ConvertTo-Json -Compress
      `;

      const { stdout: interfacesOutput } = await execAsync(`powershell -NoProfile -Command "${interfaceScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);

      let interfaces = [];
      try {
        const parsed = JSON.parse(interfacesOutput.trim());
        interfaces = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        interfaces = [];
      }

      // Get WiFi info if available
      let wifi: { ssid: string; signalStrength: number; channel: number } | undefined;
      try {
        const { stdout: wifiOutput } = await execAsync('netsh wlan show interfaces');
        const ssidMatch = wifiOutput.match(/SSID\s+:\s+(.+)/);
        const signalMatch = wifiOutput.match(/Signal\s+:\s+(\d+)%/);
        const channelMatch = wifiOutput.match(/Channel\s+:\s+(\d+)/);

        if (ssidMatch && signalMatch && channelMatch) {
          wifi = {
            ssid: ssidMatch[1].trim(),
            signalStrength: parseInt(signalMatch[1], 10),
            channel: parseInt(channelMatch[1], 10)
          };
        }
      } catch {
        // WiFi not available or not connected
      }

      // Get DNS servers
      const dnsScript = `
        Get-DnsClientServerAddress -AddressFamily IPv4 |
        Where-Object { $_.ServerAddresses.Count -gt 0 } |
        Select-Object -First 1 -ExpandProperty ServerAddresses |
        ConvertTo-Json -Compress
      `;

      let primaryDns: string[] = [];
      try {
        const { stdout: dnsOutput } = await execAsync(`powershell -NoProfile -Command "${dnsScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
        const parsed = JSON.parse(dnsOutput.trim());
        primaryDns = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        primaryDns = [];
      }

      return {
        hostname,
        interfaces: interfaces.map((iface: any) => ({
          name: iface.Name || '',
          type: iface.Type || '',
          status: iface.Status || '',
          ipv4: iface.IPv4 || undefined,
          mac: iface.MAC || ''
        })),
        wifi,
        primaryDns
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      throw error;
    }
  }

  async testNetwork(params: { test: 'ping' | 'dns' | 'connectivity'; host?: string; count?: number }): Promise<NetworkTestResult> {
    try {
      switch (params.test) {
        case 'ping': {
          const host = params.host || '8.8.8.8';
          const count = params.count || 4;

          try {
            const { stdout } = await execAsync(`ping -n ${count} ${host}`);

            // Parse ping results
            const sentMatch = stdout.match(/Sent = (\d+)/);
            const receivedMatch = stdout.match(/Received = (\d+)/);
            const lostMatch = stdout.match(/Lost = (\d+)/);
            const avgTimeMatch = stdout.match(/Average = (\d+)ms/);

            const sent = sentMatch ? parseInt(sentMatch[1], 10) : count;
            const received = receivedMatch ? parseInt(receivedMatch[1], 10) : 0;
            const lost = lostMatch ? parseInt(lostMatch[1], 10) : sent;
            const avgTime = avgTimeMatch ? parseInt(avgTimeMatch[1], 10) : null;

            return {
              test: 'ping',
              success: received > 0,
              details: {
                host,
                sent,
                received,
                lost,
                packetLoss: lost > 0 ? `${Math.round((lost / sent) * 100)}%` : '0%',
                averageTime: avgTime ? `${avgTime}ms` : 'N/A'
              }
            };
          } catch (error) {
            return {
              test: 'ping',
              success: false,
              details: {
                host,
                error: 'Ping failed - host unreachable'
              }
            };
          }
        }

        case 'dns': {
          const host = params.host || 'google.com';

          try {
            const script = `Resolve-DnsName -Name ${host} -Type A -ErrorAction Stop | Select-Object -First 1 -Property Name, IPAddress | ConvertTo-Json -Compress`;
            const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);

            const result = JSON.parse(stdout.trim());

            return {
              test: 'dns',
              success: true,
              details: {
                host,
                resolved: result.Name || host,
                ip: result.IPAddress || 'N/A'
              }
            };
          } catch (error) {
            return {
              test: 'dns',
              success: false,
              details: {
                host,
                error: 'DNS resolution failed'
              }
            };
          }
        }

        case 'connectivity': {
          const host = params.host || 'www.google.com';

          try {
            const script = `Test-NetConnection -ComputerName ${host} -Port 80 -InformationLevel Quiet`;
            const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);

            const success = stdout.trim().toLowerCase() === 'true';

            return {
              test: 'connectivity',
              success,
              details: {
                host,
                port: 80,
                message: success ? 'Connection successful' : 'Connection failed'
              }
            };
          } catch (error) {
            return {
              test: 'connectivity',
              success: false,
              details: {
                host,
                error: 'Connectivity test failed'
              }
            };
          }
        }

        default:
          throw new Error(`Unknown test type: ${params.test}`);
      }
    } catch (error) {
      console.error('Error testing network:', error);
      throw error;
    }
  }
}
