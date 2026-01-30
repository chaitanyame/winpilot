// Application constants

export const APP_NAME = 'Desktop Commander';
export const APP_VERSION = '0.1.0';

// Default hotkey for command palette
export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space';

// Window dimensions
export const COMMAND_PALETTE_WIDTH = 600;
export const COMMAND_PALETTE_HEIGHT = 500;
export const COMMAND_PALETTE_MIN_HEIGHT = 120;

// Tray icon states
export const TRAY_ICON_IDLE = 'icon-idle';
export const TRAY_ICON_ACTIVE = 'icon-active';
export const TRAY_ICON_ERROR = 'icon-error';

import { PermissionLevel } from './types';

// Default settings
export const DEFAULT_SETTINGS = {
  hotkey: DEFAULT_HOTKEY,
  theme: 'system' as const,
  permissions: {
    defaultLevel: PermissionLevel.STANDARD,
    rememberChoices: true,
    requireConfirmFor: ['files.delete', 'process.kill', 'system.sleep', 'system.lock'],
  },
  tools: {
    enabled: ['window', 'files', 'apps', 'system', 'process', 'clipboard'],
    disabled: [],
  },
  ui: {
    showInTray: true,
    floatingWindow: true,
    toastNotifications: true,
    menuBarMode: false,
  },
  safety: {
    maxFilesPerOperation: 100,
    protectedPaths: ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'],
    requireConfirmAbove: 10,
  },
  agenticLoop: {
    enabled: true,
    maxIterations: 10,
    maxTotalTimeMinutes: 15,
    iterationTimeoutSeconds: 120,
    model: 'gpt-5' as const, // Base GPT-5 model - fast and capable
  },
  notifications: {
    enabled: true,
    useNative: true,
    useToast: true,
    toastDuration: 5000,
    sound: true,
  },
  scheduledTasks: {
    enabled: true,
    maxConcurrent: 3,
  },
  voiceInput: {
    enabled: false,
    hotkey: 'CommandOrControl+Shift+V',
    provider: 'browser' as const,
    whisperCpp: {
      binaryPath: '',
      modelPath: '',
    },
    language: 'en-US',
    showVisualFeedback: true,
  },
};

// Protected paths that cannot be modified
export const SYSTEM_PROTECTED_PATHS = {
  windows: [
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\$Recycle.Bin',
  ],
  macos: [
    '/System',
    '/Library',
    '/usr',
    '/bin',
    '/sbin',
  ],
  linux: [
    '/bin',
    '/sbin',
    '/usr',
    '/lib',
    '/lib64',
    '/boot',
    '/etc',
  ],
};

// Window arrangement layouts
export const WINDOW_LAYOUTS = {
  'left-half': { x: 0, y: 0, widthFraction: 0.5, heightFraction: 1 },
  'right-half': { x: 0.5, y: 0, widthFraction: 0.5, heightFraction: 1 },
  'top-half': { x: 0, y: 0, widthFraction: 1, heightFraction: 0.5 },
  'bottom-half': { x: 0, y: 0.5, widthFraction: 1, heightFraction: 0.5 },
  'top-left': { x: 0, y: 0, widthFraction: 0.5, heightFraction: 0.5 },
  'top-right': { x: 0.5, y: 0, widthFraction: 0.5, heightFraction: 0.5 },
  'bottom-left': { x: 0, y: 0.5, widthFraction: 0.5, heightFraction: 0.5 },
  'bottom-right': { x: 0.5, y: 0.5, widthFraction: 0.5, heightFraction: 0.5 },
  'maximize': { x: 0, y: 0, widthFraction: 1, heightFraction: 1 },
};

// Default MCP Servers
// These are pre-configured popular MCP servers that users can enable
import { StoredMCPServer } from './mcp-types';

// Helper to get user's home directory path
const getHomePath = (): string => {
  if (typeof process !== 'undefined') {
    return process.env.HOME || process.env.USERPROFILE || process.cwd();
  }
  return '';
};

export const DEFAULT_MCP_SERVERS: StoredMCPServer[] = [
  {
    id: 'mcp-default-filesystem',
    config: {
      name: 'File System Access',
      type: 'local' as const,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', getHomePath()],
      tools: '*',
      enabled: false,
      description: 'Read and write files on your computer. No setup required.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'mcp-default-memory',
    config: {
      name: 'Memory Storage',
      type: 'local' as const,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      tools: '*',
      enabled: false,
      description: 'Store and recall information across sessions. Perfect for taking notes.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'mcp-default-puppeteer',
    config: {
      name: 'Browser Automation',
      type: 'local' as const,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      tools: '*',
      enabled: false,
      description: 'Automate web browsers, take screenshots, and scrape websites.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'mcp-default-fetch',
    config: {
      name: 'HTTP Requests',
      type: 'local' as const,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      tools: '*',
      enabled: false,
      description: 'Make HTTP requests and fetch web content. No API key needed.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'mcp-default-windows-mcp',
    config: {
      name: 'Windows Automation (UI)',
      type: 'local' as const,
      command: 'uvx',
      args: ['windows-mcp'],
      tools: '*',
      enabled: true,
      description: 'Direct Windows UI automation: click, type, scroll, drag, screenshots, shell commands. Requires Python 3.13+ and uv.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];
