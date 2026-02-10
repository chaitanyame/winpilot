// Path validation utilities to prevent path traversal attacks

import * as path from 'path';
import * as os from 'os';

// Allowed base directories - user's home, temp, and any explicitly configured paths
const DEFAULT_ALLOWED_ROOTS: string[] = [
  os.homedir(),
  os.tmpdir(),
];

// Additional paths can be configured at runtime
let additionalAllowedPaths: string[] = [];

/**
 * Add additional allowed paths at runtime
 */
export function addAllowedPath(allowedPath: string): void {
  const normalized = sanitizePath(allowedPath);
  if (!additionalAllowedPaths.includes(normalized)) {
    additionalAllowedPaths.push(normalized);
  }
}

/**
 * Remove an allowed path
 */
export function removeAllowedPath(allowedPath: string): void {
  const normalized = sanitizePath(allowedPath);
  additionalAllowedPaths = additionalAllowedPaths.filter(p => p !== normalized);
}

/**
 * Get all currently allowed root paths
 */
export function getAllowedPaths(): string[] {
  return [...DEFAULT_ALLOWED_ROOTS, ...additionalAllowedPaths];
}

/**
 * Clear all additional allowed paths (keeps defaults)
 */
export function clearAdditionalAllowedPaths(): void {
  additionalAllowedPaths = [];
}

/**
 * Normalizes and sanitizes a path
 * - Resolves to absolute path
 * - Normalizes separators and removes redundant segments
 * - Lowercases on Windows for consistent comparison
 */
export function sanitizePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid path: path must be a non-empty string');
  }

  // Resolve to absolute path (this also normalizes separators)
  const absolutePath = path.resolve(inputPath);
  
  // On Windows, lowercase for consistent comparison
  if (process.platform === 'win32') {
    return absolutePath.toLowerCase();
  }
  
  return absolutePath;
}

/**
 * Checks if a path contains path traversal attempts
 */
function containsTraversal(inputPath: string): boolean {
  // Check for '..' segments in the original input
  const segments = inputPath.split(/[/\\]/);
  return segments.some(segment => segment === '..');
}

/**
 * Checks if the resolved path is under one of the allowed directories
 */
function isUnderAllowedRoot(resolvedPath: string): boolean {
  const allAllowed = getAllowedPaths();
  const normalizedPath = process.platform === 'win32' 
    ? resolvedPath.toLowerCase() 
    : resolvedPath;
  
  return allAllowed.some(allowedRoot => {
    const normalizedRoot = process.platform === 'win32' 
      ? allowedRoot.toLowerCase() 
      : allowedRoot;
    
    // Check if path starts with allowed root (with proper separator handling)
    if (normalizedPath === normalizedRoot) {
      return true;
    }
    
    // Ensure we match complete directory segments
    const rootWithSep = normalizedRoot.endsWith(path.sep) 
      ? normalizedRoot 
      : normalizedRoot + path.sep;
    
    return normalizedPath.startsWith(rootWithSep);
  });
}

/**
 * Validates if a path is allowed for file operations
 * 
 * @param inputPath - The path to validate
 * @returns true if the path is allowed, false otherwise
 */
export function isPathAllowed(inputPath: string): boolean {
  try {
    // Reject empty or invalid input
    if (!inputPath || typeof inputPath !== 'string') {
      return false;
    }

    // Reject paths with explicit traversal attempts
    if (containsTraversal(inputPath)) {
      return false;
    }

    // Resolve to absolute and check if under allowed roots
    const resolvedPath = sanitizePath(inputPath);
    return isUnderAllowedRoot(resolvedPath);
  } catch {
    return false;
  }
}

/**
 * Validates a path and throws an error if not allowed
 * 
 * @param inputPath - The path to validate
 * @param operation - Description of the operation (for error message)
 * @throws Error if path is not allowed
 */
export function assertPathAllowed(inputPath: string, operation: string = 'access'): void {
  if (!isPathAllowed(inputPath)) {
    throw new Error(
      `Path not allowed for ${operation}: "${inputPath}". ` +
      `Paths must be under user home directory or temp directory.`
    );
  }
}

/**
 * Validates multiple paths and throws an error if any is not allowed
 * 
 * @param paths - Array of paths to validate
 * @param operation - Description of the operation (for error message)
 * @throws Error if any path is not allowed
 */
export function assertPathsAllowed(paths: string[], operation: string = 'access'): void {
  for (const p of paths) {
    assertPathAllowed(p, operation);
  }
}
