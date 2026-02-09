// Electron Store for Settings

import Store from 'electron-store';
import { Settings, ScheduledTask, TaskLog, Timer, ClipboardEntry } from '../shared/types';
import { DEFAULT_SETTINGS, getDefaultMcpServers } from '../shared/constants';
import { StoredMCPServer, MCPServerConfig } from '../shared/mcp-types';

interface StoreSchema {
  settings: Settings;
  history: Array<{
    id: string;
    input: string;
    timestamp: number;
  }>;
  permissions: Record<string, {
    allowed: boolean;
    timestamp: number;
  }>;
  mcpServers: StoredMCPServer[];
  scheduledTasks: ScheduledTask[];
  taskLogs: TaskLog[];
  activeTimers: Timer[];
  clipboardHistory: ClipboardEntry[];
}

let store: Store<StoreSchema>;

/**
 * Initialize the electron store
 */
export function initStore(): Store<StoreSchema> {
  store = new Store<StoreSchema>({
    name: 'desktop-commander-config',
    defaults: {
      settings: DEFAULT_SETTINGS,
      history: [],
      permissions: {},
      mcpServers: [],
      scheduledTasks: [],
      taskLogs: [],
      activeTimers: [],
      clipboardHistory: [],
    },
  });

  // Auto-add default MCP servers if not present
  ensureDefaultMcpServers();

  return store;
}

/**
 * Ensure default MCP servers are added to the store
 * This runs on every app start, but only adds servers that don't already exist
 */
function ensureDefaultMcpServers(): void {
  const existing = getMcpServers();
  const existingIds = new Set(existing.map(s => s.id));
  let added = false;

  const defaultServers = getDefaultMcpServers(); // Get fresh copy each time

  for (const defaultServer of defaultServers) {
    if (!existingIds.has(defaultServer.id)) {
      existing.push(defaultServer);
      added = true;
    }
  }

  if (added) {
    store.set('mcpServers', existing);
    console.log('Added default MCP servers');
  }
}

/**
 * Get application settings with migration support
 */
export function getSettings(): Settings {
  if (!store) initStore();
  const settings = store.get('settings', DEFAULT_SETTINGS);

  // Migrate old settings to include new properties
  let needsUpdate = false;

  if (!settings.notifications) {
    settings.notifications = DEFAULT_SETTINGS.notifications;
    needsUpdate = true;
  }

  if (!settings.scheduledTasks) {
    settings.scheduledTasks = DEFAULT_SETTINGS.scheduledTasks;
    needsUpdate = true;
  }

  if (!settings.voiceInput) {
    settings.voiceInput = DEFAULT_SETTINGS.voiceInput;
    needsUpdate = true;
  }

  if (!settings.appearanceMode) {
    const legacyTheme = (settings as { theme?: Settings['appearanceMode'] }).theme;
    settings.appearanceMode = legacyTheme || DEFAULT_SETTINGS.appearanceMode;
    needsUpdate = true;
  }

  if (!settings.themeId) {
    settings.themeId = DEFAULT_SETTINGS.themeId;
    needsUpdate = true;
  }

  if (!settings.screenSharePrivacy) {
    settings.screenSharePrivacy = DEFAULT_SETTINGS.screenSharePrivacy;
    needsUpdate = true;
  }

  // Migrate browser provider to local_whisper (browser doesn't work in Electron)
  if (settings.voiceInput?.provider === 'browser') {
    settings.voiceInput.provider = 'local_whisper';
    needsUpdate = true;
  }

  // Ensure localWhisper config exists
  if (!settings.voiceInput?.localWhisper) {
    settings.voiceInput.localWhisper = DEFAULT_SETTINGS.voiceInput.localWhisper;
    needsUpdate = true;
  }

  // Ensure openaiWhisper config exists.
  if (!settings.voiceInput?.openaiWhisper) {
    settings.voiceInput.openaiWhisper = DEFAULT_SETTINGS.voiceInput.openaiWhisper;
    needsUpdate = true;
  }

  // Remove old whisperCpp/fasterWhisper config if it exists
  if (settings.voiceInput && ('whisperCpp' in settings.voiceInput || 'fasterWhisper' in settings.voiceInput)) {
    delete (settings.voiceInput as any).whisperCpp;
    delete (settings.voiceInput as any).fasterWhisper;
    needsUpdate = true;
  }

  if (settings.ui?.menuBarMode === undefined) {
    settings.ui.menuBarMode = DEFAULT_SETTINGS.ui.menuBarMode;
    needsUpdate = true;
  }

  if (settings.ui?.onboardingSeen === undefined) {
    settings.ui.onboardingSeen = DEFAULT_SETTINGS.ui.onboardingSeen;
    needsUpdate = true;
  }

  if (!settings.recording) {
    settings.recording = DEFAULT_SETTINGS.recording;
    needsUpdate = true;
  }

  // Add hotkeys section if missing
  if (!settings.hotkeys) {
    settings.hotkeys = DEFAULT_SETTINGS.hotkeys;
    needsUpdate = true;
  }

  // Migrate voiceCommand from C to G and add chat hotkey if missing
  if (settings.hotkeys) {
    let hotkeysUpdated = false;

    // Add chat hotkey if missing
    if (!settings.hotkeys.chat) {
      settings.hotkeys.chat = DEFAULT_SETTINGS.hotkeys.chat;
      hotkeysUpdated = true;
    }

    // Migrate voiceCommand from C to G
    if (settings.hotkeys.voiceCommand === 'CommandOrControl+Shift+C') {
      settings.hotkeys.voiceCommand = DEFAULT_SETTINGS.hotkeys.voiceCommand;
      hotkeysUpdated = true;
    }

    if (hotkeysUpdated) {
      needsUpdate = true;
    }
  }

  // Add contextAwareness section if missing
  if (!settings.contextAwareness) {
    settings.contextAwareness = DEFAULT_SETTINGS.contextAwareness;
    needsUpdate = true;
  }

  if (needsUpdate) {
    store.set('settings', settings);
  }

  return settings;
}

/**
 * Update application settings
 */
export function setSettings(settings: Partial<Settings>): Settings {
  if (!store) initStore();
  const current = getSettings();
  const updated = { ...current, ...settings };
  store.set('settings', updated);
  return updated;
}

/**
 * Get command history
 */
export function getHistory(): StoreSchema['history'] {
  if (!store) initStore();
  return store.get('history', []);
}

/**
 * Add to command history
 */
export function addToHistory(input: string): void {
  if (!store) initStore();
  const history = getHistory();
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add new entry at the beginning
  history.unshift({ id, input, timestamp: Date.now() });
  
  // Keep only last 100 entries
  if (history.length > 100) {
    history.pop();
  }
  
  store.set('history', history);
}

/**
 * Clear command history
 */
export function clearHistory(): void {
  if (!store) initStore();
  store.set('history', []);
}

/**
 * Get saved permission for a tool
 */
export function getSavedPermission(toolName: string): boolean | null {
  if (!store) initStore();
  const permissions = store.get('permissions', {});
  const permission = permissions[toolName];
  
  if (!permission) return null;
  
  // Permissions expire after 24 hours
  const expiryTime = 24 * 60 * 60 * 1000;
  if (Date.now() - permission.timestamp > expiryTime) {
    return null;
  }
  
  return permission.allowed;
}

/**
 * Save permission decision
 */
export function savePermission(toolName: string, allowed: boolean): void {
  if (!store) initStore();
  const permissions = store.get('permissions', {});
  permissions[toolName] = { allowed, timestamp: Date.now() };
  store.set('permissions', permissions);
}

/**
 * Clear saved permissions
 */
export function clearPermissions(): void {
  if (!store) initStore();
  store.set('permissions', {});
}

/**
 * Get the raw store instance
 */
export function getStore(): Store<StoreSchema> {
  if (!store) initStore();
  return store;
}

/**
 * Get all MCP servers
 */
export function getMcpServers(): StoredMCPServer[] {
  if (!store) initStore();
  return store.get('mcpServers', []);
}

/**
 * Get enabled MCP servers
 */
export function getEnabledMcpServers(): StoredMCPServer[] {
  return getMcpServers().filter(s => s.config.enabled);
}

/**
 * Add a new MCP server
 */
export function addMcpServer(config: MCPServerConfig): StoredMCPServer {
  if (!store) initStore();
  const servers = getMcpServers();
  const id = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  const newServer: StoredMCPServer = {
    id,
    config,
    createdAt: now,
    updatedAt: now,
  };
  servers.push(newServer);
  store.set('mcpServers', servers);
  return newServer;
}

/**
 * Update an existing MCP server
 */
export function updateMcpServer(id: string, config: Partial<MCPServerConfig>): StoredMCPServer | null {
  if (!store) initStore();
  const servers = getMcpServers();
  const index = servers.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  servers[index] = {
    ...servers[index],
    config: { ...servers[index].config, ...config } as MCPServerConfig,
    updatedAt: Date.now(),
  };
  store.set('mcpServers', servers);
  return servers[index];
}

/**
 * Delete an MCP server
 */
export function deleteMcpServer(id: string): boolean {
  if (!store) initStore();
  const servers = getMcpServers();
  const index = servers.findIndex(s => s.id === id);
  if (index === -1) return false;
  
  servers.splice(index, 1);
  store.set('mcpServers', servers);
  return true;
}

/**
 * Toggle MCP server enabled state
 */
export function toggleMcpServer(id: string): StoredMCPServer | null {
  if (!store) initStore();
  const servers = getMcpServers();
  const index = servers.findIndex(s => s.id === id);
  if (index === -1) return null;

  servers[index].config.enabled = !servers[index].config.enabled;
  servers[index].updatedAt = Date.now();
  store.set('mcpServers', servers);
  return servers[index];
}

/**
 * Get all scheduled tasks
 */
export function getScheduledTasks(): ScheduledTask[] {
  if (!store) initStore();
  return store.get('scheduledTasks', []);
}

/**
 * Add a new scheduled task
 */
export function addScheduledTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>): ScheduledTask {
  if (!store) initStore();
  const tasks = getScheduledTasks();
  const newTask: ScheduledTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.push(newTask);
  store.set('scheduledTasks', tasks);
  return newTask;
}

/**
 * Update an existing scheduled task
 */
export function updateScheduledTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
  if (!store) initStore();
  const tasks = getScheduledTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: Date.now(),
  };
  store.set('scheduledTasks', tasks);
  return tasks[index];
}

/**
 * Delete a scheduled task
 */
export function deleteScheduledTask(id: string): boolean {
  if (!store) initStore();
  const tasks = getScheduledTasks();
  const filtered = tasks.filter(t => t.id !== id);
  const deleted = filtered.length < tasks.length;
  if (deleted) {
    store.set('scheduledTasks', filtered);
  }
  return deleted;
}

/**
 * Get task execution logs
 */
export function getTaskLogs(): TaskLog[] {
  if (!store) initStore();
  return store.get('taskLogs', []);
}

/**
 * Add a task execution log
 */
export function addTaskLog(log: TaskLog): void {
  if (!store) initStore();
  const logs = getTaskLogs();
  logs.unshift(log); // Add to beginning

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.splice(100);
  }

  store.set('taskLogs', logs);
}

/**
 * Clear task execution logs
 */
export function clearTaskLogs(): void {
  if (!store) initStore();
  store.set('taskLogs', []);
}
