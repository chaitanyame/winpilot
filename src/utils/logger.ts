// File-based logger for debugging
// Logs are written to: logs/debug.log

import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create log directory:', e);
}

// Clear log file on startup
try {
  fs.writeFileSync(LOG_FILE, `=== Desktop Commander Log Started: ${new Date().toISOString()} ===\n`);
} catch (e) {
  console.error('Failed to initialize log file:', e);
}

/**
 * Write a log entry to the debug log file
 */
export function log(category: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${category}] ${message}`;
  
  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      // Truncate very long data
      const truncated = dataStr.length > 2000 ? dataStr.substring(0, 2000) + '...(truncated)' : dataStr;
      logLine += `\n  Data: ${truncated}`;
    } catch (e) {
      logLine += `\n  Data: [unable to serialize]`;
    }
  }
  
  logLine += '\n';
  
  // Write to file
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
  
  // Also log to console
  console.log(logLine.trim());
}

/**
 * Log an error with stack trace
 */
export function logError(category: string, message: string, error: unknown): void {
  const errorMessage = error instanceof Error 
    ? `${error.message}\n  Stack: ${error.stack}` 
    : String(error);
  log(category, `ERROR: ${message} - ${errorMessage}`);
}

export const logger = {
  copilot: (message: string, data?: unknown) => log('Copilot', message, data),
  tool: (message: string, data?: unknown) => log('Tool', message, data),
  platform: (message: string, data?: unknown) => log('Platform', message, data),
  ipc: (message: string, data?: unknown) => log('IPC', message, data),
  warn: (category: string, message: string, data?: unknown) => log(category, `WARNING: ${message}`, data),
  error: (category: string, message: string, error: unknown) => logError(category, message, error),
};
