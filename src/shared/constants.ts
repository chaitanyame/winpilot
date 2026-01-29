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
    model: 'claude-sonnet-4.5' as const, // Best for agentic loops - excellent reasoning & tool use
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
