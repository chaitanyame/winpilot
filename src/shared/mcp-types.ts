// MCP (Model Context Protocol) Server Types
// These types mirror the Copilot SDK's MCP configuration types

/**
 * Base configuration shared by all MCP server types
 */
export interface MCPServerConfigBase {
  /** Display name for the server */
  name: string;
  /** Tools to include. Use "*" for all tools, or an array of specific tool names */
  tools: "*" | string[];
  /** Whether this server is enabled */
  enabled: boolean;
  /** Optional timeout in milliseconds for tool calls */
  timeout?: number;
}

/**
 * Configuration for a local/stdio MCP server
 * These run as local processes
 */
export interface MCPLocalServerConfig extends MCPServerConfigBase {
  type: 'local' | 'stdio';
  /** Command to run the MCP server */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** Working directory for the server */
  cwd?: string;
}

/**
 * Configuration for a remote MCP server (HTTP or SSE)
 */
export interface MCPRemoteServerConfig extends MCPServerConfigBase {
  type: 'http' | 'sse';
  /** URL of the remote server */
  url: string;
  /** HTTP headers for requests */
  headers?: Record<string, string>;
}

/**
 * Union type for all MCP server configurations
 */
export type MCPServerConfig = MCPLocalServerConfig | MCPRemoteServerConfig;

/**
 * Stored MCP server entry with unique ID
 */
export interface StoredMCPServer {
  id: string;
  config: MCPServerConfig;
  createdAt: number;
  updatedAt: number;
}

/**
 * IPC channel names for MCP operations
 */
export const MCP_IPC_CHANNELS = {
  MCP_LIST: 'mcp:list',
  MCP_ADD: 'mcp:add',
  MCP_UPDATE: 'mcp:update',
  MCP_DELETE: 'mcp:delete',
  MCP_TOGGLE: 'mcp:toggle',
  MCP_TEST: 'mcp:test',
} as const;
