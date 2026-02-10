/**
 * Invisiwind Binary Path Resolution
 *
 * Locates the Invisiwind executable and payload DLLs in both development
 * and production environments.
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface InvisiwindPaths {
  baseDir: string | null;
  executablePath: string | null;
  dll64Path: string | null;
  dll32Path: string | null;
  available: boolean;
  missing: string[];
}

export function getInvisiwindPaths(): InvisiwindPaths {
  const isPackaged = app?.isPackaged ?? false;
  const projectRoot = path.resolve(__dirname, '..', '..');
  const resourcesRoot = isPackaged ? process.resourcesPath : path.join(projectRoot, 'resources');
  const baseDir = path.join(resourcesRoot, 'invisiwind');

  const executablePath = path.join(baseDir, 'Invisiwind.exe');
  const dll64Path = path.join(baseDir, 'utils.dll');
  const dll32Path = path.join(baseDir, 'utils32.dll');

  const missing: string[] = [];
  if (!fs.existsSync(executablePath)) missing.push('Invisiwind.exe');
  if (!fs.existsSync(dll64Path)) missing.push('utils.dll');
  if (!fs.existsSync(dll32Path)) missing.push('utils32.dll');

  return {
    baseDir,
    executablePath: fs.existsSync(executablePath) ? executablePath : null,
    dll64Path: fs.existsSync(dll64Path) ? dll64Path : null,
    dll32Path: fs.existsSync(dll32Path) ? dll32Path : null,
    available: missing.length === 0,
    missing,
  };
}
