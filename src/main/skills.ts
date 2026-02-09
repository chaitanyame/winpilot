import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger';

export interface SkillDirectoryPaths {
  builtIn: string;
  user: string;
  userPaths: string[];
}

function resolveBuiltInSkillsPath(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'resources', 'skills');
  }
  return path.join(process.cwd(), 'resources', 'skills');
}

function ensureDirectoryExists(label: string, directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    logger.copilot('Created skills directory', { label, directory });
  }
}

export function ensureSkillDirectories(): SkillDirectoryPaths {
  const builtIn = resolveBuiltInSkillsPath();
  const user = path.join(os.homedir(), '.claude', 'skills');
  const agents = path.join(os.homedir(), '.agents', 'skills');
  const localAgents = path.join(process.cwd(), '.agents', 'skills');

  if (!app.isPackaged) {
    ensureDirectoryExists('builtin', builtIn);
  } else if (!fs.existsSync(builtIn)) {
    logger.warn('Skills', 'Built-in skills directory missing', { builtIn });
  }

  ensureDirectoryExists('user', user);
  ensureDirectoryExists('agents', agents);

  const userPaths = [user, agents];
  if (!app.isPackaged && fs.existsSync(localAgents)) {
    userPaths.push(localAgents);
  }

  return { builtIn, user, userPaths };
}
