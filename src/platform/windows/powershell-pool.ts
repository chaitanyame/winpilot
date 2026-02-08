/**
 * Persistent PowerShell Session Pool
 *
 * Eliminates the ~400ms overhead of spawning a new powershell.exe per command.
 * Maintains a single persistent PowerShell process, pipes commands via stdin
 * with GUID delimiters, and parses stdout between markers.
 */

import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

interface PendingCommand {
  resolve: (value: { stdout: string; stderr: string }) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  stdout: string;
  stderr: string;
}

const MARKER_PREFIX = '<<<PSPOOL';
const beginMarker = (id: string) => `${MARKER_PREFIX}_BEGIN:${id}>>>`;
const endMarker = (id: string) => `${MARKER_PREFIX}_END:${id}>>>`;
const errMarker = (id: string) => `${MARKER_PREFIX}_ERR:${id}>>>`;

class PowerShellPool {
  private process: ChildProcess | null = null;
  private pending: Map<string, PendingCommand> = new Map();
  private buffer = '';
  private startPromise: Promise<void> | null = null;
  private alive = false;

  private async ensureProcess(): Promise<void> {
    if (this.process && this.alive) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.spawnProcess();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private spawnProcess(): Promise<void> {
    return new Promise((resolve) => {
      this.buffer = '';
      this.alive = false;

      const proc = spawn('powershell.exe', [
        '-NoProfile', '-NoLogo', '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', '-',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.process = proc;

      proc.stdout!.setEncoding('utf8');
      proc.stderr!.setEncoding('utf8');

      proc.stdout!.on('data', (data: string) => {
        this.buffer += data;
        this.drainBuffer();
      });

      proc.stderr!.on('data', (data: string) => {
        // Route stderr to the most recent pending command
        this.pending.forEach((cmd) => {
          cmd.stderr += data;
        });
      });

      proc.on('exit', (code) => {
        logger.platform('PowerShell pool process exited', { code });
        this.alive = false;
        this.rejectAllPending(new Error(`PowerShell process exited with code ${code}`));
        this.process = null;
      });

      proc.on('error', (err) => {
        logger.error('platform', 'PowerShell pool process error', err);
        this.alive = false;
        this.rejectAllPending(err instanceof Error ? err : new Error(String(err)));
        this.process = null;
      });

      // Initialize encoding and verify process is responsive
      const readyId = randomUUID();
      const readyTag = `PSPOOL_READY:${readyId}`;

      const initScript = [
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        `Write-Host '${readyTag}'`,
      ].join('\n');

      const onReady = (chunk: string) => {
        if (chunk.includes(readyTag)) {
          proc.stdout!.removeListener('data', onReady);
          this.alive = true;
          // Clear the init output from the buffer
          const idx = this.buffer.indexOf(readyTag);
          if (idx !== -1) {
            this.buffer = this.buffer.substring(idx + readyTag.length).replace(/^\r?\n/, '');
          }
          logger.platform('PowerShell pool ready');
          resolve();
        }
      };
      proc.stdout!.on('data', onReady);

      proc.stdin!.write(initScript + '\n');

      // Startup timeout
      setTimeout(() => {
        proc.stdout!.removeListener('data', onReady);
        if (!this.alive) {
          this.alive = true; // proceed anyway
          logger.platform('PowerShell pool startup timed out, proceeding');
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Execute a PowerShell script in the persistent session.
   * Drop-in replacement for: execAsync(`powershell -NoProfile -Command "..."`)
   * Just pass the raw script — no escaping or wrapping needed.
   */
  async exec(script: string, options?: { timeout?: number }): Promise<{ stdout: string; stderr: string }> {
    await this.ensureProcess();

    const id = randomUUID();
    const timeout = options?.timeout ?? 30000;
    const begin = beginMarker(id);
    const end = endMarker(id);
    const err = errMarker(id);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`PowerShell command timed out after ${timeout}ms`));
      }, timeout);

      this.pending.set(id, { resolve, reject, timer, stdout: '', stderr: '' });

      // Wrap script with markers and error isolation
      const wrapped = [
        `Write-Host '${begin}'`,
        'try {',
        script,
        '} catch {',
        `  Write-Host '${err}'`,
        '  Write-Host $_.Exception.Message',
        '}',
        `Write-Host '${end}'`,
      ].join('\n');

      this.process!.stdin!.write(wrapped + '\n');
    });
  }

  /**
   * Parse completed command outputs from the buffer.
   * Extracts content between BEGIN and END markers.
   */
  private drainBuffer(): void {
    // Snapshot keys to allow mutation during iteration
    const ids = Array.from(this.pending.keys());
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const cmd = this.pending.get(id);
      if (!cmd) continue;

      const begin = beginMarker(id);
      const end = endMarker(id);
      const err = errMarker(id);

      const beginIdx = this.buffer.indexOf(begin);
      const endIdx = this.buffer.indexOf(end);

      if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
        continue;
      }

      // Extract output between markers
      const contentStart = beginIdx + begin.length;
      let content = this.buffer.substring(contentStart, endIdx);

      // Trim leading/trailing newlines from content
      content = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');

      // Remove processed content from buffer
      this.buffer = this.buffer.substring(endIdx + end.length).replace(/^\r?\n/, '');

      clearTimeout(cmd.timer);
      this.pending.delete(id);

      // Check for error marker in output
      const errIdx = content.indexOf(err);
      if (errIdx !== -1) {
        const errorMsg = content.substring(errIdx + err.length).trim();
        const stdout = content.substring(0, errIdx).replace(/\r?\n$/, '');
        const error = new Error(errorMsg || 'PowerShell command failed');
        (error as any).stderr = cmd.stderr + '\n' + errorMsg;
        (error as any).stdout = stdout;
        cmd.reject(error);
      } else {
        cmd.resolve({ stdout: content, stderr: cmd.stderr });
      }
    }
  }

  private rejectAllPending(error: Error): void {
    this.pending.forEach((cmd) => {
      clearTimeout(cmd.timer);
      cmd.reject(error);
    });
    this.pending.clear();
  }

  /** Gracefully shut down the persistent PowerShell process. */
  destroy(): void {
    if (this.process) {
      try {
        this.process.stdin!.write('exit\n');
        this.process.stdin!.end();
      } catch {
        // stdin may already be closed
      }
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill();
        }
      }, 1000);
    }
    this.rejectAllPending(new Error('PowerShell pool destroyed'));
    this.alive = false;
    this.process = null;
  }

  /** Check if the pool has a live process. */
  isAlive(): boolean {
    return this.alive && this.process !== null;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let poolInstance: PowerShellPool | null = null;

export function getPowerShellPool(): PowerShellPool {
  if (!poolInstance) {
    poolInstance = new PowerShellPool();
  }
  return poolInstance;
}

export function destroyPowerShellPool(): void {
  if (poolInstance) {
    poolInstance.destroy();
    poolInstance = null;
  }
}

/**
 * Convenience function: drop-in replacement for execAsync(`powershell -NoProfile -Command "..."`)
 * Just pass the raw PowerShell script — no escaping or wrapping needed.
 *
 * @example
 * // Before:
 * const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
 *
 * // After:
 * const { stdout } = await runPowerShell(script);
 */
export async function runPowerShell(
  script: string,
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  return getPowerShellPool().exec(script, options);
}
