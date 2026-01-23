// Electron Store for Settings

import Store from 'electron-store';
import { Settings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/constants';
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
    },
  });

  return store;
}

/**
 * Get application settings
 */
export function getSettings(): Settings {
  if (!store) initStore();
  return store.get('settings', DEFAULT_SETTINGS);
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
