// Windows Process Management Implementation

import { exec } from 'child_process';
import { promisify } from 'util';
import { IProcess } from '../index';
import { ProcessInfo } from '../../shared/types';

const execAsync = promisify(exec);

export class WindowsProcess implements IProcess {

  async listProcesses(params?: { sortBy?: 'cpu' | 'memory' | 'name'; limit?: number }): Promise<ProcessInfo[]> {
    try {
      const sortBy = params?.sortBy || 'memory';
      const limit = params?.limit || 50;

      const sortProperty = sortBy === 'cpu' ? 'CPU' : sortBy === 'memory' ? 'WorkingSet64' : 'ProcessName';
      
      // Use semicolons in hashtable for single-line compatibility
      const script = `
        Get-Process | 
        Select-Object -Property Id, ProcessName, CPU, WorkingSet64, Responding |
        Sort-Object -Property ${sortProperty} -Descending |
        Select-Object -First ${limit} |
        ForEach-Object {
          @{ pid = $_.Id; name = $_.ProcessName; cpu = [math]::Round($_.CPU, 2); memory = [math]::Round($_.WorkingSet64 / 1MB, 2); status = if($_.Responding) { "running" } else { "stopped" } }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        maxBuffer: 10 * 1024 * 1024,
      });

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

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
      
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
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${params.pid} ${forceFlag} -ErrorAction SilentlyContinue"`);
      } else if (params.name) {
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Name '${params.name}' ${forceFlag} -ErrorAction SilentlyContinue"`);
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

      // Use semicolons in hashtable for single-line compatibility
      const script = `
        Get-Process | 
        Where-Object { $_.${sortProperty} -gt 0 } |
        Sort-Object -Property ${sortProperty} -Descending |
        Select-Object -First ${limit} |
        ForEach-Object {
          @{ pid = $_.Id; name = $_.ProcessName; cpu = [math]::Round($_.CPU, 2); memory = [math]::Round($_.WorkingSet64 / 1MB, 2); status = if($_.Responding) { "running" } else { "stopped" } }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);

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
