// Tool Definitions for Copilot using GitHub Copilot SDK

import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import { getUnifiedAdapter } from '../platform/unified-adapter';
import { logger } from '../utils/logger';
import { p } from '../utils/zod-wrapper';
import { requestPermissionForTool } from '../main/permission-gate';
import { findInstalledAppByName } from '../main/app-indexer';
import { showNotification } from '../main/notifications';
import {
  timerManager,
  createTimer,
  createCountdown,
  createPomodoro,
  formatTime
} from '../main/timers';
import {
  formatWorldClock,
  searchCities,
  getAllCities
} from '../main/worldclock';
import {
  reminderManager
} from '../main/reminders';
import { InvisiwindWrapper } from '../platform/windows/invisiwind';
import { screenSharePrivacyService } from '../main/screen-share-privacy';
import {
  recordingManager,
  type RecordingOptions
} from '../main/recording-manager';
import {
  RecordingType,
  AudioSource
} from '../shared/types';
import {
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
  deleteAllNotes,
  searchNotes
} from '../main/notes';
import {
  createTodo,
  listTodos,
  completeTodo,
  deleteTodo
} from '../main/todos';
import { fetchUrl } from '../main/url-fetch';
import { speak, stopSpeaking, listVoices, type TTSOptions } from '../platform/windows/tts';
import { fetchWeather } from '../main/weather';
import { convertUnit } from '../main/unit-converter';
import { WindowsMedia } from '../platform/windows/media';
import { showOSD } from '../main/osd-window';

const adapter = getUnifiedAdapter();
const windowsMedia = new WindowsMedia();
const invisiwind = new InvisiwindWrapper();

// Helper function to parse time strings like "3pm", "15:30", "2:30pm"
function parseTimeString(timeStr: string, dateStr?: string): Date {
  const now = new Date();
  const targetDate = new Date();

  // Handle date
  if (dateStr) {
    const lowerDate = dateStr.toLowerCase();
    if (lowerDate === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (lowerDate === 'today') {
      // Use today
    } else {
      // Try to parse day names
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayIndex = now.getDay();
      const targetDayIndex = days.indexOf(lowerDate);
      if (targetDayIndex !== -1) {
        const daysUntil = (targetDayIndex + 7 - todayIndex) % 7 || 7;
        targetDate.setDate(targetDate.getDate() + daysUntil);
      }
    }
  }

  // Parse time
  const lowerTime = timeStr.toLowerCase().replace(/\s/g, '');
  let hours = 0;
  let minutes = 0;
  let isPm = false;

  // Check for AM/PM
  if (lowerTime.includes('pm') || lowerTime.includes('p.m.')) {
    isPm = true;
  }

  // Extract time part
  const timeMatch = lowerTime.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  } else {
    // Try just hours
    const hourMatch = lowerTime.match(/(\d{1,2})/);
    if (hourMatch) {
      hours = parseInt(hourMatch[1], 10);
    }
  }

  // Handle 12-hour format
  if (isPm && hours !== 12) {
    hours += 12;
  } else if (!isPm && hours === 12) {
    hours = 0;
  }

  // Set the time
  targetDate.setHours(hours, minutes, 0, 0);

  // If the time has passed today, assume tomorrow (unless date was specified)
  if (targetDate.getTime() <= now.getTime() && !dateStr) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

// ============================================================================
// Window Management Tools
// ============================================================================

export const windowListTool = defineTool('window_list', {
  description: 'List all open windows with their titles, applications, positions, and IDs for manipulation',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.listWindows();
    if (!result.success) {
      return `Failed to list windows: ${result.error}`;
    }
    const windows = result.data || [];
    if (windows.length === 0) {
      return 'No windows found';
    }
    // Return structured data including IDs for use by other tools
    return JSON.stringify({
      count: windows.length,
      windows: windows.map(w => ({
        id: w.id,
        title: w.title,
        app: w.app,
        bounds: w.bounds,
        isMinimized: w.isMinimized,
        isMaximized: w.isMaximized,
        isFocused: w.isFocused,
        isHiddenFromCapture: w.isHiddenFromCapture
      }))
    });
  }
});

export const windowFocusTool = defineTool('window_focus', {
  description: 'Focus (bring to front) a specific window by ID, app name, or title',
  parameters: p({
    windowId: z.string().optional().describe('The window ID to focus'),
    appName: z.string().optional().describe('The application name to focus'),
    titleContains: z.string().optional().describe('Part of the window title to match')
  }),
  handler: async ({ windowId, appName, titleContains }) => {
    const result = await adapter.focusWindow({ windowId, appName, titleContains });
    return result.success
      ? `Successfully focused window`
      : `Failed to focus window: ${result.error}`;
  }
});

export const windowResizeTool = defineTool('window_resize', {
  description: 'Resize and/or move a window by ID, title, or app name. Use window_list to get window IDs first.',
  parameters: p({
    windowId: z.string().optional().describe('The window ID (from window_list)'),
    titleContains: z.string().optional().describe('Part of the window title to match'),
    appName: z.string().optional().describe('The application name to match'),
    x: z.number().optional().describe('New X position in pixels'),
    y: z.number().optional().describe('New Y position in pixels'),
    width: z.number().optional().describe('New width in pixels'),
    height: z.number().optional().describe('New height in pixels')
  }),
  handler: async ({ windowId, titleContains, appName, x, y, width, height }) => {
    // If no windowId, find one by title or app
    let targetId = windowId;
    if (!targetId && (titleContains || appName)) {
      const listResult = await adapter.listWindows();
      if (listResult.success && listResult.data) {
        const match = listResult.data.find(w => {
          if (titleContains && w.title.toLowerCase().includes(titleContains.toLowerCase())) return true;
          if (appName && w.app.toLowerCase().includes(appName.toLowerCase())) return true;
          return false;
        });
        if (match) targetId = match.id;
      }
    }
    
    if (!targetId) {
      return 'Could not find a matching window. Please provide windowId, titleContains, or appName.';
    }
    
    const result = await adapter.moveWindow({ windowId: targetId, x, y, width, height });
    return result.success
      ? `Successfully resized/moved window to ${width}x${height} at (${x}, ${y})`
      : `Failed to resize window: ${result.error}`;
  }
});

// Keep backward compatibility with window_move
export const windowMoveTool = defineTool('window_move', {
  description: 'Move and/or resize a window by ID. Prefer window_resize which also supports title/app matching.',
  parameters: p({
    windowId: z.string().describe('The window ID to move'),
    x: z.number().optional().describe('New X position'),
    y: z.number().optional().describe('New Y position'),
    width: z.number().optional().describe('New width'),
    height: z.number().optional().describe('New height')
  }),
  handler: async ({ windowId, x, y, width, height }) => {
    const result = await adapter.moveWindow({ windowId, x, y, width, height });
    return result.success
      ? `Successfully moved/resized window`
      : `Failed to move window: ${result.error}`;
  }
});

export const windowCloseTool = defineTool('window_close', {
  description: 'Close a window by ID or app name',
  parameters: p({
    windowId: z.string().optional().describe('The window ID to close'),
    appName: z.string().optional().describe('The application name to close')
  }),
  handler: async ({ windowId, appName }) => {
    const decision = await requestPermissionForTool('window_close', { windowId, appName }, [
      windowId ? `windowId: ${windowId}` : undefined,
      appName ? `appName: ${appName}` : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.closeWindow({ windowId, appName });
    return result.success
      ? `Successfully closed window`
      : `Failed to close window: ${result.error}`;
  }
});

export const windowMinimizeTool = defineTool('window_minimize', {
  description: 'Minimize a window',
  parameters: p({
    windowId: z.string().describe('The window ID to minimize')
  }),
  handler: async ({ windowId }) => {
    const result = await adapter.minimizeWindow({ windowId });
    return result.success
      ? `Successfully minimized window ${windowId}`
      : `Failed to minimize window: ${result.error}`;
  }
});

export const windowMaximizeTool = defineTool('window_maximize', {
  description: 'Maximize a window',
  parameters: p({
    windowId: z.string().describe('The window ID to maximize')
  }),
  handler: async ({ windowId }) => {
    const result = await adapter.maximizeWindow({ windowId });
    return result.success
      ? `Successfully maximized window ${windowId}`
      : `Failed to maximize window: ${result.error}`;
  }
});

export const windowArrangeTool = defineTool('window_arrange', {
  description: 'Arrange windows in a layout (side-by-side, stacked, grid, left-half, right-half, etc.)',
  parameters: p({
    layout: z.enum(['side-by-side', 'stacked', 'grid', 'left-half', 'right-half', 'top-half', 'bottom-half', 'maximize'])
      .describe('Layout type'),
    windows: z.array(z.string()).optional().describe('Window IDs to arrange (if not specified, uses visible windows)')
  }),
  handler: async ({ layout, windows }) => {
    const result = await adapter.arrangeWindows({ layout, windows });
    return result.success
      ? `Successfully arranged windows in ${layout} layout`
      : `Failed to arrange windows: ${result.error}`;
  }
});

// ============================================================================
// Screen Share Privacy Tools
// ============================================================================

export const windowHideFromSharingTool = defineTool('window_hide_from_sharing', {
  description: 'Hide a window from screen sharing/capture while keeping it visible to you',
  parameters: p({
    windowId: z.string().optional().describe('The window ID to hide'),
    appName: z.string().optional().describe('The application name to hide'),
    titleContains: z.string().optional().describe('Part of the window title to match')
  }),
  handler: async ({ windowId, appName, titleContains }) => {
    const decision = await requestPermissionForTool('window_hide_from_sharing', { windowId, appName, titleContains }, [
      windowId ? `windowId: ${windowId}` : undefined,
      appName ? `appName: ${appName}` : undefined,
      titleContains ? `titleContains: ${titleContains}` : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    const listResult = await adapter.listWindows();
    if (!listResult.success || !listResult.data) {
      return `Failed to list windows: ${listResult.error}`;
    }

    const target = listResult.data.find(w => {
      if (windowId && w.id === windowId) return true;
      if (appName && w.app.toLowerCase().includes(appName.toLowerCase())) return true;
      if (titleContains && w.title.toLowerCase().includes(titleContains.toLowerCase())) return true;
      return false;
    });

    if (!target) {
      return 'Could not find a matching window. Please provide windowId, appName, or titleContains.';
    }

    const availability = invisiwind.isAvailable();
    if (!availability.available) {
      return `Invisiwind binaries are missing: ${availability.missing.join(', ')}`;
    }

    const result = await invisiwind.hideWindowsByPid(target.processId);
    if (!result.success) {
      return `Failed to hide window: ${result.error}`;
    }

    screenSharePrivacyService.addHiddenWindow({
      hwnd: target.id,
      pid: target.processId,
      title: target.title,
      appName: target.app,
      hiddenAt: Date.now(),
    });

    return `Hidden "${target.title}" from screen sharing.`;
  }
});

export const windowShowInSharingTool = defineTool('window_show_in_sharing', {
  description: 'Show a previously hidden window in screen sharing/capture again',
  parameters: p({
    windowId: z.string().optional().describe('The window ID to show'),
    appName: z.string().optional().describe('The application name to show'),
    all: z.boolean().optional().describe('Show all hidden windows')
  }),
  handler: async ({ windowId, appName, all }) => {
    const decision = await requestPermissionForTool('window_show_in_sharing', { windowId, appName, all }, [
      windowId ? `windowId: ${windowId}` : undefined,
      appName ? `appName: ${appName}` : undefined,
      all ? 'all: true' : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    const availability = invisiwind.isAvailable();
    if (!availability.available) {
      return `Invisiwind binaries are missing: ${availability.missing.join(', ')}`;
    }

    if (all) {
      const hidden = screenSharePrivacyService.listHiddenWindows();
      for (const entry of hidden) {
        await invisiwind.unhideWindowsByPid(entry.pid);
      }
      screenSharePrivacyService.clear();
      return 'All hidden windows are now visible in screen sharing.';
    }

    const listResult = await adapter.listWindows();
    if (!listResult.success || !listResult.data) {
      return `Failed to list windows: ${listResult.error}`;
    }

    const target = listResult.data.find(w => {
      if (windowId && w.id === windowId) return true;
      if (appName && w.app.toLowerCase().includes(appName.toLowerCase())) return true;
      return false;
    });

    if (!target) {
      return 'Could not find a matching window. Please provide windowId or appName.';
    }

    const result = await invisiwind.unhideWindowsByPid(target.processId);
    if (!result.success) {
      return `Failed to show window: ${result.error}`;
    }

    screenSharePrivacyService.removeHiddenWindowsByPid(target.processId);
    return `Window "${target.title}" is now visible in screen sharing.`;
  }
});

export const windowListHiddenTool = defineTool('window_list_hidden', {
  description: 'List windows currently hidden from screen sharing/capture',
  parameters: p({}),
  handler: async () => {
    const hidden = screenSharePrivacyService.listHiddenWindows();
    if (hidden.length === 0) {
      return 'No windows are hidden from screen sharing.';
    }
    return JSON.stringify({
      count: hidden.length,
      windows: hidden.map(entry => ({
        hwnd: entry.hwnd,
        pid: entry.pid,
        title: entry.title,
        appName: entry.appName,
        hiddenAt: entry.hiddenAt,
      })),
    });
  }
});

export const windowHideAllSensitiveTool = defineTool('window_hide_all_sensitive', {
  description: 'Hide multiple windows from screen sharing at once by app name',
  parameters: p({
    apps: z.array(z.string()).describe('Application names to hide (e.g., "slack", "chrome")')
  }),
  handler: async ({ apps }) => {
    const decision = await requestPermissionForTool('window_hide_all_sensitive', { apps }, [
      `apps: ${apps.join(', ')}`
    ]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    const availability = invisiwind.isAvailable();
    if (!availability.available) {
      return `Invisiwind binaries are missing: ${availability.missing.join(', ')}`;
    }

    const listResult = await adapter.listWindows();
    if (!listResult.success || !listResult.data) {
      return `Failed to list windows: ${listResult.error}`;
    }

    const lowerApps = apps.map(app => app.toLowerCase());
    const targets = listResult.data.filter(w => lowerApps.some(app => w.app.toLowerCase().includes(app)));

    if (targets.length === 0) {
      return 'No matching windows found to hide.';
    }

    const handledPids = new Set<number>();
    for (const target of targets) {
      if (handledPids.has(target.processId)) continue;
      const result = await invisiwind.hideWindowsByPid(target.processId);
      if (result.success) {
        handledPids.add(target.processId);
        screenSharePrivacyService.addHiddenWindow({
          hwnd: target.id,
          pid: target.processId,
          title: target.title,
          appName: target.app,
          hiddenAt: Date.now(),
        });
      }
    }

    return `Hidden ${handledPids.size} app(s) from screen sharing.`;
  }
});
// ============================================================================
// File System Tools
// ============================================================================

export const filesListTool = defineTool('files_list', {
  description: 'List files in a directory with optional filtering',
  parameters: p({
    path: z.string().describe('Directory path to list'),
    recursive: z.boolean().optional().describe('List files recursively'),
    filter: z.object({
      extension: z.string().optional().describe('File extension to filter'),
      nameContains: z.string().optional().describe('Substring the filename must contain'),
      modifiedAfter: z.string().optional().describe('ISO date string for modified after filter')
    }).optional().describe('Filter criteria')
  }),
  handler: async ({ path, recursive, filter }) => {
    // Convert filter to match FileFilter type (extension as string[])
    const adaptedFilter = filter ? {
      ...filter,
      extension: filter.extension ? [filter.extension] : undefined,
    } : undefined;
    const result = await adapter.listFiles({ path, recursive, filter: adaptedFilter });
    if (!result.success) {
      return `Failed to list files: ${result.error}`;
    }
    const files = result.data || [];
    if (files.length === 0) {
      return `No files found in ${path}`;
    }
    return `Found ${files.length} files in ${path}:\n${files.map(f => `- ${f.name}`).join('\n')}`;
  }
});

export const filesSearchTool = defineTool('files_search', {
  description: 'Search for files by name pattern',
  parameters: p({
    query: z.string().describe('Search query (filename pattern)'),
    startPath: z.string().optional().describe('Path to start searching from'),
    maxResults: z.number().optional().describe('Maximum number of results')
  }),
  handler: async ({ query, startPath, maxResults }) => {
    const result = await adapter.searchFiles({ query, startPath, maxResults });
    if (!result.success) {
      return `Failed to search files: ${result.error}`;
    }
    const files = result.data || [];
    if (files.length === 0) {
      return `No files found matching "${query}"`;
    }
    return `Found ${files.length} files matching "${query}":\n${files.map(f => `- ${f.path}`).join('\n')}`;
  }
});

export const filesMoveTool = defineTool('files_move', {
  description: 'Move files to a new location',
  parameters: p({
    source: z.string().describe('Source file or folder path'),
    destination: z.string().describe('Destination folder path'),
    overwrite: z.boolean().optional().describe('Overwrite existing files')
  }),
  handler: async ({ source, destination, overwrite }) => {
    const sources: string[] = [source];
    const decision = await requestPermissionForTool('files_move', { source, destination, overwrite }, [
      `destination: ${destination}`,
      ...sources.slice(0, 10).map(s => `source: ${s}`),
      sources.length > 10 ? `...and ${sources.length - 10} more` : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.moveFiles({ source, destination, overwrite });
    return result.success
      ? `Successfully moved ${source} to ${destination}`
      : `Failed to move files: ${result.error}`;
  }
});

export const filesCopyTool = defineTool('files_copy', {
  description: 'Copy files to a new location',
  parameters: p({
    source: z.string().describe('Source file or folder path'),
    destination: z.string().describe('Destination folder path'),
    overwrite: z.boolean().optional().describe('Overwrite existing files')
  }),
  handler: async ({ source, destination, overwrite }) => {
    const sources: string[] = [source];
    const decision = await requestPermissionForTool('files_copy', { source, destination, overwrite }, [
      `destination: ${destination}`,
      ...sources.slice(0, 10).map(s => `source: ${s}`),
      sources.length > 10 ? `...and ${sources.length - 10} more` : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.copyFiles({ source, destination, overwrite });
    return result.success
      ? `Successfully copied ${source} to ${destination}`
      : `Failed to copy files: ${result.error}`;
  }
});

export const filesDeleteTool = defineTool('files_delete', {
  description: 'Delete files (moves to trash by default)',
  parameters: p({
    paths: z.array(z.string()).describe('Paths to delete'),
    moveToTrash: z.boolean().optional().default(true).describe('Move to trash instead of permanent delete')
  }),
  handler: async ({ paths, moveToTrash }) => {
    const decision = await requestPermissionForTool('files_delete', { paths, moveToTrash }, [
      ...paths.slice(0, 10).map(p => p),
      paths.length > 10 ? `...and ${paths.length - 10} more` : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    const effectiveMoveToTrash = typeof decision.options?.moveToTrash === 'boolean'
      ? (decision.options.moveToTrash as boolean)
      : moveToTrash;

    const result = await adapter.deleteFiles({ paths, moveToTrash: effectiveMoveToTrash });
    return result.success
      ? `Successfully deleted ${paths.length} file(s)`
      : `Failed to delete files: ${result.error}`;
  }
});

export const filesRenameTool = defineTool('files_rename', {
  description: 'Rename a file or folder',
  parameters: p({
    path: z.string().describe('Path to the file or folder'),
    newName: z.string().describe('New name')
  }),
  handler: async ({ path, newName }) => {
    const decision = await requestPermissionForTool('files_rename', { path, newName }, [
      `path: ${path}`,
      `newName: ${newName}`,
    ]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.renameFile({ path, newName });
    return result.success
      ? `Successfully renamed to ${newName}`
      : `Failed to rename: ${result.error}`;
  }
});

export const filesCreateFolderTool = defineTool('files_create_folder', {
  description: 'Create a new folder',
  parameters: p({
    path: z.string().describe('Path for the new folder')
  }),
  handler: async ({ path }) => {
    const decision = await requestPermissionForTool('files_create_folder', { path }, [`path: ${path}`]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.createFolder({ path });
    return result.success
      ? `Successfully created folder ${path}`
      : `Failed to create folder: ${result.error}`;
  }
});

export const filesReadTool = defineTool('files_read', {
  description: 'Read the contents of a text file',
  parameters: p({
    path: z.string().describe('Path to the file'),
    encoding: z.string().optional().default('utf-8').describe('File encoding'),
    maxSize: z.number().optional().describe('Maximum file size to read in bytes')
  }),
  handler: async ({ path, encoding, maxSize }) => {
    const result = await adapter.readFile({ path, encoding, maxSize });
    if (!result.success) {
      return `Failed to read file: ${result.error}`;
    }
    return result.data || '';
  }
});

export const filesInfoTool = defineTool('files_info', {
  description: 'Get information about a file or folder',
  parameters: p({
    path: z.string().describe('Path to the file or folder')
  }),
  handler: async ({ path }) => {
    const result = await adapter.getFileInfo({ path });
    if (!result.success) {
      return `Failed to get file info: ${result.error}`;
    }
    const info = result.data;
    return `File: ${info?.name}\nSize: ${info?.size} bytes\nType: ${info?.isDirectory ? 'Directory' : 'File'}\nModified: ${info?.modified}`;
  }
});

export const filesWriteTool = defineTool('files_write', {
  description: 'Write content to a file (creates if not exists, creates parent directories)',
  parameters: p({
    path: z.string().describe('Path to the file'),
    content: z.string().describe('Content to write to the file'),
    encoding: z.string().optional().default('utf-8').describe('File encoding'),
    append: z.boolean().optional().default(false).describe('Append to file instead of overwriting')
  }),
  handler: async ({ path, content, encoding, append }) => {
    const preview = content.length > 200 ? content.slice(0, 200) + '…' : content;
    const decision = await requestPermissionForTool('files_write', { path, encoding, append }, [
      `path: ${path}`,
      `append: ${append}`,
      `content preview: ${preview}`,
    ]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.writeFile({ path, content, encoding, append });
    return result.success
      ? `Successfully wrote to ${path}`
      : `Failed to write file: ${result.error}`;
  }
});

// ============================================================================
// Application Tools
// ============================================================================

export const appsListTool = defineTool('apps_list', {
  description: 'List applications (running, installed, or all)',
  parameters: p({
    filter: z.enum(['running', 'installed', 'all']).optional().describe('Filter type')
  }),
  handler: async ({ filter }) => {
    const result = await adapter.listApps({ filter });
    if (!result.success) {
      return `Failed to list applications: ${result.error}`;
    }
    const apps = result.data || [];
    if (apps.length === 0) {
      return 'No applications found';
    }
    return `Found ${apps.length} applications:\n${apps.map(a => `- ${a.name}`).join('\n')}`;
  }
});

export const appsLaunchTool = defineTool('apps_launch', {
  description: 'Launch an application',
  parameters: p({
    name: z.string().optional().describe('Application name (e.g., "chrome", "notepad")'),
    path: z.string().optional().describe('Full path to the application'),
    args: z.array(z.string()).optional().describe('Command line arguments')
  }),
  handler: async ({ name, path, args }) => {
    logger.tool('apps_launch called', { name, path, args });
    if (name && !path) {
      const match = findInstalledAppByName(name);
      if (!match) {
        showNotification({
          title: 'App not installed',
          message: `"${name}" is not installed on this device.`,
          type: 'error',
        });
        return `"${name}" is not installed on this device.`;
      }
    }
    const result = await adapter.launchApp({ name, path, args });
    logger.tool('apps_launch result', result);
    return result.success
      ? `Successfully launched ${name || path}`
      : `Failed to launch application: ${result.error}`;
  }
});

export const appsQuitTool = defineTool('apps_quit', {
  description: 'Quit an application',
  parameters: p({
    name: z.string().describe('Application name to quit'),
    force: z.boolean().optional().describe('Force quit the application')
  }),
  handler: async ({ name, force }) => {
    const decision = await requestPermissionForTool('apps_quit', { name, force }, [`app: ${name}`, force ? 'force: true' : undefined].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.quitApp({ name, force });
    return result.success
      ? `Successfully quit ${name}`
      : `Failed to quit application: ${result.error}`;
  }
});

export const appsSwitchTool = defineTool('apps_switch', {
  description: 'Switch to (focus) an application',
  parameters: p({
    name: z.string().describe('Application name to switch to')
  }),
  handler: async ({ name }) => {
    const result = await adapter.switchApp({ name });
    return result.success
      ? `Successfully switched to ${name}`
      : `Failed to switch application: ${result.error}`;
  }
});

// ============================================================================
// System Control Tools
// ============================================================================

export const systemVolumeTool = defineTool('system_volume', {
  description: 'Get or set the system volume',
  parameters: p({
    action: z.enum(['get', 'set', 'mute', 'unmute']).describe('Action to perform'),
    level: z.number().min(0).max(100).optional().describe('Volume level (0-100)')
  }),
  handler: async ({ action, level }) => {
    const result = await adapter.controlVolume({ action, level });
    if (!result.success) {
      return `Failed to control volume: ${result.error}`;
    }
    if (action === 'get') {
      return `Current volume: ${result.data?.level}%`;
    }

    // Show OSD feedback for volume changes
    if (action === 'set' && level !== undefined) {
      showOSD({ type: 'volume', value: level });
    } else if (action === 'mute') {
      showOSD({ type: 'mute', value: 1 });
    } else if (action === 'unmute') {
      showOSD({ type: 'mute', value: 0 });
    }

    return `Volume ${action === 'set' ? `set to ${level}%` : action === 'mute' ? 'muted' : 'unmuted'}`;
  }
});

export const systemBrightnessTool = defineTool('system_brightness', {
  description: 'Get or set the display brightness',
  parameters: p({
    action: z.enum(['get', 'set']).describe('Action to perform'),
    level: z.number().min(0).max(100).optional().describe('Brightness level (0-100)')
  }),
  handler: async ({ action, level }) => {
    const result = await adapter.controlBrightness({ action, level });
    if (!result.success) {
      return `Failed to control brightness: ${result.error}`;
    }
    if (action === 'get') {
      return `Current brightness: ${result.data?.level}%`;
    }

    // Show OSD feedback for brightness changes
    if (action === 'set' && level !== undefined) {
      showOSD({ type: 'brightness', value: level });
    }

    return `Brightness set to ${level}%`;
  }
});

export const systemScreenshotTool = defineTool('system_screenshot', {
  description: 'Take a screenshot (optionally analyze with AI)',
  parameters: p({
    region: z.enum(['fullscreen', 'window', 'selection']).optional().describe('Region to capture'),
    savePath: z.string().optional().describe('Directory to save the screenshot'),
    filename: z.string().optional().describe('Filename for the screenshot'),
    analyze: z.boolean().optional().describe('Send screenshot to AI for analysis (uses vision model)')
  }),
  handler: async ({ region, savePath, filename, analyze }) => {
    const result = await adapter.takeScreenshot({ region, savePath, filename });
    if (!result.success) {
      return `Failed to take screenshot: ${result.error}`;
    }

    const screenshotPath = result.data?.path;

    if (analyze && screenshotPath) {
      // For AI analysis, we need to use the MCP vision tool or describe what we see
      // Since we can't directly call vision models from here, we'll indicate where the file is
      // The user can ask follow-up questions about the screenshot
      return `Screenshot saved to ${screenshotPath}

For AI analysis of this screenshot, you can:
1. Ask me to analyze the screenshot at ${screenshotPath}
2. Use vision-capable models like claude-opus-4.5 or gpt-5.2 which can analyze images

The screenshot has been captured and is ready for analysis.`;
    }

    return `Screenshot saved to ${screenshotPath}`;
  }
});

export const systemDndTool = defineTool('system_dnd', {
  description: 'Control Do Not Disturb mode',
  parameters: p({
    action: z.enum(['status', 'on', 'off']).describe('Action to perform'),
    duration: z.number().optional().describe('Duration in minutes (for "on" action)')
  }),
  handler: async ({ action, duration }) => {
    const result = await adapter.controlDnd({ action, duration });
    if (!result.success) {
      return `Failed to control Do Not Disturb: ${result.error}`;
    }
    if (action === 'status') {
      return `Do Not Disturb is ${result.data?.enabled ? 'enabled' : 'disabled'}`;
    }
    return `Do Not Disturb ${action === 'on' ? `enabled${duration ? ` for ${duration} minutes` : ''}` : 'disabled'}`;
  }
});

export const systemLockTool = defineTool('system_lock', {
  description: 'Lock the screen',
  parameters: p({}),
  handler: async () => {
    const decision = await requestPermissionForTool('system_lock', {}, ['Lock screen']);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.lockScreen();
    return result.success
      ? 'Screen locked'
      : `Failed to lock screen: ${result.error}`;
  }
});

export const systemSleepTool = defineTool('system_sleep', {
  description: 'Put the computer to sleep',
  parameters: p({}),
  handler: async () => {
    const decision = await requestPermissionForTool('system_sleep', {}, ['Put computer to sleep']);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.sleep();
    return result.success
      ? 'Computer going to sleep'
      : `Failed to put computer to sleep: ${result.error}`;
  }
});

// ============================================================================
// Process Tools
// ============================================================================

export const processListTool = defineTool('process_list', {
  description: 'List running processes',
  parameters: p({
    sortBy: z.enum(['cpu', 'memory', 'name']).optional().describe('Sort by field'),
    limit: z.number().optional().describe('Maximum number of processes to return')
  }),
  handler: async ({ sortBy, limit }) => {
    const result = await adapter.listProcesses({ sortBy, limit });
    if (!result.success) {
      return `Failed to list processes: ${result.error}`;
    }
    const processes = result.data || [];
    if (processes.length === 0) {
      return 'No processes found';
    }
    return `Found ${processes.length} processes:\n${processes.map(p => `- ${p.name} (PID: ${p.pid}, CPU: ${p.cpu}%, Memory: ${p.memory}MB)`).join('\n')}`;
  }
});

export const processInfoTool = defineTool('process_info', {
  description: 'Get information about a specific process',
  parameters: p({
    pid: z.number().optional().describe('Process ID'),
    name: z.string().optional().describe('Process name')
  }),
  handler: async ({ pid, name }) => {
    const result = await adapter.getProcessInfo({ pid, name });
    if (!result.success) {
      return `Failed to get process info: ${result.error}`;
    }
    const info = result.data;
    return `Process: ${info?.name}\nPID: ${info?.pid}\nCPU: ${info?.cpu}%\nMemory: ${info?.memory}MB\nStatus: ${info?.status}`;
  }
});

export const processKillTool = defineTool('process_kill', {
  description: 'Kill a process',
  parameters: p({
    pid: z.number().optional().describe('Process ID to kill'),
    name: z.string().optional().describe('Process name to kill'),
    force: z.boolean().optional().describe('Force kill the process')
  }),
  handler: async ({ pid, name, force }) => {
    const decision = await requestPermissionForTool('process_kill', { pid, name, force }, [
      pid !== undefined ? `pid: ${pid}` : undefined,
      name ? `name: ${name}` : undefined,
      force ? 'force: true' : undefined,
    ].filter(Boolean) as string[]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }
    const result = await adapter.killProcess({ pid, name, force });
    return result.success
      ? `Successfully killed process ${pid || name}`
      : `Failed to kill process: ${result.error}`;
  }
});

export const processTopTool = defineTool('process_top', {
  description: 'Get top resource-consuming processes',
  parameters: p({
    resource: z.enum(['cpu', 'memory']).describe('Resource to sort by'),
    limit: z.number().optional().describe('Number of processes to return')
  }),
  handler: async ({ resource, limit }) => {
    const result = await adapter.getTopProcesses({ resource, limit });
    if (!result.success) {
      return `Failed to get top processes: ${result.error}`;
    }
    const processes = result.data || [];
    if (processes.length === 0) {
      return 'No processes found';
    }
    return `Top ${resource} processes:\n${processes.map(p => `- ${p.name}: ${resource === 'cpu' ? `${p.cpu}%` : `${p.memory}MB`}`).join('\n')}`;
  }
});

// ============================================================================
// Clipboard Tools
// ============================================================================

export const clipboardReadTool = defineTool('clipboard_read', {
  description: 'Read the clipboard contents',
  parameters: p({
    format: z.enum(['text', 'html']).optional().describe('Format to read')
  }),
  handler: async ({ format }) => {
    const result = await adapter.readClipboard({ format });
    if (!result.success) {
      return `Failed to read clipboard: ${result.error}`;
    }
    return result.data?.content || '(clipboard is empty)';
  }
});

export const clipboardWriteTool = defineTool('clipboard_write', {
  description: 'Write to the clipboard',
  parameters: p({
    content: z.string().describe('Content to write'),
    format: z.enum(['text', 'html']).optional().describe('Format to write')
  }),
  handler: async ({ content, format }) => {
    const result = await adapter.writeClipboard({ content, format });
    return result.success
      ? 'Successfully wrote to clipboard'
      : `Failed to write to clipboard: ${result.error}`;
  }
});

export const clipboardClearTool = defineTool('clipboard_clear', {
  description: 'Clear the clipboard',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.clearClipboard();
    return result.success
      ? 'Clipboard cleared'
      : `Failed to clear clipboard: ${result.error}`;
  }
});

// ============================================================================
// Clipboard History Tools
// ============================================================================

export const clipboardHistoryTool = defineTool('clipboard_history', {
  description: 'Get clipboard history with optional search query. Shows previously copied text items.',
  parameters: p({
    query: z.string().optional().describe('Search query to filter clipboard history'),
    limit: z.number().optional().describe('Maximum number of results to return (default 10)'),
  }),
  handler: async ({ query, limit = 10 }) => {
    const { clipboardMonitor } = await import('../main/clipboard-monitor');
    const results = query
      ? clipboardMonitor.searchHistory(query)
      : clipboardMonitor.getHistory();

    const limited = results.slice(0, limit);

    if (limited.length === 0) {
      return query
        ? `No clipboard entries found matching "${query}"`
        : 'Clipboard history is empty';
    }

    const formatted = limited.map((entry, i) => {
      const time = new Date(entry.timestamp).toLocaleString();
      const pinned = entry.pinned ? ' [pinned]' : '';
      let preview: string;
      switch (entry.type) {
        case 'text':
          preview = entry.content.length > 100
            ? entry.content.slice(0, 100) + '...'
            : entry.content;
          break;
        case 'image':
          preview = `[Image ${entry.width}x${entry.height} ${entry.format.toUpperCase()}]`;
          break;
        case 'files':
          preview = `[${entry.files.length} file(s): ${entry.files.slice(0, 3).map(f => f.name).join(', ')}${entry.files.length > 3 ? '...' : ''}]`;
          break;
        default:
          preview = '[Unknown type]';
      }
      return `${i + 1}. [${time}]${pinned}\n${preview}\n`;
    }).join('\n');

    return `Clipboard History (${limited.length} items):\n\n${formatted}`;
  }
});

export const clipboardRestoreTool = defineTool('clipboard_restore', {
  description: 'Restore a clipboard entry by searching for content. Finds the most recent match and puts it back in the clipboard.',
  parameters: p({
    query: z.string().describe('Search for clipboard entry containing this text'),
  }),
  handler: async ({ query }) => {
    const { clipboardMonitor } = await import('../main/clipboard-monitor');
    const results = clipboardMonitor.searchHistory(query);

    if (results.length === 0) {
      return `No clipboard entry found containing "${query}"`;
    }

    // Restore the most recent match
    const entry = results[0];
    clipboardMonitor.restoreToClipboard(entry.id);

    let preview: string;
    switch (entry.type) {
      case 'text':
        preview = entry.content.length > 100
          ? entry.content.slice(0, 100) + '...'
          : entry.content;
        break;
      case 'image':
        preview = `[Image ${entry.width}x${entry.height} ${entry.format.toUpperCase()}]`;
        break;
      case 'files':
        preview = `[${entry.files.length} file(s): ${entry.files.map(f => f.name).join(', ')}]`;
        break;
      default:
        preview = '[Unknown type]';
    }

    return `Restored to clipboard:\n${preview}`;
  }
});

// ============================================================================
// Office Tools
// ============================================================================

export const officeCreateTool = defineTool('office_create', {
  description: 'Create a new Microsoft Office document and open it',
  parameters: p({
    type: z.enum(['word', 'excel', 'powerpoint', 'outlook']).describe('Type of Office document'),
    path: z.string().optional().describe('Optional path to save the document. If not provided, opens a blank document.')
  }),
  handler: async ({ type, path }) => {
    const officeApps: Record<string, string> = {
      word: 'winword',
      excel: 'excel',
      powerpoint: 'powerpnt',
      outlook: 'outlook'
    };
    const appName = officeApps[type];
    const args = path ? [path] : ['/n'];
    
    const result = await adapter.launchApp({ name: appName, args });
    return result.success
      ? `Successfully opened ${type}${path ? ` with ${path}` : ' (new document)'}`
      : `Failed to open ${type}: ${result.error}`;
  }
});

export const powerpointCreateTool = defineTool('powerpoint_create', {
  description: 'Create a PowerPoint presentation with slides and content. PowerPoint will open with the completed presentation.',
  parameters: p({
    savePath: z.string().describe('Full absolute path where to save the .pptx file (e.g., C:\\Users\\username\\Documents\\presentation.pptx). Use ~ for home directory.'),
    slides: z.array(z.object({
      layout: z.enum(['title', 'content', 'blank', 'titleOnly']).describe('Slide layout type'),
      title: z.string().optional().describe('Slide title'),
      subtitle: z.string().optional().describe('Subtitle (for title slides)'),
      content: z.string().optional().describe('Body text/bullet points. Use newlines to separate bullet points')
    })).describe('Array of slides to add')
  }),
  handler: async ({ savePath, slides }) => {
    const result = await adapter.createPowerPoint({ savePath, slides });
    return result.success
      ? `Successfully created PowerPoint presentation with ${slides.length} slide(s) at ${savePath}`
      : `Failed to create PowerPoint presentation: ${result.error}`;
  }
});

// ============================================================================
// System Information Tools
// ============================================================================

export const systemInfoTool = defineTool('system_info', {
  description: 'Get comprehensive system information including CPU, RAM, disk, OS, hardware, uptime, and battery status',
  parameters: p({
    sections: z.array(z.string()).optional().describe('Specific sections to retrieve (optional)')
  }),
  handler: async ({ sections }) => {
    const result = await adapter.getSystemInfo({ sections });
    if (!result.success) {
      return `Failed to get system info: ${result.error}`;
    }

    const info = result.data?.data;
    if (!info) {
      return 'No system information available';
    }

    let output = '=== System Information ===\n\n';

    // CPU
    output += `CPU: ${info.cpu.name}\n`;
    output += `  Cores: ${info.cpu.cores}\n`;
    output += `  Speed: ${info.cpu.speedMHz} MHz\n`;
    output += `  Usage: ${info.cpu.usagePercent}%\n\n`;

    // Memory
    output += `Memory:\n`;
    output += `  Total: ${info.memory.totalGB} GB\n`;
    output += `  Used: ${info.memory.usedGB} GB\n`;
    output += `  Usage: ${info.memory.usagePercent}%\n\n`;

    // Disk
    output += `Disk:\n`;
    info.disk.forEach(d => {
      output += `  ${d.drive} - ${d.totalGB} GB total, ${d.freeGB} GB free (${d.usagePercent}% used)\n`;
    });
    output += '\n';

    // OS
    output += `OS: ${info.os.name}\n`;
    output += `  Version: ${info.os.version}\n`;
    output += `  Build: ${info.os.build}\n`;
    output += `  Architecture: ${info.os.architecture}\n\n`;

    // Uptime
    output += `Uptime: ${info.uptime.formatted}\n\n`;

    // Battery (if present)
    if (info.battery?.isPresent) {
      output += `Battery:\n`;
      output += `  Charge: ${info.battery.chargePercent}%\n`;
      output += `  Charging: ${info.battery.isCharging ? 'Yes' : 'No'}\n`;
    }

    return output;
  }
});

// ============================================================================
// Network Tools
// ============================================================================

export const networkInfoTool = defineTool('network_info', {
  description: 'Get network information including IP addresses, WiFi status, gateway, DNS, and network interfaces',
  parameters: p({
    includeInactive: z.boolean().optional().describe('Include inactive network interfaces')
  }),
  handler: async ({ includeInactive }) => {
    const result = await adapter.getNetworkInfo({ includeInactive });
    if (!result.success) {
      return `Failed to get network info: ${result.error}`;
    }

    const info = result.data?.data;
    if (!info) {
      return 'No network information available';
    }

    let output = '=== Network Information ===\n\n';

    output += `Hostname: ${info.hostname}\n\n`;

    // WiFi
    if (info.wifi) {
      output += `WiFi:\n`;
      output += `  SSID: ${info.wifi.ssid}\n`;
      output += `  Signal: ${info.wifi.signalStrength}%\n`;
      output += `  Channel: ${info.wifi.channel}\n\n`;
    }

    // Interfaces
    output += `Network Interfaces:\n`;
    info.interfaces.forEach(iface => {
      output += `  ${iface.name} (${iface.type})\n`;
      output += `    Status: ${iface.status}\n`;
      if (iface.ipv4) {
        output += `    IPv4: ${iface.ipv4}\n`;
      }
      output += `    MAC: ${iface.mac}\n`;
    });
    output += '\n';

    // DNS
    if (info.primaryDns.length > 0) {
      output += `Primary DNS Servers:\n`;
      info.primaryDns.forEach(dns => {
        output += `  ${dns}\n`;
      });
    }

    return output;
  }
});

export const networkTestTool = defineTool('network_test', {
  description: 'Test network connectivity with ping, DNS resolution, or connectivity checks',
  parameters: p({
    test: z.enum(['ping', 'dns', 'connectivity']).describe('Type of test to run'),
    host: z.string().optional().describe('Target host (defaults: ping=8.8.8.8, dns=google.com, connectivity=www.google.com)'),
    count: z.number().optional().describe('Number of ping attempts (default: 4, only for ping test)')
  }),
  handler: async ({ test, host, count }) => {
    const result = await adapter.testNetwork({ test, host, count });
    if (!result.success) {
      return `Failed to test network: ${result.error}`;
    }

    const testResult = result.data?.result;
    if (!testResult) {
      return 'No test results available';
    }

    let output = `=== Network Test: ${test.toUpperCase()} ===\n\n`;

    if (testResult.success) {
      output += `Status: SUCCESS\n\n`;
      output += `Details:\n`;
      Object.entries(testResult.details).forEach(([key, value]) => {
        output += `  ${key}: ${value}\n`;
      });
    } else {
      output += `Status: FAILED\n\n`;
      output += `Details:\n`;
      Object.entries(testResult.details).forEach(([key, value]) => {
        output += `  ${key}: ${value}\n`;
      });
    }

    return output;
  }
});

// ============================================================================
// Service Tools
// ============================================================================

export const serviceListTool = defineTool('service_list', {
  description: 'List Windows services with their status and startup type',
  parameters: p({
    filter: z.enum(['running', 'stopped', 'all']).optional().describe('Filter services by status'),
    nameContains: z.string().optional().describe('Filter services by name substring')
  }),
  handler: async ({ filter, nameContains }) => {
    const result = await adapter.listServices({ filter, nameContains });
    if (!result.success) {
      return `Failed to list services: ${result.error}`;
    }

    const services = result.data?.services || [];
    if (services.length === 0) {
      return 'No services found matching criteria';
    }

    let output = `=== Services (${services.length} found) ===\n\n`;

    services.forEach(svc => {
      output += `${svc.displayName}\n`;
      output += `  Name: ${svc.name}\n`;
      output += `  Status: ${svc.status}\n`;
      output += `  Startup: ${svc.startupType}\n`;
      if (svc.description) {
        output += `  Description: ${svc.description}\n`;
      }
      output += '\n';
    });

    return output;
  }
});

export const serviceControlTool = defineTool('service_control', {
  description: 'Start, stop, or restart a Windows service',
  parameters: p({
    service: z.string().describe('Service name to control'),
    action: z.enum(['start', 'stop', 'restart']).describe('Action to perform')
  }),
  handler: async ({ service, action }) => {
    const decision = await requestPermissionForTool('service_control', { service, action }, [
      `service: ${service}`,
      `action: ${action}`
    ]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    const result = await adapter.controlService({ service, action });
    return result.success
      ? `Successfully ${action}ed service: ${service}`
      : `Failed to ${action} service: ${result.error}`;
  }
});

// ============================================================================
// Web Search Tools
// ============================================================================

export const webSearchTool = defineTool('web_search', {
  description: 'Search the web for current information, news, weather, or any topic. Returns search results with titles, snippets, and URLs.',
  parameters: p({
    query: z.string().describe('Search query (e.g., "latest AI news", "weather in Seattle", "Python tutorial")'),
    maxResults: z.number().optional().default(5).describe('Maximum number of results to return (default: 5)')
  }),
  handler: async ({ query, maxResults = 5 }) => {
    try {
      // Note: This is a placeholder implementation
      // For production, integrate with a search API:
      // - Bing Search API: https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
      // - Google Custom Search: https://developers.google.com/custom-search/v1/overview
      // - DuckDuckGo API: https://duckduckgo.com/api
      // - SerpAPI: https://serpapi.com/

      // For now, return a message indicating how to set up search
      return JSON.stringify({
        query,
        maxResults, // Will be used when API is configured
        message: 'Web search tool is configured but requires an API key.',
        instructions: [
          '1. Choose a search provider (Bing, Google, DuckDuckGo, SerpAPI)',
          '2. Get an API key from the provider',
          '3. Add the API key to environment variables or settings',
          '4. The agentic loop will then be able to search the web autonomously'
        ],
        alternative: 'Use the built-in web_fetch tool to fetch specific URLs directly',
        example: 'web_fetch("https://news.ycombinator.com") to fetch Hacker News'
      }, null, 2);

      // Example implementation with Bing Search API (commented out):
      /*
      const BING_API_KEY = process.env.BING_SEARCH_API_KEY;
      if (!BING_API_KEY) {
        return 'Error: BING_SEARCH_API_KEY not configured';
      }

      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
        { headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY } }
      );

      const data = await response.json();
      const results = data.webPages?.value || [];

      return JSON.stringify({
        query,
        count: results.length,
        results: results.map((r: any) => ({
          title: r.name,
          snippet: r.snippet,
          url: r.url
        }))
      }, null, 2);
      */
    } catch (error) {
      return `Failed to search web: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
});

// ============================================================================
// Troubleshooting Tools
// ============================================================================

// Helper function to get diagnostic plan based on category
function getDiagnosticPlan(category: string): string[] {
  const plans: Record<string, string[]> = {
    network: ['network_info', 'network_test (connectivity)', 'service_list (DNS, DHCP)'],
    performance: ['system_info', 'process_top (cpu)', 'process_top (memory)'],
    audio: ['system_info (hardware)', 'service_list (Windows Audio)', 'system_volume (get)'],
    display: ['system_info (hardware)', 'system_brightness (get)'],
    storage: ['system_info (disk)', 'files_list (temp folders)'],
    application: ['apps_list (running)', 'process_list', 'system_info'],
    system: ['system_info', 'service_list', 'network_info'],
    other: ['system_info', 'network_info', 'process_list']
  };
  return plans[category] || plans.other;
}

export const troubleshootStartTool = defineTool('troubleshoot_start', {
  description: 'Initialize a troubleshooting session. Use when user describes a problem.',
  parameters: p({
    issue: z.string().describe('User description of the problem'),
    category: z.enum(['network', 'performance', 'audio', 'display', 'storage', 'application', 'system', 'other']).optional().describe('Problem category')
  }),
  handler: async ({ issue, category }) => {
    const diagnosticPlan = getDiagnosticPlan(category || 'other');

    return JSON.stringify({
      sessionId: `ts-${Date.now()}`,
      issue,
      category: category || 'other',
      suggestedDiagnostics: diagnosticPlan,
      instructions: 'Run the suggested diagnostic tools, then use troubleshoot_propose_fix to suggest solutions.'
    }, null, 2);
  }
});

export const troubleshootProposeFix = defineTool('troubleshoot_propose_fix', {
  description: 'Propose fixes after running diagnostics. Structures fixes by risk level for user approval.',
  parameters: p({
    sessionId: z.string().describe('Troubleshooting session ID'),
    diagnosis: z.string().describe('Summary of findings'),
    fixes: z.array(z.object({
      title: z.string().describe('Fix title'),
      description: z.string().describe('Detailed description of the fix'),
      riskLevel: z.enum(['safe', 'moderate', 'risky']).describe('Risk level of the fix'),
      commands: z.array(z.object({
        tool: z.string().describe('Tool name to use'),
        params: z.record(z.unknown()).describe('Tool parameters'),
        description: z.string().describe('Description of what this command does')
      })).describe('Commands to execute for this fix')
    })).describe('Array of proposed fixes')
  }),
  handler: async ({ sessionId, diagnosis, fixes }) => {
    return JSON.stringify({
      sessionId,
      diagnosis,
      fixes: fixes.map((f, i) => ({
        ...f,
        id: `fix-${i}`,
        riskIndicator: f.riskLevel === 'safe' ? '[SAFE]' : f.riskLevel === 'moderate' ? '[MODERATE]' : '[RISKY]'
      })),
      instructions: 'Present fixes to user. For approved fixes, execute commands in order. Risky fixes require explicit confirmation.'
    }, null, 2);
  }
});

// ============================================================================
// WiFi Tools
// ============================================================================

export const wifiControlTool = defineTool('system_wifi', {
  description: 'Control WiFi - turn on/off, get status, list networks',
  parameters: p({
    action: z.enum(['status', 'on', 'off', 'toggle', 'list', 'available']).describe('Action to perform'),
  }),
  handler: async ({ action }) => {
    const decision = await requestPermissionForTool('system_wifi', { action }, [`action: ${action}`]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    switch (action) {
      case 'status': {
        const result = await adapter.getWiFiStatus();
        if (!result.success || !result.data) {
          return `Failed to get WiFi status: ${result.error}`;
        }
        const status = result.data;
        let output = `WiFi Status:\n`;
        output += `  Enabled: ${status.enabled ? 'Yes' : 'No'}\n`;
        output += `  Connected: ${status.connected ? 'Yes' : 'No'}\n`;
        if (status.ssid) {
          output += `  Network: ${status.ssid}\n`;
        }
        if (status.signalStrength !== undefined) {
          output += `  Signal: ${status.signalStrength}%\n`;
        }
        return output;
      }
      case 'on': {
        const result = await adapter.enableWiFi();
        return result.success ? 'WiFi enabled' : `Failed to enable WiFi: ${result.error}`;
      }
      case 'off': {
        const result = await adapter.disableWiFi();
        return result.success ? 'WiFi disabled' : `Failed to disable WiFi: ${result.error}`;
      }
      case 'toggle': {
        const result = await adapter.toggleWiFi();
        if (!result.success) {
          return `Failed to toggle WiFi: ${result.error}`;
        }
        return `WiFi ${result.data?.enabled ? 'enabled' : 'disabled'}`;
      }
      case 'list': {
        const result = await adapter.listWiFiNetworks();
        if (!result.success) {
          return `Failed to list networks: ${result.error}`;
        }
        const networks = result.data || [];
        if (networks.length === 0) {
          return 'No saved WiFi networks found';
        }
        return `Saved WiFi networks (${networks.length}):\n${networks.map(n => `- ${n.ssid}`).join('\n')}`;
      }
      case 'available': {
        const result = await adapter.listAvailableWiFi();
        if (!result.success) {
          return `Failed to list available networks: ${result.error}`;
        }
        const networks = result.data || [];
        if (networks.length === 0) {
          return 'No available WiFi networks found';
        }
        return `Available WiFi networks (${networks.length}):\n${networks.map(n => `- ${n.ssid} (${n.signalStrength}% signal)`).join('\n')}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  }
});

// ============================================================================
// Productivity Timer Tools
// ============================================================================

export const productivityTimerTool = defineTool('productivity_timer', {
  description: 'Interactive stopwatch with start/pause/reset',
  parameters: p({
    action: z.enum(['create', 'start', 'pause', 'reset', 'status', 'delete', 'list']).describe('Action to perform'),
    id: z.string().optional().describe('Timer ID (required for most actions)'),
    name: z.string().optional().describe('Timer name (for create action)'),
  }),
  handler: async ({ action, id, name }) => {
    switch (action) {
      case 'create': {
        const timer = createTimer(name || 'Timer');
        return `Created timer "${timer.name}" (ID: ${timer.id}). Use "start the timer ${timer.id}" to start it.`;
      }
      case 'start': {
        if (!id) return 'Error: Timer ID is required to start a timer';
        const timer = timerManager.startTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Started timer "${timer.name}". Current time: ${formatTime(timer.elapsed)}`;
      }
      case 'pause': {
        if (!id) return 'Error: Timer ID is required to pause a timer';
        const timer = timerManager.pauseTimer(id);
        if (!timer) return `Error: Timer ${id} not found or not running`;
        return `Paused timer "${timer.name}" at ${formatTime(timer.elapsed)}`;
      }
      case 'reset': {
        if (!id) return 'Error: Timer ID is required to reset a timer';
        const timer = timerManager.resetTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Reset timer "${timer.name}" to 00:00`;
      }
      case 'status': {
        if (!id) return 'Error: Timer ID is required to check timer status';
        const timer = timerManager.getTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Timer "${timer.name}":\n  Status: ${timer.status}\n  Time: ${formatTime(timer.elapsed)}`;
      }
      case 'delete': {
        if (!id) return 'Error: Timer ID is required to delete a timer';
        const success = timerManager.deleteTimer(id);
        if (!success) return `Error: Timer ${id} not found`;
        return `Deleted timer ${id}`;
      }
      case 'list': {
        const timers = timerManager.getAllTimers();
        if (timers.length === 0) return 'No timers found';
        return `Timers (${timers.length}):\n${timers.map(t =>
          `- ${t.name} (ID: ${t.id}): ${t.status} - ${formatTime(t.elapsed)}`
        ).join('\n')}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  }
});

export const productivityCountdownTool = defineTool('productivity_countdown', {
  description: 'Countdown timer with custom duration and notification',
  parameters: p({
    action: z.enum(['create', 'start', 'pause', 'reset', 'status', 'delete', 'list']).describe('Action to perform'),
    id: z.string().optional().describe('Timer ID'),
    name: z.string().optional().describe('Countdown name (for create)'),
    duration: z.number().optional().describe('Duration in minutes (for create)'),
  }),
  handler: async ({ action, id, name, duration }) => {
    switch (action) {
      case 'create': {
        if (!duration) return 'Error: Duration (in minutes) is required to create a countdown';
        const timer = createCountdown(name || 'Countdown', duration);
        const timeStr = formatTime(timer.duration || 0);
        return `Created countdown "${timer.name}" for ${duration} minutes (ID: ${timer.id}). Time: ${timeStr}`;
      }
      case 'start': {
        if (!id) return 'Error: Timer ID is required to start a countdown';
        const timer = timerManager.startTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Started countdown "${timer.name}". Remaining: ${formatTime(timer.remaining || 0)}`;
      }
      case 'pause': {
        if (!id) return 'Error: Timer ID is required to pause a countdown';
        const timer = timerManager.pauseTimer(id);
        if (!timer) return `Error: Timer ${id} not found or not running`;
        return `Paused countdown "${timer.name}" at ${formatTime(timer.remaining || 0)}`;
      }
      case 'reset': {
        if (!id) return 'Error: Timer ID is required to reset a countdown';
        const timer = timerManager.resetTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Reset countdown "${timer.name}" to ${formatTime(timer.duration || 0)}`;
      }
      case 'status': {
        if (!id) return 'Error: Timer ID is required to check countdown status';
        const timer = timerManager.getTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Countdown "${timer.name}":\n  Status: ${timer.status}\n  Remaining: ${formatTime(timer.remaining || 0)}`;
      }
      case 'delete': {
        if (!id) return 'Error: Timer ID is required to delete a countdown';
        const success = timerManager.deleteTimer(id);
        if (!success) return `Error: Timer ${id} not found`;
        return `Deleted countdown ${id}`;
      }
      case 'list': {
        const timers = timerManager.getAllTimers().filter(t => t.type === 'countdown');
        if (timers.length === 0) return 'No countdowns found';
        return `Countdowns (${timers.length}):\n${timers.map(t =>
          `- ${t.name} (ID: ${t.id}): ${t.status} - ${formatTime(t.remaining || 0)} remaining`
        ).join('\n')}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  }
});

export const productivityPomodoroTool = defineTool('productivity_pomodoro', {
  description: 'Pomodoro timer: 25min work / 5min break cycles',
  parameters: p({
    action: z.enum(['create', 'start', 'pause', 'reset', 'skip', 'status', 'delete', 'list']).describe('Action to perform'),
    id: z.string().optional().describe('Timer ID'),
    name: z.string().optional().describe('Pomodoro name (for create)'),
    workDuration: z.number().optional().default(25).describe('Work duration in minutes'),
    breakDuration: z.number().optional().default(5).describe('Break duration in minutes'),
  }),
  handler: async ({ action, id, name, workDuration, breakDuration }) => {
    switch (action) {
      case 'create': {
        const timer = createPomodoro(name || 'Pomodoro', workDuration, breakDuration);
        return `Created Pomodoro "${timer.name}" with ${workDuration}min work / ${breakDuration}min break cycles (ID: ${timer.id})`;
      }
      case 'start': {
        if (!id) return 'Error: Timer ID is required to start a Pomodoro';
        const timer = timerManager.startTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        const phase = timer.isBreak ? 'Break' : 'Work';
        return `Started Pomodoro "${timer.name}". ${phase} phase: ${formatTime(timer.remaining || 0)} remaining`;
      }
      case 'pause': {
        if (!id) return 'Error: Timer ID is required to pause a Pomodoro';
        const timer = timerManager.pauseTimer(id);
        if (!timer) return `Error: Timer ${id} not found or not running`;
        return `Paused Pomodoro "${timer.name}" at ${formatTime(timer.remaining || 0)}`;
      }
      case 'reset': {
        if (!id) return 'Error: Timer ID is required to reset a Pomodoro';
        const timer = timerManager.resetTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        return `Reset Pomodoro "${timer.name}" to cycle 1`;
      }
      case 'skip': {
        if (!id) return 'Error: Timer ID is required to skip Pomodoro phase';
        const timer = timerManager.skipPomodoroPhase(id);
        if (!timer) return `Error: Timer ${id} not found`;
        const phase = timer.isBreak ? 'Break' : 'Work';
        return `Skipped to ${phase} phase. Cycle ${timer.pomodoroCycle || 1}.`;
      }
      case 'status': {
        if (!id) return 'Error: Timer ID is required to check Pomodoro status';
        const timer = timerManager.getTimer(id);
        if (!timer) return `Error: Timer ${id} not found`;
        const phase = timer.isBreak ? 'Break' : 'Work';
        return `Pomodoro "${timer.name}":\n  Status: ${timer.status}\n  Phase: ${phase}\n  Cycle: ${timer.pomodoroCycle || 1}\n  Remaining: ${formatTime(timer.remaining || 0)}`;
      }
      case 'delete': {
        if (!id) return 'Error: Timer ID is required to delete a Pomodoro';
        const success = timerManager.deleteTimer(id);
        if (!success) return `Error: Timer ${id} not found`;
        return `Deleted Pomodoro ${id}`;
      }
      case 'list': {
        const timers = timerManager.getAllTimers().filter(t => t.type === 'pomodoro');
        if (timers.length === 0) return 'No Pomodoro timers found';
        return `Pomodoro timers (${timers.length}):\n${timers.map(t => {
          const phase = t.isBreak ? 'Break' : 'Work';
          return `- ${t.name} (ID: ${t.id}): ${t.status} - Cycle ${t.pomodoroCycle || 1} (${phase})`;
        }).join('\n')}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  }
});

// ============================================================================
// World Clock Tool
// ============================================================================

export const productivityWorldClockTool = defineTool('productivity_worldclock', {
  description: 'Display current time in multiple timezones around the world',
  parameters: p({
    cities: z.array(z.string()).optional().describe('City names or timezone names (e.g., ["New York", "London", "Tokyo"])'),
    action: z.enum(['show', 'search', 'list']).optional().default('show').describe('Action to perform'),
  }),
  handler: async ({ cities, action = 'show' }) => {
    switch (action) {
      case 'show': {
        // If no cities specified, use defaults
        const citiesToShow = cities && cities.length > 0
          ? cities.map(name => {
              // Check if it's a timezone or city name
              const found = searchCities(name);
              if (found.length > 0) return found[0];
              // Treat as timezone
              return { name, timezone: name, flag: '' };
            })
          : getAllCities();

        return formatWorldClock(citiesToShow);
      }
      case 'search': {
        if (!cities || cities.length === 0) {
          const allCities = getAllCities();
          return `Available cities (${allCities.length}):\n${allCities.map(c => `- ${c.name}, ${c.country || ''} (${c.timezone})`).join('\n')}`;
        }

        const query = cities[0];
        const results = searchCities(query);
        if (results.length === 0) {
          return `No cities found matching "${query}"`;
        }
        return `Cities matching "${query}":\n${results.map(c => `- ${c.name}, ${c.country || ''} (${c.timezone})`).join('\n')}`;
      }
      case 'list': {
        const allCities = getAllCities();
        return `Available cities (${allCities.length}):\n${allCities.map(c => `- ${c.name}, ${c.country || ''} (${c.timezone})`).join('\n')}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  }
});

// ============================================================================
// Unit Converter Tool
// ============================================================================

// Conversion factors to base units
const CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  // Length (base: meter)
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
  },
  // Weight (base: kilogram)
  weight: {
    mg: 0.000001,
    g: 0.001,
    kg: 1,
    oz: 0.0283495,
    lb: 0.453592,
    st: 6.35029,
    ton: 1000,
  },
  // Temperature (special handling)
  temperature: {
    c: 1, // Celsius (base)
    f: 1, // Fahrenheit
    k: 1, // Kelvin
  },
  // Volume (base: liter)
  volume: {
    ml: 0.001,
    l: 1,
    cup: 0.236588,
    pt: 0.473176,
    qt: 0.946353,
    gal: 3.78541,
    floz: 0.0295735,
  },
  // Area (base: square meter)
  area: {
    m2: 1,
    km2: 1000000,
    ha: 10000,
    ac: 4046.86,
    ft2: 0.092903,
    yd2: 0.836127,
    mi2: 2589988,
  },
  // Speed (base: m/s)
  speed: {
    mps: 1,
    kph: 0.277778,
    mph: 0.44704,
    knot: 0.514444,
    fps: 0.3048,
  },
};

// Category names for display
const UNIT_CATEGORIES: Record<string, string> = {
  length: 'Length',
  weight: 'Weight',
  temperature: 'Temperature',
  volume: 'Volume',
  area: 'Area',
  speed: 'Speed',
};

// Unit names for display
const UNIT_NAMES: Record<string, Record<string, string>> = {
  length: { mm: 'mm', cm: 'cm', m: 'm', km: 'km', in: 'in', ft: 'ft', yd: 'yd', mi: 'mi' },
  weight: { mg: 'mg', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb', st: 'st', ton: 'ton' },
  temperature: { c: '°C', f: '°F', k: 'K' },
  volume: { ml: 'mL', l: 'L', cup: 'cup', pt: 'pt', qt: 'qt', gal: 'gal', floz: 'fl oz' },
  area: { m2: 'm²', km2: 'km²', ha: 'ha', ac: 'ac', ft2: 'ft²', yd2: 'yd²', mi2: 'mi²' },
  speed: { mps: 'm/s', kph: 'km/h', mph: 'mph', knot: 'knot', fps: 'ft/s' },
};

/**
 * Detect unit category from unit string
 */
function detectUnitCategory(unit: string): string | null {
  const lowerUnit = unit.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Direct unit mapping
  for (const [category, units] of Object.entries(CONVERSION_FACTORS)) {
    for (const u of Object.keys(units)) {
      if (lowerUnit === u || lowerUnit === u + 's') {
        return category;
      }
    }
  }

  // Special cases for squared units
  if (lowerUnit.includes('m2') || lowerUnit.includes('m²') || lowerUnit === 'sqm' || lowerUnit === 'sqmeters') {
    return 'area';
  }
  if (lowerUnit.includes('ft2') || lowerUnit.includes('ft²') || lowerUnit === 'sqft' || lowerUnit === 'sqfeet') {
    return 'area';
  }
  if (lowerUnit.includes('km2') || lowerUnit.includes('km²')) {
    return 'area';
  }

  // Temperature special cases
  if (lowerUnit.includes('c') || lowerUnit.includes('celsius')) {
    return 'temperature';
  }
  if (lowerUnit.includes('f') || lowerUnit.includes('fahrenheit')) {
    return 'temperature';
  }
  if (lowerUnit.includes('k') || lowerUnit.includes('kelvin')) {
    return 'temperature';
  }

  return null;
}

/**
 * Normalize unit string to canonical form
 */
function normalizeUnit(unit: string, category: string): string | null {
  const lowerUnit = unit.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check all units in category
  for (const u of Object.keys(CONVERSION_FACTORS[category])) {
    if (lowerUnit === u || lowerUnit === u + 's') {
      return u;
    }
  }

  // Special cases
  if (category === 'temperature') {
    if (lowerUnit.includes('c') || lowerUnit.includes('celsius')) return 'c';
    if (lowerUnit.includes('f') || lowerUnit.includes('fahrenheit')) return 'f';
    if (lowerUnit.includes('k') || lowerUnit.includes('kelvin')) return 'k';
  }

  return null;
}

/**
 * Convert temperature (special handling for C/F/K)
 */
function convertTemperature(value: number, from: string, to: string): number {
  // First convert to Celsius
  let celsius: number;
  if (from === 'c') {
    celsius = value;
  } else if (from === 'f') {
    celsius = (value - 32) * 5 / 9;
  } else if (from === 'k') {
    celsius = value - 273.15;
  } else {
    return NaN;
  }

  // Convert from Celsius to target
  if (to === 'c') {
    return celsius;
  } else if (to === 'f') {
    return (celsius * 9 / 5) + 32;
  } else if (to === 'k') {
    return celsius + 273.15;
  } else {
    return NaN;
  }
}

/**
 * Perform unit conversion
 */
function convertUnits(value: number, fromUnit: string, toUnit: string): { success: boolean; result?: number; error?: string } {
  const fromCategory = detectUnitCategory(fromUnit);
  const toCategory = detectUnitCategory(toUnit);

  if (!fromCategory || !toCategory) {
    return { success: false, error: 'Unknown unit(s)' };
  }

  if (fromCategory !== toCategory) {
    return { success: false, error: `Cannot convert ${UNIT_CATEGORIES[fromCategory]} to ${UNIT_CATEGORIES[toCategory]}` };
  }

  const from = normalizeUnit(fromUnit, fromCategory);
  const to = normalizeUnit(toUnit, toCategory);

  if (!from || !to) {
    return { success: false, error: 'Could not parse unit(s)' };
  }

  // Same unit
  if (from === to) {
    return { success: true, result: value };
  }

  // Temperature special handling
  if (fromCategory === 'temperature') {
    return { success: true, result: convertTemperature(value, from, to) };
  }

  // Standard conversion via base unit
  const factors = CONVERSION_FACTORS[fromCategory];
  const baseValue = value * factors[from];
  const result = baseValue / factors[to];

  return { success: true, result: Number(result.toFixed(6)) };
}

export const productivityConvertTool = defineTool('productivity_convert', {
  description: 'Convert between units (length, weight, temperature, volume, area, speed). Examples: "100 lb to kg", "32°F to Celsius", "1 mile to km"',
  parameters: p({
    value: z.number().describe('Value to convert'),
    fromUnit: z.string().describe('Source unit (e.g., "m", "ft", "kg", "lb", "°C", "°F", "mi", "km")'),
    toUnit: z.string().describe('Target unit (e.g., "m", "ft", "kg", "lb", "C", "F", "km", "mi")'),
  }),
  handler: async ({ value, fromUnit, toUnit }) => {
    const result = convertUnits(value, fromUnit, toUnit);

    if (!result.success || result.result === undefined) {
      return `Error: ${result.error}`;
    }

    const category = detectUnitCategory(fromUnit);
    const from = normalizeUnit(fromUnit, category || '');
    const to = normalizeUnit(toUnit, category || '');
    const fromName = from && category ? UNIT_NAMES[category]?.[from] || fromUnit : fromUnit;
    const toName = to && category ? UNIT_NAMES[category]?.[to] || toUnit : toUnit;

    // Format the result nicely
    let resultStr = `${result.result}`;
    // Remove unnecessary decimal places for whole numbers
    if (result.result % 1 === 0) {
      resultStr = result.result.toString();
    } else {
      // Limit to reasonable precision
      resultStr = Number(result.result).toPrecision(6).replace(/\.?0+$/, '');
    }

    return `${value} ${fromName} = ${resultStr} ${toName}`;
  }
});

// ============================================================================
// Reminders Tool
// ============================================================================

export const setReminderTool = defineTool('set_reminder', {
  description: 'Set a reminder with a notification. Examples: "Remind me to take a break in 30 minutes", "Remind me to call John at 3pm"',
  parameters: p({
    message: z.string().describe('Reminder message'),
    delay: z.number().optional().describe('Delay in minutes from now'),
    time: z.string().optional().describe('Specific time (e.g., "3pm", "15:30", "2:30pm")'),
    date: z.string().optional().describe('Date for the reminder (e.g., "today", "tomorrow", "Monday")'),
  }),
  handler: async ({ message, delay, time, date }) => {
    let scheduledTime: Date;

    if (delay !== undefined) {
      // Simple delay in minutes
      scheduledTime = new Date(Date.now() + delay * 60 * 1000);
    } else if (time) {
      // Parse time like "3pm", "15:30", "2:30pm"
      scheduledTime = parseTimeString(time, date);
    } else {
      return 'Error: Please specify either a delay (in minutes) or a specific time';
    }

    if (scheduledTime.getTime() <= Date.now()) {
      return 'Error: Scheduled time must be in the future';
    }

    const reminder = reminderManager.createReminder(message, scheduledTime);

    const delayMinutes = Math.round((scheduledTime.getTime() - Date.now()) / (1000 * 60));
    const timeStr = delayMinutes < 60
      ? `in ${delayMinutes} minute${delayMinutes !== 1 ? 's' : ''}`
      : `at ${scheduledTime.toLocaleTimeString()}`;

    return `Reminder set: "${message}" ${timeStr}. (ID: ${reminder.id})`;
  }
});

export const listRemindersTool = defineTool('list_reminders', {
  description: 'List all active reminders',
  parameters: p({}),
  handler: async () => {
    const reminders = reminderManager.getActiveReminders();

    if (reminders.length === 0) {
      return 'No active reminders.';
    }

    const now = Date.now();
    let output = `Active Reminders (${reminders.length}):\n\n`;

    for (const reminder of reminders) {
      const delay = Math.round((reminder.scheduledTime - now) / (1000 * 60));
      const timeStr = delay < 60
        ? `in ${delay} minute${delay !== 1 ? 's' : ''}`
        : `at ${new Date(reminder.scheduledTime).toLocaleTimeString()}`;

      output += `• "${reminder.message}"\n`;
      output += `  ${timeStr}\n`;
      output += `  ID: ${reminder.id}\n\n`;
    }

    return output.trim();
  }
});

export const cancelReminderTool = defineTool('cancel_reminder', {
  description: 'Cancel a reminder by ID or message match',
  parameters: p({
    id: z.string().optional().describe('Reminder ID to cancel'),
    message: z.string().optional().describe('Cancel reminder matching this message'),
  }),
  handler: async ({ id, message }) => {
    if (!id && !message) {
      return 'Error: Please provide either a reminder ID or message to cancel';
    }

    if (id) {
      const success = reminderManager.cancelReminder(id);
      return success ? `Reminder ${id} cancelled.` : `Reminder ${id} not found.`;
    }

    if (message) {
      const reminders = reminderManager.getAllReminders();
      const matching = reminders.filter(r =>
        r.message.toLowerCase().includes(message.toLowerCase()) && !r.completed
      );

      if (matching.length === 0) {
        return `No reminders found matching "${message}"`;
      }

      let cancelled = 0;
      for (const reminder of matching) {
        if (reminderManager.cancelReminder(reminder.id)) {
          cancelled++;
        }
      }

      return `Cancelled ${cancelled} reminder${cancelled !== 1 ? 's' : ''} matching "${message}".`;
    }

    return 'Error: Could not cancel reminder';
  }
});

// ============================================================================
// Shell Command Tool
// ============================================================================

export const shellTool = defineTool('run_shell_command', {
  description: 'Execute a shell command. Examples: "Run ls -la", "Execute ping google.com -c 4", "Run echo Hello World"',
  parameters: p({
    command: z.string().describe('Shell command to execute'),
  }),
  handler: async ({ command }) => {
    const decision = await requestPermissionForTool('run_shell_command', { command }, [
      `Command: ${command}`,
    ]);
    if (!decision.allowed) {
      return 'Cancelled: permission denied.';
    }

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      let output = stdout.trim();
      if (stderr) {
        output += output ? '\n\n' + stderr.trim() : stderr.trim();
      }

      if (!output) {
        return `Command executed successfully (no output)`;
      }

      // Limit output size
      if (output.length > 5000) {
        output = output.substring(0, 5000) + '\n\n...(output truncated)';
      }

      return output;
    } catch (error: any) {
      return `Error executing command: ${error.message || error}`;
    }
  }
});

// ============================================================================
// Media Control Tools
// ============================================================================

export const mediaPlayTool = defineTool('media_play', {
  description: 'Play or resume media playback (works with Spotify, VLC, YouTube, etc.)',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.mediaPlay();
    return result.success
      ? 'Media playback started'
      : `Failed to play media: ${result.error}`;
  }
});

export const mediaPauseTool = defineTool('media_pause', {
  description: 'Pause media playback',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.mediaPause();
    return result.success
      ? 'Media paused'
      : `Failed to pause media: ${result.error}`;
  }
});

// Media control tools moved to line ~3000 (using WindowsMedia class directly)

// ============================================================================
// Browser Automation Tools
// ============================================================================

export const browserOpenTool = defineTool('browser_open', {
  description: 'Open a URL in the default web browser',
  parameters: p({
    url: z.string().describe('The URL to open (e.g., "google.com", "https://github.com")'),
    browser: z.string().optional().describe('Specific browser to use (chrome, firefox, edge, brave)')
  }),
  handler: async ({ url, browser }) => {
    const result = await adapter.browserOpenUrl({ url, browser });
    return result.success
      ? `Opened ${url} in ${browser || 'default'} browser`
      : `Failed to open URL: ${result.error}`;
  }
});

export const browserSearchTool = defineTool('browser_search', {
  description: 'Search the web using a search engine',
  parameters: p({
    query: z.string().describe('The search query'),
    engine: z.enum(['google', 'bing', 'duckduckgo', 'youtube', 'github']).optional().describe('Search engine to use (default: google)')
  }),
  handler: async ({ query, engine }) => {
    const result = await adapter.browserSearch({ query, engine });
    return result.success
      ? `Searching for "${query}" on ${engine || 'google'}`
      : `Failed to search: ${result.error}`;
  }
});

export const browserNewTabTool = defineTool('browser_new_tab', {
  description: 'Open a new browser tab, optionally with a URL',
  parameters: p({
    url: z.string().optional().describe('URL to open in the new tab')
  }),
  handler: async ({ url }) => {
    const result = await adapter.browserNewTab({ url });
    return result.success
      ? url ? `Opened new tab with ${url}` : 'Opened new tab'
      : `Failed to open new tab: ${result.error}`;
  }
});

export const browserCloseTabTool = defineTool('browser_close_tab', {
  description: 'Close the current browser tab',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.browserCloseTab();
    return result.success
      ? 'Closed current tab'
      : `Failed to close tab: ${result.error}`;
  }
});

export const browserNextTabTool = defineTool('browser_next_tab', {
  description: 'Switch to the next browser tab',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.browserNextTab();
    return result.success
      ? 'Switched to next tab'
      : `Failed to switch tab: ${result.error}`;
  }
});

export const browserPrevTabTool = defineTool('browser_prev_tab', {
  description: 'Switch to the previous browser tab',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.browserPreviousTab();
    return result.success
      ? 'Switched to previous tab'
      : `Failed to switch tab: ${result.error}`;
  }
});

export const browserRefreshTool = defineTool('browser_refresh', {
  description: 'Refresh the current browser page',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.browserRefresh();
    return result.success
      ? 'Refreshed page'
      : `Failed to refresh: ${result.error}`;
  }
});

export const browserBookmarkTool = defineTool('browser_bookmark', {
  description: 'Bookmark the current page in the browser',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.browserBookmark();
    return result.success
      ? 'Bookmarked current page'
      : `Failed to bookmark: ${result.error}`;
  }
});

// ============================================================================
// Email Tools
// ============================================================================

export const emailComposeTool = defineTool('email_compose', {
  description: 'Compose a new email using the default mail client',
  parameters: p({
    to: z.string().optional().describe('Recipient email address'),
    cc: z.string().optional().describe('CC recipients'),
    bcc: z.string().optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Email subject'),
    body: z.string().optional().describe('Email body text')
  }),
  handler: async ({ to, cc, bcc, subject, body }) => {
    const result = await adapter.emailCompose({ to, cc, bcc, subject, body });
    if (!result.success) {
      return `Failed to compose email: ${result.error}`;
    }
    let msg = 'Opened email composer';
    if (to) msg += ` to ${to}`;
    if (subject) msg += ` with subject "${subject}"`;
    return msg;
  }
});

export const emailOpenTool = defineTool('email_open', {
  description: 'Open the default email client/inbox',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.emailOpen();
    return result.success
      ? 'Opened email client'
      : `Failed to open email: ${result.error}`;
  }
});

// ============================================================================
// OCR & Annotation Tools
// ============================================================================

export const ocrExtractTool = defineTool('ocr_extract', {
  description: 'Extract text from an image file using OCR (Windows 10/11 built-in)',
  parameters: p({
    imagePath: z.string().describe('Path to the image file (PNG, JPG, BMP)')
  }),
  handler: async ({ imagePath }) => {
    const result = await adapter.ocrExtractText({ imagePath });
    if (!result.success) {
      return `Failed to extract text: ${result.error}`;
    }
    const text = result.data?.text || '';
    if (!text) {
      return 'No text found in image';
    }
    return `Extracted text:\n\n${text}`;
  }
});

export const ocrClipboardTool = defineTool('ocr_clipboard', {
  description: 'Extract text from an image currently in the clipboard',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.ocrExtractFromClipboard();
    if (!result.success) {
      return `Failed to extract text from clipboard: ${result.error}`;
    }
    const text = result.data?.text || '';
    if (!text) {
      return 'No text found in clipboard image';
    }
    return `Extracted text from clipboard:\n\n${text}`;
  }
});

export const ocrRegionTool = defineTool('ocr_region', {
  description: 'Capture a screen region and extract text from it',
  parameters: p({}),
  handler: async () => {
    const result = await adapter.ocrExtractFromRegion();
    if (!result.success) {
      return `Failed to extract text from region: ${result.error}`;
    }
    const text = result.data?.text || '';
    if (!text) {
      return 'No text found in selected region';
    }
    return `Extracted text from region:\n\n${text}`;
  }
});

export const screenshotAnnotateTool = defineTool('screenshot_annotate', {
  description: 'Add annotations (rectangles, arrows, text, highlights) to a screenshot',
  parameters: p({
    imagePath: z.string().describe('Path to the screenshot file'),
    annotations: z.array(z.object({
      type: z.enum(['rectangle', 'arrow', 'text', 'highlight']).describe('Annotation type'),
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      width: z.number().optional().describe('Width (for rectangle/highlight)'),
      height: z.number().optional().describe('Height (for rectangle/highlight)'),
      endX: z.number().optional().describe('End X (for arrow)'),
      endY: z.number().optional().describe('End Y (for arrow)'),
      color: z.string().optional().describe('Color name (Red, Blue, Green, Yellow, etc.)'),
      text: z.string().optional().describe('Text content (for text annotation)'),
      thickness: z.number().optional().describe('Line thickness')
    })).describe('Array of annotations to add')
  }),
  handler: async ({ imagePath, annotations }) => {
    const result = await adapter.screenshotAnnotate({ imagePath, annotations });
    if (!result.success) {
      return `Failed to annotate screenshot: ${result.error}`;
    }
    return `Annotated screenshot saved to: ${result.data?.path}`;
  }
});

// ============================================================================
// Recording Tools (FFmpeg-based)
// ============================================================================

export const screenRecordStartTool = defineTool('screen_record_start', {
  description: 'Start recording the screen. Optionally capture audio from system or microphone. Can record full screen or a specific region.',
  parameters: p({
    audioSource: z.enum(['none', 'system', 'microphone']).optional()
      .describe('Audio source: none, system (desktop audio), or microphone'),
    fps: z.number().optional().describe('Frames per second (default: 30, options: 15, 30, 60)'),
    region: z.object({
      x: z.number().describe('X offset of the capture region'),
      y: z.number().describe('Y offset of the capture region'),
      width: z.number().describe('Width of the capture region'),
      height: z.number().describe('Height of the capture region')
    }).optional().describe('Capture a specific screen region instead of full screen'),
    filename: z.string().optional().describe('Custom filename for the recording (default: screen_timestamp.mp4)')
  }),
  handler: async ({ audioSource, fps, region, filename }) => {
    // Check FFmpeg availability
    const ffmpegStatus = recordingManager.getFFmpegStatus();
    if (!ffmpegStatus.available) {
      return `Recording is not available: ${ffmpegStatus.error}`;
    }

    // Request permission
    const permissionGranted = await requestPermissionForTool('screen_record_start', {
      audioSource: audioSource || 'system',
      fps: fps || 30,
      region: region ? `${region.width}x${region.height} at (${region.x}, ${region.y})` : 'full screen'
    });

    if (!permissionGranted) {
      return 'Permission denied for screen recording';
    }

    try {
      const options: RecordingOptions = {
        audioSource: audioSource ? (audioSource as AudioSource) : AudioSource.SYSTEM,
        fps: fps || 30,
        region,
        filename
      };

      const recording = await recordingManager.startScreenRecording(options);
      return JSON.stringify({
        success: true,
        message: 'Screen recording started',
        id: recording.id,
        outputPath: recording.outputPath,
        fps: recording.fps,
        audioSource: recording.audioSource,
        region: recording.region || 'full screen'
      });
    } catch (error) {
      return `Failed to start screen recording: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

export const screenRecordStopTool = defineTool('screen_record_stop', {
  description: 'Stop the current screen recording and save the video file',
  parameters: p({}),
  handler: async () => {
    try {
      const recording = await recordingManager.stopRecording(RecordingType.SCREEN);
      if (!recording) {
        return 'No active screen recording to stop';
      }

      return JSON.stringify({
        success: true,
        message: 'Screen recording stopped',
        id: recording.id,
        outputPath: recording.outputPath,
        duration: `${recording.duration.toFixed(1)} seconds`,
        fileSize: formatFileSize(recording.fileSize)
      });
    } catch (error) {
      return `Failed to stop screen recording: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

export const screenRecordStatusTool = defineTool('screen_record_status', {
  description: 'Get the current status of screen recording (is recording active, duration, file size)',
  parameters: p({}),
  handler: async () => {
    const ffmpegStatus = recordingManager.getFFmpegStatus();
    if (!ffmpegStatus.available) {
      return JSON.stringify({
        ffmpegAvailable: false,
        error: ffmpegStatus.error,
        recording: null
      });
    }

    const recording = recordingManager.getStatus(RecordingType.SCREEN);
    if (!recording) {
      return JSON.stringify({
        ffmpegAvailable: true,
        recording: null,
        message: 'No active screen recording'
      });
    }

    return JSON.stringify({
      ffmpegAvailable: true,
      recording: {
        id: recording.id,
        status: recording.status,
        duration: `${recording.duration.toFixed(1)} seconds`,
        fileSize: formatFileSize(recording.fileSize),
        outputPath: recording.outputPath,
        audioSource: recording.audioSource,
        fps: recording.fps
      }
    });
  }
});

export const audioRecordStartTool = defineTool('audio_record_start', {
  description: 'Start audio-only recording from microphone or system audio',
  parameters: p({
    source: z.enum(['system', 'microphone']).optional()
      .describe('Audio source: system (desktop audio) or microphone (default: microphone)'),
    format: z.enum(['mp3', 'wav', 'aac']).optional()
      .describe('Audio format: mp3, wav, or aac (default: mp3)'),
    filename: z.string().optional().describe('Custom filename for the recording')
  }),
  handler: async ({ source, format, filename }) => {
    // Check FFmpeg availability
    const ffmpegStatus = recordingManager.getFFmpegStatus();
    if (!ffmpegStatus.available) {
      return `Recording is not available: ${ffmpegStatus.error}`;
    }

    // Request permission
    const permissionGranted = await requestPermissionForTool('audio_record_start', {
      source: source || 'microphone',
      format: format || 'mp3'
    });

    if (!permissionGranted) {
      return 'Permission denied for audio recording';
    }

    try {
      const options: RecordingOptions = {
        audioSource: source === 'system' ? AudioSource.SYSTEM : AudioSource.MICROPHONE,
        format: format || 'mp3',
        filename
      };

      const recording = await recordingManager.startAudioRecording(options);
      return JSON.stringify({
        success: true,
        message: 'Audio recording started',
        id: recording.id,
        outputPath: recording.outputPath,
        audioSource: recording.audioSource
      });
    } catch (error) {
      return `Failed to start audio recording: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

export const audioRecordStopTool = defineTool('audio_record_stop', {
  description: 'Stop the current audio recording and save the audio file',
  parameters: p({}),
  handler: async () => {
    try {
      const recording = await recordingManager.stopRecording(RecordingType.AUDIO);
      if (!recording) {
        return 'No active audio recording to stop';
      }

      return JSON.stringify({
        success: true,
        message: 'Audio recording stopped',
        id: recording.id,
        outputPath: recording.outputPath,
        duration: `${recording.duration.toFixed(1)} seconds`,
        fileSize: formatFileSize(recording.fileSize)
      });
    } catch (error) {
      return `Failed to stop audio recording: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ============================================================================
// Notes Tools
// ============================================================================

const createNoteTool = defineTool('notes_create', {
  description: 'Create a new note with a title and optional content',
  parameters: p({
    title: z.string().describe('Title of the note'),
    content: z.string().optional().describe('Content/body of the note'),
  }),
  handler: async ({ title, content }) => {
    const note = createNote(title, content);
    return `Created note "${note.title}" (ID: ${note.id})`;
  },
});

const listNotesTool = defineTool('notes_list', {
  description: 'List all notes, optionally limited to a count',
  parameters: p({
    limit: z.number().optional().describe('Max notes to return (default 20)'),
  }),
  handler: async ({ limit }) => {
    const notes = listNotes(limit || 20);
    if (notes.length === 0) return 'No notes found.';
    return notes.map(n => `- [${n.id}] ${n.title} (${new Date(n.updated_at * 1000).toLocaleDateString()})`).join('\n');
  },
});

const getNoteTool = defineTool('notes_get', {
  description: 'Get a note by ID',
  parameters: p({
    id: z.string().describe('Note ID'),
  }),
  handler: async ({ id }) => {
    const note = getNote(id);
    if (!note) return `Note ${id} not found.`;
    return `Title: ${note.title}\nContent: ${note.content}\nCreated: ${new Date(note.created_at * 1000).toLocaleString()}\nUpdated: ${new Date(note.updated_at * 1000).toLocaleString()}`;
  },
});

const updateNoteTool = defineTool('notes_update', {
  description: 'Update a note title and/or content',
  parameters: p({
    id: z.string().describe('Note ID'),
    title: z.string().optional().describe('New title'),
    content: z.string().optional().describe('New content'),
  }),
  handler: async ({ id, title, content }) => {
    const note = updateNote(id, title, content);
    if (!note) return `Note ${id} not found.`;
    return `Updated note "${note.title}"`;
  },
});

const searchNotesTool = defineTool('notes_search', {
  description: 'Search notes by title or content',
  parameters: p({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Max results (default 10)'),
  }),
  handler: async ({ query, limit }) => {
    const notes = searchNotes(query, limit || 10);
    if (notes.length === 0) return `No notes matching "${query}".`;
    return notes.map(n => `- [${n.id}] ${n.title}`).join('\n');
  },
});

const deleteNoteTool = defineTool('notes_delete', {
  description: 'Delete a note by ID',
  parameters: p({
    id: z.string().describe('Note ID'),
  }),
  handler: async ({ id }) => {
    const success = deleteNote(id);
    return success ? `Deleted note ${id}.` : `Note ${id} not found.`;
  },
});

const deleteAllNotesTool = defineTool('notes_delete_all', {
  description: 'Delete all notes. Requires user confirmation.',
  parameters: p({}),
  handler: async () => {
    const permitted = await requestPermissionForTool('notes_delete_all', {}, ['Delete ALL notes permanently', 'This action cannot be undone']);
    if (!permitted) return 'User denied permission to delete all notes.';
    const count = deleteAllNotes();
    return `Deleted ${count} notes.`;
  },
});

// ============================================================================
// Todo Tools
// ============================================================================

const createTodoTool = defineTool('todos_create', {
  description: 'Create a new todo item',
  parameters: p({
    text: z.string().describe('Todo text'),
  }),
  handler: async ({ text }) => {
    const todo = createTodo(text);
    return `Created todo: "${todo.text}" (ID: ${todo.id})`;
  },
});

const listTodosTool = defineTool('todos_list', {
  description: 'List todos, optionally filtered by status',
  parameters: p({
    filter: z.enum(['all', 'active', 'completed']).optional().describe('Filter: all, active, or completed (default: all)'),
  }),
  handler: async ({ filter }) => {
    const todos = listTodos(filter || 'all');
    if (todos.length === 0) return `No ${filter || ''} todos found.`;
    return todos.map(t => `- [${t.completed ? 'x' : ' '}] ${t.text} (${t.id})`).join('\n');
  },
});

const completeTodoTool = defineTool('todos_complete', {
  description: 'Mark a todo as completed',
  parameters: p({
    id: z.string().describe('Todo ID'),
  }),
  handler: async ({ id }) => {
    const todo = completeTodo(id);
    if (!todo) return `Todo ${id} not found.`;
    return `Completed: "${todo.text}"`;
  },
});

const deleteTodoTool = defineTool('todos_delete', {
  description: 'Delete a todo item',
  parameters: p({
    id: z.string().describe('Todo ID'),
  }),
  handler: async ({ id }) => {
    const success = deleteTodo(id);
    return success ? `Deleted todo ${id}.` : `Todo ${id} not found.`;
  },
});

// ============================================================================
// URL Fetch Tool
// ============================================================================

const fetchUrlTool = defineTool('web_fetch_url', {
  description: 'Fetch a web page and return its text content. Use this to look up information from URLs.',
  parameters: p({
    url: z.string().describe('The URL to fetch'),
    max_length: z.number().optional().describe('Max characters to return (default 2000)'),
  }),
  handler: async ({ url, max_length }) => {
    const result = await fetchUrl(url, max_length);
    if (!result.success) {
      return `Failed to fetch ${url}: ${result.error}`;
    }
    const parts = [];
    if (result.title) parts.push(`Title: ${result.title}`);
    parts.push(`URL: ${result.url}`);
    if (result.contentLength && result.contentLength > (max_length || 2000)) {
      parts.push(`(Showing first ${max_length || 2000} of ${result.contentLength} characters)`);
    }
    parts.push('');
    parts.push(result.content || '(No content)');
    return parts.join('\n');
  },
});

// ============================================================================
// Text-to-Speech Tools
// ============================================================================

const speakTextTool = defineTool('speak_text', {
  description: 'Speak text aloud using system text-to-speech. Works offline, no API key needed.',
  parameters: p({
    text: z.string().describe('The text to speak aloud'),
    voice: z.string().optional().describe('Voice name (use list_voices to see options)'),
    rate: z.number().optional().describe('Speech rate from -10 (slowest) to 10 (fastest). Default 0.'),
    volume: z.number().optional().describe('Volume 0-100. Default 100.'),
  }),
  handler: async ({ text, voice, rate, volume }) => {
    const options: TTSOptions = {};
    if (voice) options.voice = voice;
    if (rate !== undefined) options.rate = rate;
    if (volume !== undefined) options.volume = volume;
    const success = await speak(text, options);
    return success ? `Spoke: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"` : 'Failed to speak text.';
  },
});

const stopSpeakingTool = defineTool('stop_speaking', {
  description: 'Stop any ongoing text-to-speech playback',
  parameters: p({}),
  handler: async () => {
    await stopSpeaking();
    return 'Speech stopped.';
  },
});

const listVoicesTool = defineTool('list_voices', {
  description: 'List available text-to-speech voices on this system',
  parameters: p({}),
  handler: async () => {
    const voices = await listVoices();
    if (voices.length === 0) return 'No TTS voices found.';
    return voices.map(v => `- ${v.name} (${v.culture}, ${v.gender})`).join('\n');
  },
});

// ============================================================================
// Utility Tools (Weather, Unit Converter)
// ============================================================================

const getWeatherTool = defineTool('weather_get', {
  description: 'Get current weather and forecast for a location',
  parameters: p({
    location: z.string().describe('City name, e.g. "London", "New York", "Tokyo"'),
    detailed: z.boolean().optional().describe('Show 3-day forecast (default: brief current conditions)'),
  }),
  handler: async ({ location, detailed }) => {
    return await fetchWeather(location, detailed || false);
  },
});

const convertUnitTool = defineTool('convert_unit', {
  description: 'Convert between units of measurement (length, weight, temperature, volume, area, speed)',
  parameters: p({
    value: z.number().describe('The numeric value to convert'),
    from: z.string().describe('Source unit (e.g. "km", "lb", "celsius", "gallon")'),
    to: z.string().describe('Target unit (e.g. "miles", "kg", "fahrenheit", "liter")'),
  }),
  handler: async ({ value, from, to }) => {
    const result = convertUnit(value, from, to);
    if (result.error) return result.error;
    return `${value} ${from} = ${result.value} ${to}`;
  },
});

// ============================================================================
// Music/Media Control Tools
// ============================================================================

export const mediaPlayPauseTool = defineTool('media_play_pause', {
  description: 'Toggle play/pause on the current media player (Spotify, browser music, etc.)',
  parameters: p({}),
  handler: async () => {
    const success = await windowsMedia.playPause();
    if (!success) return 'Failed to send play/pause command.';
    await new Promise(r => setTimeout(r, 500));
    const status = await windowsMedia.getStatus();
    return status.title
      ? `${status.isPlaying ? 'Playing' : 'Paused'}: ${status.title}${status.artist ? ` by ${status.artist}` : ''}`
      : `Media ${status.isPlaying ? 'playing' : 'paused'}.`;
  },
});

export const mediaNextTool = defineTool('media_next_track', {
  description: 'Skip to the next track',
  parameters: p({}),
  handler: async () => {
    const success = await windowsMedia.nextTrack();
    if (!success) return 'Failed to skip track.';
    await new Promise(r => setTimeout(r, 1000));
    const status = await windowsMedia.getStatus();
    return status.title ? `Now playing: ${status.title}${status.artist ? ` by ${status.artist}` : ''}` : 'Skipped to next track.';
  },
});

export const mediaPreviousTool = defineTool('media_previous_track', {
  description: 'Go to the previous track',
  parameters: p({}),
  handler: async () => {
    const success = await windowsMedia.previousTrack();
    if (!success) return 'Failed to go back.';
    await new Promise(r => setTimeout(r, 1000));
    const status = await windowsMedia.getStatus();
    return status.title ? `Now playing: ${status.title}${status.artist ? ` by ${status.artist}` : ''}` : 'Went to previous track.';
  },
});

export const mediaStatusTool = defineTool('media_status', {
  description: 'Get current media playback status (track name, artist, play state)',
  parameters: p({}),
  handler: async () => {
    const status = await windowsMedia.getStatus();
    if (!status.title && !status.isPlaying) return 'No media is currently playing.';
    const parts = [];
    parts.push(`Status: ${status.isPlaying ? 'Playing' : 'Paused'}`);
    if (status.title) parts.push(`Title: ${status.title}`);
    if (status.artist) parts.push(`Artist: ${status.artist}`);
    if (status.album) parts.push(`Album: ${status.album}`);
    if (status.app) parts.push(`App: ${status.app}`);
    return parts.join('\n');
  },
});

export const mediaStopTool = defineTool('media_stop', {
  description: 'Stop media playback',
  parameters: p({}),
  handler: async () => {
    const success = await windowsMedia.stop();
    return success ? 'Media stopped.' : 'Failed to stop media.';
  },
});

// ============================================================================
// Export all tools
// ============================================================================

export const desktopCommanderTools = [
  // Window Management
  windowListTool,
  windowFocusTool,
  windowResizeTool,
  windowMoveTool,
  windowCloseTool,
  windowMinimizeTool,
  windowMaximizeTool,
  windowArrangeTool,
  windowHideFromSharingTool,
  windowShowInSharingTool,
  windowListHiddenTool,
  windowHideAllSensitiveTool,
  // File System
  filesListTool,
  filesSearchTool,
  filesMoveTool,
  filesCopyTool,
  filesDeleteTool,
  filesRenameTool,
  filesCreateFolderTool,
  filesReadTool,
  filesInfoTool,
  filesWriteTool,
  // Applications
  appsListTool,
  appsLaunchTool,
  appsQuitTool,
  appsSwitchTool,
  // System Control
  systemVolumeTool,
  systemBrightnessTool,
  systemScreenshotTool,
  systemDndTool,
  systemLockTool,
  systemSleepTool,
  wifiControlTool,
  // Productivity
  productivityTimerTool,
  productivityCountdownTool,
  productivityPomodoroTool,
  productivityWorldClockTool,
  productivityConvertTool,
  // Reminders
  setReminderTool,
  listRemindersTool,
  cancelReminderTool,
  // Shell
  shellTool,
  // Processes
  processListTool,
  processInfoTool,
  processKillTool,
  processTopTool,
  // Clipboard
  clipboardReadTool,
  clipboardWriteTool,
  clipboardClearTool,
  clipboardHistoryTool,
  clipboardRestoreTool,
  // Office
  officeCreateTool,
  powerpointCreateTool,
  // System Information
  systemInfoTool,
  // Network
  networkInfoTool,
  networkTestTool,
  // Services
  serviceListTool,
  serviceControlTool,
  // Web Search
  webSearchTool,
  // Troubleshooting
  troubleshootStartTool,
  troubleshootProposeFix,
  // Media Control
  mediaPlayTool,
  mediaPauseTool,
  mediaPlayPauseTool,
  mediaNextTool,
  mediaPreviousTool,
  mediaStopTool,
  // Browser Automation
  browserOpenTool,
  browserSearchTool,
  browserNewTabTool,
  browserCloseTabTool,
  browserNextTabTool,
  browserPrevTabTool,
  browserRefreshTool,
  browserBookmarkTool,
  // Email
  emailComposeTool,
  emailOpenTool,
  // OCR & Annotation
  ocrExtractTool,
  ocrClipboardTool,
  ocrRegionTool,
  screenshotAnnotateTool,
  // Recording (FFmpeg-based)
  screenRecordStartTool,
  screenRecordStopTool,
  screenRecordStatusTool,
  audioRecordStartTool,
  audioRecordStopTool,
  // Notes
  createNoteTool,
  listNotesTool,
  getNoteTool,
  updateNoteTool,
  searchNotesTool,
  deleteNoteTool,
  deleteAllNotesTool,
  // Todos
  createTodoTool,
  listTodosTool,
  completeTodoTool,
  deleteTodoTool,
  // URL Fetch
  fetchUrlTool,
  // Text-to-Speech
  speakTextTool,
  stopSpeakingTool,
  listVoicesTool,
  // Utilities
  getWeatherTool,
  convertUnitTool,
  // Media Control
  mediaPlayPauseTool,
  mediaNextTool,
  mediaPreviousTool,
  mediaStatusTool,
  mediaStopTool,
];
