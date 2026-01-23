# Desktop Commander - Copilot Instructions

## Project Overview

Desktop Commander is an Electron application that allows users to control their desktop via natural language commands using the GitHub Copilot SDK.

## SDK Documentation

**IMPORTANT**: The Copilot SDK documentation is located in the `docs/` folder at the root of this project. Always refer to these docs when making changes involving the Copilot SDK. Key docs:
- `docs/concepts/tools.md` - Tool definition and configuration
- `docs/concepts/sessions.md` - Session lifecycle
- `docs/concepts/events.md` - Event handling
- `docs/api/session.md` - Session API reference
- `docs/api/types.md` - Type definitions

## Tech Stack

- **Electron** - Desktop application framework
- **React + Tailwind CSS** - Renderer UI
- **TypeScript** - Type-safe code throughout
- **Vite + vite-plugin-electron** - Build tooling
- **@github/copilot-sdk** - AI integration for natural language processing
- **Zod** - Runtime type validation for tool parameters

## Architecture

### Main Process (`src/main/`)
- `index.ts` - App initialization, single instance lock, hardware acceleration disabled
- `ipc.ts` - IPC handlers for all platform operations and Copilot integration
- `windows.ts` - Command palette window management with retry logic for dev server
- `hotkeys.ts` - Global hotkey registration (default: Ctrl+Shift+Space)
- `tray.ts` - System tray management
- `store.ts` - electron-store for settings and history

### Renderer Process (`src/renderer/`)
- React-based command palette UI
- Communicates with main process via IPC

### Copilot Integration (`src/copilot/`)
- `client.ts` - `CopilotController` class using @github/copilot-sdk
  - Uses `CopilotClient` and `CopilotSession` from SDK
  - Tools registered with `defineTool()` using Zod schemas
  - Event-based message handling with AsyncGenerator pattern
  - Session events: `assistant.message_delta`, `tool.execution_start`, `tool.execution_complete`, `session.idle`
  - `excludedTools` option used to disable built-in shell tools (powershell, bash, etc.)
  - `availableTools` whitelist used to only allow our custom tools, disabling all built-in tools
  - Copilot CLI path auto-detected from VS Code extension storage
  - **MCP Servers**: Supports external MCP servers for additional tools via `mcpServers` session option

### MCP Servers (`src/shared/mcp-types.ts`)
- Model Context Protocol (MCP) servers provide additional tools to the Copilot session
- Supported server types:
  - **Local (stdio)**: Command-based servers spawned as child processes (`MCPLocalServerConfig`)
  - **Remote HTTP**: HTTP-based servers with optional Authorization header (`MCPRemoteServerConfig` with type "http")
  - **Remote SSE**: Server-Sent Events based servers (`MCPRemoteServerConfig` with type "sse")
- MCP server configs stored in electron-store under `mcpServers: StoredMCPServer[]`
- UI: Click plug icon in command palette header to open MCPServersPanel
- `CopilotController.notifyMcpServersChanged()` triggers session reinitialization when servers change

### Tools (`src/tools/`)
- `index.ts` - Desktop control tools defined with `defineTool()` from Copilot SDK
- Uses Zod schemas for parameter validation
- Each tool has a handler function that calls the unified platform adapter

#### Available Tools
- **Window Management**: `windows_list`, `windows_focus`, `windows_minimize`, `windows_maximize`, `windows_close`, `windows_resize`, `windows_move`
- **File Operations**: `files_list`, `files_read`, `files_write` (create/overwrite files with auto-created parent directories), `files_delete`, `files_move`, `files_copy`
- **App Launching**: `apps_launch` (launch apps by name or path with optional arguments), `apps_list`
- **Office Integration**: `office_create` (create new Word, Excel, PowerPoint, or Outlook documents), `powerpoint_create` (create a PowerPoint presentation with slides - supports title, content, blank, titleOnly layouts with structured content)
- **System Control**: `system_info`, `system_volume`, `system_brightness`
- **Clipboard**: `clipboard_read`, `clipboard_write`
- **Processes**: `processes_list`, `processes_kill`

### Platform Adapters (`src/platform/`)
- `index.ts` - Exports `getPlatformAdapter()` for OS-specific implementations
- `unified-adapter.ts` - Wrapper providing consistent `{success, data, error}` response format
- `windows.ts` - Windows implementation using PowerShell (Windows PowerShell 5.x)
- `macos.ts`, `linux.ts` - Stubs for other platforms

## Key Design Decisions

1. **Copilot SDK**: Uses @github/copilot-sdk for AI integration, which provides tool calling and streaming response capabilities via the Copilot CLI.

2. **Hardware Acceleration Disabled**: `app.disableHardwareAcceleration()` called to prevent GPU cache permission errors on Windows.

3. **Static Platform Imports**: Changed from dynamic `require()` to static imports for bundler compatibility.

4. **Dev Server Retry Logic**: Window loading includes retry mechanism for Vite dev server startup race conditions.

5. **Unified Adapter Pattern**: Platform-specific adapters wrapped with consistent response format for easier tool integration.

6. **Custom Tools Only (availableTools)**: The Copilot CLI has built-in shell tools that require pwsh.exe (PowerShell Core 6+). We use `availableTools` whitelist to only allow our custom tools, effectively disabling all built-in tools like `powershell`, `bash`, `shell`, `terminal`, `execute_command`.

## Copilot CLI Path

The Copilot SDK requires the Copilot CLI which is installed by VS Code's Copilot extension. On Windows, it's found at:
- `%APPDATA%\Code - Insiders\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`
- `%APPDATA%\Code\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`

## Running the App

```bash
# Development
npm run electron:dev

# Build
npm run electron:build
```

## Hotkey

Default: `Ctrl+Shift+Space` - Opens command palette
