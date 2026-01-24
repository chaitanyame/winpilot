// Tool Definitions for Copilot using GitHub Copilot SDK

import { defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import { getUnifiedAdapter } from '../platform/unified-adapter';
import { logger } from '../utils/logger';
import { p } from '../utils/zod-wrapper';
import { requestPermissionForTool } from '../main/permission-gate';

const adapter = getUnifiedAdapter();

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
        isFocused: w.isFocused
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
    return `Brightness set to ${level}%`;
  }
});

export const systemScreenshotTool = defineTool('system_screenshot', {
  description: 'Take a screenshot',
  parameters: p({
    region: z.enum(['fullscreen', 'window', 'selection']).optional().describe('Region to capture'),
    savePath: z.string().optional().describe('Directory to save the screenshot'),
    filename: z.string().optional().describe('Filename for the screenshot')
  }),
  handler: async ({ region, savePath, filename }) => {
    const result = await adapter.takeScreenshot({ region, savePath, filename });
    return result.success
      ? `Screenshot saved to ${result.data?.path}`
      : `Failed to take screenshot: ${result.error}`;
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
  // Processes
  processListTool,
  processInfoTool,
  processKillTool,
  processTopTool,
  // Clipboard
  clipboardReadTool,
  clipboardWriteTool,
  clipboardClearTool,
  // Office
  officeCreateTool,
  powerpointCreateTool
];
