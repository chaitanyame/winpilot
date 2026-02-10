/**
 * FFmpeg Binary Path Resolution
 *
 * Handles locating the FFmpeg binary in both development and production environments.
 * In development, looks for FFmpeg in resources/ffmpeg/windows/
 * In production, looks in the app's extraResources directory
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

interface FFmpegValidation {
  available: boolean;
  path: string | null;
  error?: string;
}

let cachedPath: string | null = null;
let cacheValidated = false;

/**
 * Get the path to the FFmpeg binary
 * Returns null if FFmpeg is not found
 */
export function getFFmpegPath(): string | null {
  if (cacheValidated) {
    return cachedPath;
  }

  const possiblePaths = getFFmpegSearchPaths();

  for (const ffmpegPath of possiblePaths) {
    if (fs.existsSync(ffmpegPath)) {
      cachedPath = ffmpegPath;
      cacheValidated = true;
      return cachedPath;
    }
  }

  cacheValidated = true;
  cachedPath = null;
  return null;
}

/**
 * Get all possible FFmpeg paths to search
 */
function getFFmpegSearchPaths(): string[] {
  const paths: string[] = [];
  const isPackaged = app?.isPackaged ?? false;
  const platform = process.platform;

  // Get the binary name based on platform
  const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  if (isPackaged) {
    // Production: Look in extraResources
    const resourcesPath = process.resourcesPath;
    paths.push(path.join(resourcesPath, 'ffmpeg', binaryName));
    paths.push(path.join(resourcesPath, 'ffmpeg', platform, binaryName));
  } else {
    // Development: Look in project resources directory
    const projectRoot = path.resolve(__dirname, '..', '..');
    const platformFolder = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux';

    paths.push(path.join(projectRoot, 'resources', 'ffmpeg', platformFolder, binaryName));
    paths.push(path.join(projectRoot, 'resources', 'ffmpeg', binaryName));
  }

  // Also check if FFmpeg is in system PATH
  if (platform === 'win32') {
    // Check common Windows installation paths
    paths.push('C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe');
    paths.push('C:\\ffmpeg\\bin\\ffmpeg.exe');
  } else {
    // Check common Unix paths
    paths.push('/usr/bin/ffmpeg');
    paths.push('/usr/local/bin/ffmpeg');
    paths.push('/opt/homebrew/bin/ffmpeg');
  }

  return paths;
}

/**
 * Validate FFmpeg installation
 * Returns validation result with path if available
 */
export function validateFFmpeg(): FFmpegValidation {
  const ffmpegPath = getFFmpegPath();

  if (!ffmpegPath) {
    return {
      available: false,
      path: null,
      error: 'FFmpeg binary not found. Please install FFmpeg or place it in resources/ffmpeg/'
    };
  }

  try {
    // Check if file exists and is accessible
    fs.accessSync(ffmpegPath, fs.constants.X_OK);
    return {
      available: true,
      path: ffmpegPath
    };
  } catch (error) {
    return {
      available: false,
      path: ffmpegPath,
      error: `FFmpeg found but not executable: ${ffmpegPath}`
    };
  }
}

/**
 * Reset the cached path (useful for testing)
 */
export function resetFFmpegCache(): void {
  cachedPath = null;
  cacheValidated = false;
}

/**
 * Check if FFmpeg is available (quick check)
 */
export function isFFmpegAvailable(): boolean {
  return getFFmpegPath() !== null;
}
