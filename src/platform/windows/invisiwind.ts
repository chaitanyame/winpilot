import { execFile } from 'child_process';
import { promisify } from 'util';
import { getInvisiwindPaths } from '../../utils/invisiwind-path';
import { logger } from '../../utils/logger';

const execFileAsync = promisify(execFile);

export interface InvisiwindResult {
  success: boolean;
  error?: string;
}

export class InvisiwindWrapper {
  async hideWindowsByPid(pid: number): Promise<InvisiwindResult> {
    return this.runInvisiwind(['--hide', String(pid)]);
  }

  async unhideWindowsByPid(pid: number): Promise<InvisiwindResult> {
    return this.runInvisiwind(['--unhide', String(pid)]);
  }

  isAvailable(): { available: boolean; missing: string[] } {
    const paths = getInvisiwindPaths();
    return { available: paths.available, missing: paths.missing };
  }

  private async runInvisiwind(args: string[]): Promise<InvisiwindResult> {
    const paths = getInvisiwindPaths();
    if (!paths.available || !paths.executablePath) {
      return {
        success: false,
        error: `Invisiwind binaries not found. Missing: ${paths.missing.join(', ')}`,
      };
    }

    try {
      await execFileAsync(paths.executablePath, args, {
        cwd: paths.baseDir ?? undefined,
        windowsHide: true,
      });
      return { success: true };
    } catch (error) {
      logger.error('Invisiwind', 'Failed to run Invisiwind', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
