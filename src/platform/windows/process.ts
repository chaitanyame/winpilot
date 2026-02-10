// Windows Process Management Implementation

import { IProcess } from '../index';
import { ProcessInfo } from '../../shared/types';
import { runPowerShell } from './powershell-pool';

export class WindowsProcess implements IProcess {

  async listProcesses(params?: { sortBy?: 'cpu' | 'memory' | 'name'; limit?: number }): Promise<ProcessInfo[]> {
    try {
      const sortBy = params?.sortBy || 'memory';
      const limit = params?.limit || 50;

      const sortProperty = sortBy === 'cpu' ? 'CPU' : sortBy === 'memory' ? 'WS' : 'ProcessName';
      
      // Optimized: Limit to 200 initially (faster), use WS alias, 60s timeout for heavy systems
      const script = `
        Get-Process -ErrorAction SilentlyContinue | 
        Select-Object -First 200 -Property Id, ProcessName, CPU, WS |
        Sort-Object -Property ${sortProperty} -Descending |
        Select-Object -First ${limit} |
        ForEach-Object {
          @{ pid = $_.Id; name = $_.ProcessName; cpu = if($_.CPU){[math]::Round($_.CPU, 2)}else{0}; memory = [math]::Round($_.WS / 1MB, 2); status = "running" }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await runPowerShell(script, { timeout: 60000 });

      if (!stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const processes = Array.isArray(parsed) ? parsed : [parsed];

      return processes.map((p: any) => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu || 0,
        memory: p.memory || 0,
        status: p.status,
      }));
    } catch (error) {
      console.error('Error listing processes:', error);
      return [];
    }
  }

  async getProcessInfo(params: { pid?: number; name?: string }): Promise<ProcessInfo | null> {
    try {
      let script: string;

      if (params.pid) {
        script = `
          $proc = Get-Process -Id ${params.pid} -ErrorAction SilentlyContinue
          if ($proc) {
            @{ pid = $proc.Id; name = $proc.ProcessName; cpu = [math]::Round($proc.CPU, 2); memory = [math]::Round($proc.WorkingSet64 / 1MB, 2); status = if($proc.Responding) { "running" } else { "stopped" } } | ConvertTo-Json -Compress
          }
        `;
      } else if (params.name) {
        script = `
          $proc = Get-Process -Name "${params.name}" -ErrorAction SilentlyContinue | Select-Object -First 1
          if ($proc) {
            @{ pid = $proc.Id; name = $proc.ProcessName; cpu = [math]::Round($proc.CPU, 2); memory = [math]::Round($proc.WorkingSet64 / 1MB, 2); status = if($proc.Responding) { "running" } else { "stopped" } } | ConvertTo-Json -Compress
          }
        `;
      } else {
        return null;
      }

      const { stdout } = await runPowerShell(script, { timeout: 15000 });
      
      if (!stdout.trim()) return null;

      const p = JSON.parse(stdout);
      return {
        pid: p.pid,
        name: p.name,
        cpu: p.cpu || 0,
        memory: p.memory || 0,
        status: p.status,
      };
    } catch (error) {
      console.error('Error getting process info:', error);
      return null;
    }
  }

  async killProcess(params: { pid?: number; name?: string; force?: boolean }): Promise<boolean> {
    try {
      const forceFlag = params.force ? '-Force' : '';

      if (params.pid) {
        await runPowerShell(`Stop-Process -Id ${params.pid} ${forceFlag} -ErrorAction SilentlyContinue`);
      } else if (params.name) {
        await runPowerShell(`Stop-Process -Name '${params.name}' ${forceFlag} -ErrorAction SilentlyContinue`);
      } else {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error killing process:', error);
      return false;
    }
  }

  async getTopProcesses(params: { resource: 'cpu' | 'memory'; limit?: number }): Promise<ProcessInfo[]> {
    try {
      const limit = params.limit || 10;
      const sortProperty = params.resource === 'cpu' ? 'CPU' : 'WorkingSet64';

      // Optimized: limit initial buffer, 45s timeout
      const script = `
        Get-Process -ErrorAction SilentlyContinue | 
        Where-Object { $_.${sortProperty} -gt 0 } |
        Sort-Object -Property ${sortProperty} -Descending |
        Select-Object -First ${limit} |
        ForEach-Object {
          @{ pid = $_.Id; name = $_.ProcessName; cpu = [math]::Round($_.CPU, 2); memory = [math]::Round($_.WorkingSet64 / 1MB, 2); status = "running" }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await runPowerShell(script, { timeout: 45000 });

      if (!stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const processes = Array.isArray(parsed) ? parsed : [parsed];

      return processes.map((p: any) => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu || 0,
        memory: p.memory || 0,
        status: p.status,
      }));
    } catch (error) {
      console.error('Error getting top processes:', error);
      return [];
    }
  }
}
