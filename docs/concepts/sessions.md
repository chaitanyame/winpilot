# Sessions (Project Notes)

Desktop Commander creates a Copilot SDK session in the Electron main process.

Project conventions:

- The session is created with streaming enabled.
- Built-in CLI tools are excluded so only our custom tools (and optional MCP servers) are available.
- When MCP server configuration changes, we destroy and recreate the session.

See: `src/copilot/client.ts`
