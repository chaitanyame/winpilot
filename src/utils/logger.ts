// File-based logger for debugging
// Logs are written to: logs/debug.log

import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'debug.log');
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLogLevel = (process.env.DESKTOP_COMMANDER_LOG_LEVEL || '').toLowerCase() as LogLevel;
const DEFAULT_LOG_LEVEL: LogLevel = LOG_LEVELS[envLogLevel] ? envLogLevel : (
  process.env.NODE_ENV === 'production' ? 'warn' : 'info'
);
const LOG_CONSOLE = (process.env.DESKTOP_COMMANDER_LOG_CONSOLE || '').toLowerCase() === '1'
  || (process.env.NODE_ENV !== 'production');

let logStream: fs.WriteStream | null = null;
let writeQueue: string[] = [];
let flushing = false;

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create log directory:', e);
}

// Clear log file on startup (async to avoid blocking)
fs.promises.writeFile(
  LOG_FILE,
  `=== Desktop Commander Log Started: ${new Date().toISOString()} ===\n`
).catch((e) => {
  console.error('Failed to initialize log file:', e);
});

function ensureLogStream(): fs.WriteStream | null {
  if (logStream) return logStream;
  try {
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a', encoding: 'utf8' });
    logStream.on('error', (err) => {
      console.error('Failed to write to log file:', err);
      logStream = null;
    });
  } catch (e) {
    console.error('Failed to create log stream:', e);
    logStream = null;
  }
  return logStream;
}

function enqueueWrite(line: string): void {
  if (!ensureLogStream()) return;
  writeQueue.push(line);
  if (!flushing) {
    flushing = true;
    setImmediate(flushQueue);
  }
}

function flushQueue(): void {
  if (!logStream) {
    flushing = false;
    return;
  }
  const batch = writeQueue.join('');
  writeQueue = [];
  logStream.write(batch, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
    flushing = false;
    if (writeQueue.length > 0) {
      setImmediate(flushQueue);
    }
  });
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[DEFAULT_LOG_LEVEL];
}

/**
 * Write a log entry to the debug log file
 */
export function log(category: string, message: string, data?: unknown): void {
  logWithLevel('info', category, message, data);
}

export function logWithLevel(level: LogLevel, category: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
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
  
  // Write to file (async, buffered)
  enqueueWrite(logLine);
  
  // Also log to console (optional)
  if (LOG_CONSOLE) {
    const trimmed = logLine.trim();
    if (level === 'error') {
      console.error(trimmed);
    } else if (level === 'warn') {
      console.warn(trimmed);
    } else {
      console.log(trimmed);
    }
  }
}

/**
 * Log an error with stack trace
 */
export function logError(category: string, message: string, error: unknown): void {
  const errorMessage = error instanceof Error 
    ? `${error.message}\n  Stack: ${error.stack}` 
    : String(error);
  logWithLevel('error', category, `ERROR: ${message} - ${errorMessage}`);
}

export const logger = {
  copilot: (message: string, data?: unknown) => logWithLevel('info', 'Copilot', message, data),
  tool: (message: string, data?: unknown) => logWithLevel('info', 'Tool', message, data),
  platform: (message: string, data?: unknown) => logWithLevel('info', 'Platform', message, data),
  ipc: (message: string, data?: unknown) => logWithLevel('debug', 'IPC', message, data),
  warn: (category: string, message: string, data?: unknown) => logWithLevel('warn', category, `WARNING: ${message}`, data),
  error: (category: string, message: string, error: unknown) => logError(category, message, error),
};
