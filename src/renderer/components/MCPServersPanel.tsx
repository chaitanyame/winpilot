import React, { useState, useEffect, useCallback } from 'react';
import { 
  MCPServerConfig, 
  MCPLocalServerConfig, 
  MCPRemoteServerConfig, 
  StoredMCPServer 
} from '../../shared/mcp-types';

interface MCPServersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ServerFormData = {
  name: string;
  type: 'local' | 'http' | 'sse';
  enabled: boolean;
  tools: string;
  timeout: string;
  // Local server fields
  command: string;
  args: string;
  env: string;
  cwd: string;
  // Remote server fields
  url: string;
  headers: string;
};

const defaultFormData: ServerFormData = {
  name: '',
  type: 'local',
  enabled: true,
  tools: '*',
  timeout: '',
  command: '',
  args: '',
  env: '',
  cwd: '',
  url: '',
  headers: '',
};

export function MCPServersPanel({ isOpen, onClose }: MCPServersPanelProps) {
  const [servers, setServers] = useState<StoredMCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServerFormData>(defaultFormData);
  const [error, setError] = useState<string | null>(null);

  // Load servers on mount
  const loadServers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.mcpList();
      setServers(data as StoredMCPServer[]);
    } catch (err) {
      setError('Failed to load MCP servers');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadServers();
    }
  }, [isOpen, loadServers]);

  // Convert form data to MCPServerConfig
  const formToConfig = (): MCPServerConfig => {
    const toolsArray = formData.tools === '*' 
      ? ['*'] 
      : formData.tools.split(',').map(t => t.trim()).filter(Boolean);

    const baseConfig = {
      name: formData.name,
      enabled: formData.enabled,
      tools: toolsArray,
      timeout: formData.timeout ? parseInt(formData.timeout, 10) : undefined,
    };

    if (formData.type === 'local') {
      // Parse command - if it contains spaces and args is empty, split it
      let command = formData.command.trim();
      let argsFromForm = formData.args.split(' ').filter(Boolean);
      
      // If command contains spaces and no explicit args, split command into executable + args
      if (command.includes(' ') && argsFromForm.length === 0) {
        const parts = command.split(' ');
        command = parts[0];
        argsFromForm = parts.slice(1);
      }
      
      const config: MCPLocalServerConfig = {
        ...baseConfig,
        type: 'local',
        command: command,
        args: argsFromForm,
        env: formData.env ? JSON.parse(formData.env) : undefined,
        cwd: formData.cwd || undefined,
      };
      return config;
    } else {
      const config: MCPRemoteServerConfig = {
        ...baseConfig,
        type: formData.type,
        url: formData.url,
        headers: formData.headers ? JSON.parse(formData.headers) : undefined,
      };
      return config;
    }
  };

  // Convert MCPServerConfig to form data
  const configToForm = (config: MCPServerConfig): ServerFormData => {
    const base = {
      name: config.name,
      type: config.type === 'stdio' ? 'local' : config.type,
      enabled: config.enabled,
      tools: config.tools.join(', '),
      timeout: config.timeout?.toString() || '',
    } as ServerFormData;

    if (config.type === 'local' || config.type === 'stdio') {
      const local = config as MCPLocalServerConfig;
      return {
        ...base,
        type: 'local',
        command: local.command,
        args: local.args.join(' '),
        env: local.env ? JSON.stringify(local.env, null, 2) : '',
        cwd: local.cwd || '',
        url: '',
        headers: '',
      };
    } else {
      const remote = config as MCPRemoteServerConfig;
      return {
        ...base,
        command: '',
        args: '',
        env: '',
        cwd: '',
        url: remote.url,
        headers: remote.headers ? JSON.stringify(remote.headers, null, 2) : '',
      };
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const config = formToConfig();
      
      if (editingId) {
        await window.electronAPI.mcpUpdate(editingId, config);
      } else {
        await window.electronAPI.mcpAdd(config);
      }

      await loadServers();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save server');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData(defaultFormData);
    setIsEditing(false);
    setEditingId(null);
    setError(null);
  };

  // Edit a server
  const handleEdit = (server: StoredMCPServer) => {
    setFormData(configToForm(server.config));
    setEditingId(server.id);
    setIsEditing(true);
  };

  // Delete a server
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) {
      return;
    }
    try {
      await window.electronAPI.mcpDelete(id);
      await loadServers();
    } catch (err) {
      setError('Failed to delete server');
    }
  };

  // Toggle server enabled state
  const handleToggle = async (id: string) => {
    try {
      await window.electronAPI.mcpToggle(id);
      await loadServers();
    } catch (err) {
      setError('Failed to toggle server');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            MCP Servers
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Close"
            aria-label="Close MCP Servers panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {isEditing ? (
            <ServerForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={resetForm}
              isEditing={!!editingId}
            />
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add MCP Server
              </button>

              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : servers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No MCP servers configured. Click "Add MCP Server" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {servers.map((server) => (
                    <ServerCard
                      key={server.id}
                      server={server}
                      onEdit={() => handleEdit(server)}
                      onDelete={() => handleDelete(server.id)}
                      onToggle={() => handleToggle(server.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Server card component
interface ServerCardProps {
  server: StoredMCPServer;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function ServerCard({ server, onEdit, onDelete, onToggle }: ServerCardProps) {
  const config = server.config;
  const isLocal = config.type === 'local' || config.type === 'stdio';

  return (
    <div className={`p-4 rounded-lg border ${
      config.enabled 
        ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' 
        : 'border-gray-200 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {config.name}
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded ${
              isLocal 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
            }`}>
              {config.type}
            </span>
            {!config.enabled && (
              <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300 rounded">
                Disabled
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {isLocal 
              ? `${(config as MCPLocalServerConfig).command} ${(config as MCPLocalServerConfig).args.join(' ')}`
              : (config as MCPRemoteServerConfig).url
            }
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Tools: {config.tools.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`p-1.5 rounded ${
              config.enabled
                ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
            title={config.enabled ? 'Disable' : 'Enable'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {config.enabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              )}
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded"
            title="Edit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
            title="Delete"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Server form component
interface ServerFormProps {
  formData: ServerFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServerFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}

function ServerForm({ formData, setFormData, onSubmit, onCancel, isEditing }: ServerFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const isLocal = formData.type === 'local';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Server Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="My MCP Server"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Server Type *
        </label>
        <select
          name="type"
          value={formData.type}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          title="Select server type"
          aria-label="Server type"
        >
          <option value="local">Local (stdio)</option>
          <option value="http">Remote (HTTP)</option>
          <option value="sse">Remote (SSE)</option>
        </select>
      </div>

      {isLocal ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Command *
            </label>
            <input
              type="text"
              name="command"
              value={formData.command}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="npx @modelcontextprotocol/server-filesystem"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Arguments (space-separated)
            </label>
            <input
              type="text"
              name="args"
              value={formData.args}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="/path/to/allowed/directory"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Working Directory
            </label>
            <input
              type="text"
              name="cwd"
              value={formData.cwd}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="C:\Projects"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Environment Variables (JSON)
            </label>
            <textarea
              name="env"
              value={formData.env}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder='{"API_KEY": "your-key"}'
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL *
            </label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="https://mcp-server.example.com/api"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Headers (JSON)
            </label>
            <textarea
              name="headers"
              value={formData.headers}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder='{"Authorization": "Bearer token"}'
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tools (comma-separated, or * for all)
        </label>
        <input
          type="text"
          name="tools"
          value={formData.tools}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="*"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Timeout (ms)
        </label>
        <input
          type="number"
          name="timeout"
          value={formData.timeout}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="30000"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          name="enabled"
          checked={formData.enabled}
          onChange={handleChange}
          className="rounded"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
          Enable this server
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {isEditing ? 'Update Server' : 'Add Server'}
        </button>
      </div>
    </form>
  );
}
