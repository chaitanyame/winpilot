/**
 * Whisper.cpp Path Resolution
 *
 * Handles locating the Whisper.cpp binary and model in both development and production environments.
 * In development, looks in resources/whisper/
 * In production, looks in the app's extraResources directory
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface WhisperPaths {
  binaryPath: string | null;
  modelPath: string | null;
  available: boolean;
}

/**
 * Locate bundled Whisper.cpp binary and model (if present).
 */
export function getBundledWhisperPaths(): WhisperPaths {
  const { binaryPaths, modelPaths } = getWhisperSearchPaths();

  const binaryPath = binaryPaths.find(p => fs.existsSync(p)) || null;
  const modelPath = modelPaths.find(p => fs.existsSync(p)) || null;

  return {
    binaryPath,
    modelPath,
    available: Boolean(binaryPath && modelPath),
  };
}

function getWhisperSearchPaths(): { binaryPaths: string[]; modelPaths: string[] } {
  const isPackaged = app?.isPackaged ?? false;
  const projectRoot = path.resolve(__dirname, '..', '..');
  const resourcesRoot = isPackaged ? process.resourcesPath : path.join(projectRoot, 'resources');

  const binaryNames = process.platform === 'win32' ? ['main.exe', 'whisper.exe'] : ['main', 'whisper'];

  const binaryPaths = binaryNames.map(name => path.join(resourcesRoot, 'whisper', 'bin', name));
  const modelPaths = [
    path.join(resourcesRoot, 'whisper', 'models', 'ggml-base.en.bin'),
  ];

  return { binaryPaths, modelPaths };
}
