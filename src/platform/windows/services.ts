// Windows Services Implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import { IServices } from '../index';
import type { ServiceInfo } from '../../shared/types';

const execAsync = promisify(exec);

export class WindowsServices implements IServices {

  async listServices(params: { filter?: string; nameContains?: string }): Promise<ServiceInfo[]> {
    try {
      // Build PowerShell script to list services
      let filterClause = '';
      if (params.filter === 'running') {
        filterClause = 'Where-Object { $_.Status -eq "Running" } |';
      } else if (params.filter === 'stopped') {
        filterClause = 'Where-Object { $_.Status -eq "Stopped" } |';
      }

      let nameFilter = '';
      if (params.nameContains) {
        nameFilter = `Where-Object { $_.Name -like "*${params.nameContains}*" -or $_.DisplayName -like "*${params.nameContains}*" } |`;
      }

      const script = `
        Get-Service | ${filterClause} ${nameFilter} ForEach-Object {
          $service = $_
          $wmiService = Get-WmiObject Win32_Service -Filter "Name='$($service.Name)'" -ErrorAction SilentlyContinue
          [PSCustomObject]@{
            Name = $service.Name
            DisplayName = $service.DisplayName
            Status = $service.Status.ToString().ToLower()
            StartupType = if ($wmiService) { $wmiService.StartMode.ToLower() } else { 'unknown' }
            Description = if ($wmiService) { $wmiService.Description } else { $null }
          }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);

      let services = [];
      try {
        const parsed = JSON.parse(stdout.trim());
        services = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        services = [];
      }

      return services.map((svc: any) => ({
        name: svc.Name || '',
        displayName: svc.DisplayName || '',
        status: this.normalizeStatus(svc.Status),
        startupType: this.normalizeStartupType(svc.StartupType),
        description: svc.Description || undefined
      }));
    } catch (error) {
      console.error('Error listing services:', error);
      throw error;
    }
  }

  async controlService(params: { service: string; action: 'start' | 'stop' | 'restart' }): Promise<boolean> {
    try {
      let script: string;

      switch (params.action) {
        case 'start':
          script = `Start-Service -Name "${params.service}" -ErrorAction Stop; $?`;
          break;

        case 'stop':
          script = `Stop-Service -Name "${params.service}" -Force -ErrorAction Stop; $?`;
          break;

        case 'restart':
          script = `Restart-Service -Name "${params.service}" -Force -ErrorAction Stop; $?`;
          break;

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);

      // PowerShell returns "True" if successful
      return stdout.trim().toLowerCase() === 'true';
    } catch (error) {
      console.error(`Error ${params.action} service:`, error);
      return false;
    }
  }

  private normalizeStatus(status: string): 'running' | 'stopped' | 'paused' {
    const normalized = status.toLowerCase();
    if (normalized.includes('running') || normalized === 'running') {
      return 'running';
    } else if (normalized.includes('paused') || normalized === 'paused') {
      return 'paused';
    }
    return 'stopped';
  }

  private normalizeStartupType(startupType: string): 'automatic' | 'manual' | 'disabled' {
    const normalized = startupType.toLowerCase();
    if (normalized.includes('auto') || normalized === 'automatic') {
      return 'automatic';
    } else if (normalized === 'disabled' || normalized.includes('disabled')) {
      return 'disabled';
    }
    return 'manual';
  }
}
