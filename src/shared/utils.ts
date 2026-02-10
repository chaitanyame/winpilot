// Shared utility functions

import type { Bounds, WindowInfo, FileInfo } from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date to relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Check if a path is protected
 */
export function isProtectedPath(path: string, protectedPaths: string[]): boolean {
  const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
  return protectedPaths.some(pp => 
    normalizedPath.startsWith(pp.toLowerCase().replace(/\\/g, '/'))
  );
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if bounds overlap
 */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Calculate center of bounds
 */
export function getBoundsCenter(bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Parse natural language file size (e.g., "10 MB" -> bytes)
 */
export function parseFileSize(sizeStr: string): number | null {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(bytes?|kb|mb|gb|tb)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'bytes').toLowerCase();

  const multipliers: Record<string, number> = {
    'byte': 1,
    'bytes': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
    'tb': 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Group files by extension
 */
export function groupFilesByExtension(files: FileInfo[]): Record<string, FileInfo[]> {
  return files.reduce((acc, file) => {
    const ext = file.extension || 'other';
    if (!acc[ext]) acc[ext] = [];
    acc[ext].push(file);
    return acc;
  }, {} as Record<string, FileInfo[]>);
}

/**
 * Sort windows for arrangement
 */
export function sortWindowsForArrangement(windows: WindowInfo[]): WindowInfo[] {
  return [...windows].sort((a, b) => {
    // Sort by focus status first, then by position
    if (a.isFocused !== b.isFocused) return a.isFocused ? -1 : 1;
    if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
    return a.bounds.y - b.bounds.y;
  });
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
