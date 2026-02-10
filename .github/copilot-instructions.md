# WinPilot - Copilot Instructions

## Project Overview

WinPilot is an Electron application that allows users to control their Windows desktop via natural language commands using the GitHub Copilot SDK.

## Commands

### Development
```bash
npm run electron:dev   # Start dev mode (Vite + Electron)
npm run typecheck      # Run TypeScript type checking
npm run lint           # Run ESLint
npm run rebuild        # Rebuild native modules (better-sqlite3)
```

### Build
```bash
npm run build          # Build for current platform
npm run build:win      # Build for Windows
npm run build:mac      # Build for macOS
npm run build:linux    # Build for Linux
```

### Training (Intent Classification)
```bash
npm run train:generate-data   # Generate training data
npm run train:model           # Train ML model
npm run train:all             # Generate data + train
```

## Copilot SDK Documentation

**CRITICAL**: The Copilot SDK documentation is in the `docs/` folder at the root of this project. **Always check these docs** when working with the Copilot SDK:

- `docs/concepts/tools.md` - Tool definition and configuration
- `docs/concepts/sessions.md` - Session lifecycle
- `docs/concepts/events.md` - Event handling
- `docs/api/session.md` - Session API reference
- `docs/api/types.md` - Type definitions

## Architecture Overview

### Three-Process Electron Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Main Process   │ ◄─IPC─► │ Renderer Process │ ◄─────► │ Preload Script  │
│  (Node.js)      │         │  (React + Vite)  │         │  (Secure Bridge)│
│                 │         │                  │         │                 │
│ - Copilot SDK   │         │ - Command Palette│         │ - Typed IPC API │
│ - Platform APIs │         │ - Message Stream │         │                 │
│ - IPC Handlers  │         │ - Settings UI    │         │                 │
│ - System Tray   │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Core Components

#### Main Process (`src/main/`)
- **`index.ts`**: App initialization, single instance lock, hardware acceleration disabled (prevents GPU cache errors on Windows)
- **`ipc.ts`**: IPC handlers for all platform operations and Copilot integration
- **`windows.ts`**: Command palette window management with retry logic for dev server startup
- **`hotkeys.ts`**: Global hotkey registration (default: `Ctrl+Shift+Space`)
- **`tray.ts`**: System tray management
- **`store.ts`**: Settings and history persistence using electron-store
- **`permission-gate.ts`**: Permission system for dangerous operations
- **`timers.ts`**, **`reminders.ts`**, **`worldclock.ts`**: Productivity features

#### Renderer Process (`src/renderer/`)
- React-based command palette UI
- Communicates with main process via IPC defined in `src/preload/index.ts`
- Streams Copilot responses in real-time using AsyncGenerator pattern

#### Copilot Integration (`src/copilot/client.ts`)

**`CopilotController`** class manages the Copilot SDK lifecycle:
- Uses `CopilotClient` and `CopilotSession` from @github/copilot-sdk
- Tools registered with `defineTool()` using Zod schemas
- Event-based message handling with AsyncGenerator pattern
- Session events: `assistant.message_delta`, `tool.execution_start`, `tool.execution_complete`, `session.idle`
- **availableTools whitelist**: Only our custom tools are allowed, effectively disabling all built-in CLI tools (`powershell`, `bash`, etc.) which require PowerShell Core 6+
- Copilot CLI path auto-detected from VS Code extension storage

**MCP Servers Integration** (`src/shared/mcp-types.ts`):
- Model Context Protocol (MCP) servers provide additional tools to Copilot
- Three server types supported:
  - **Local (stdio)**: Child process servers (`MCPLocalServerConfig`)
  - **Remote HTTP**: HTTP-based servers with Authorization header support
  - **Remote SSE**: Server-Sent Events based servers
- Stored in electron-store under `mcpServers: StoredMCPServer[]`
- UI: Click plug icon in command palette header to manage MCP servers
- `CopilotController.notifyMcpServersChanged()` triggers session reinitialization

#### Tools (`src/tools/index.ts`)

All tools defined using `defineTool()` from Copilot SDK:
- Zod schemas for parameter validation (wrapped with `wrapZodSchema()` for SDK compatibility)
- Each tool calls the unified platform adapter
- Permission gates for sensitive operations

**Tool Categories:**
- **Window Management**: list, focus, minimize, maximize, close, resize, move, arrange
- **File Operations**: list, read, write (auto-creates parent dirs), delete, move, copy
- **Apps**: launch (by name or path), list, quit
- **Office**: create Word/Excel/PowerPoint/Outlook docs, create PowerPoint presentations with structured slides
- **System**: info, volume, brightness, screenshot, lock, sleep
- **Clipboard**: read, write
- **Processes**: list, kill
- **Productivity**: timers, countdowns, Pomodoro, reminders, world clock, unit conversion
- **Network**: WiFi control, network info, service management
- **Media**: play/pause control
- **Browser**: automation for tabs, bookmarks, search
- **OCR**: text extraction from images and screenshots

#### Platform Adapters (`src/platform/`)

**Unified Adapter Pattern:**
- `index.ts`: Exports `getPlatformAdapter()` factory
- `unified-adapter.ts`: Wraps platform-specific implementations with consistent `{success, data, error}` response format
- `windows.ts`: Windows implementation using PowerShell 5.x (NOT PowerShell Core)
- `macos.ts`, `linux.ts`: Stubs for future implementation

Each platform adapter implements interfaces for: `IWindowManager`, `IFileSystem`, `IApps`, `ISystem`, `IProcess`, `INetwork`, `IWifi`, `IServices`, `IMedia`, `IBrowser`, `IEmail`, `IOcr`.

#### Intent Classification System

**Three-Tier Routing** (see `TESTING_GUIDE.md` for details):
- **Tier 1 (Pattern Matching)**: <5ms latency for exact patterns
- **Tier 2 (ML Classification)**: ~15ms latency, 99.3% accuracy on test data (818 training examples, 26 tools)
- **Tier 3 (LLM Fallback)**: Full Copilot SDK for complex queries

**Training:**
- Model stored in `models/intent_model.json` (~41 KB)
- Training data generated with `training/generate-data.ts`
- Model trained with `training/train-model.ts` using `natural` library

## Key Design Decisions

### 1. Custom Tools Only (availableTools Whitelist)
The Copilot CLI has built-in shell tools that require PowerShell Core 6+ (`pwsh.exe`). We use `availableTools` whitelist to only allow our custom tools, disabling all built-in tools (`powershell`, `bash`, `shell`, `terminal`, `execute_command`).

### 2. Hardware Acceleration Disabled
`app.disableHardwareAcceleration()` prevents GPU cache permission errors on Windows.

### 3. Static Platform Imports
Changed from dynamic `require()` to static imports for bundler (Vite) compatibility.

### 4. Dev Server Retry Logic
Window loading includes retry mechanism (`waitForDevServer()`) to handle Vite dev server startup race conditions.

### 5. Unified Adapter Pattern
Platform-specific adapters wrapped with consistent response format for easier tool integration and error handling.

### 6. Permission System
Four levels: Read-Only (no confirmation), Standard (ask once per session), Sensitive (always confirm), Dangerous (explicit approval). File operations constrained to user home directory by default.

### 7. Native Module Handling
`better-sqlite3` requires native compilation. Run `npm run rebuild` after `npm install` if database features fail.

## File Structure

```
src/
├── main/           # Main process (Node.js)
├── renderer/       # Renderer process (React)
├── preload/        # Preload scripts (secure IPC bridge)
├── copilot/        # Copilot SDK integration
├── tools/          # Tool definitions
├── platform/       # Platform-specific implementations
│   ├── windows/    # Windows adapter (PowerShell 5.x)
│   ├── macos/      # macOS adapter (stub)
│   └── linux/      # Linux adapter (stub)
├── shared/         # Shared types and utilities
├── utils/          # Logging, helpers
└── intent/         # Intent classification (ML)

docs/               # Copilot SDK documentation (ALWAYS CHECK FIRST)
training/           # ML model training scripts
models/             # Trained ML models
resources/          # App icons, FFmpeg binaries
```

## TypeScript Path Aliases

```typescript
@/*           → src/*
@main/*       → src/main/*
@renderer/*   → src/renderer/*
@shared/*     → src/shared/*
@tools/*      → src/tools/*
@platform/*   → src/platform/*
@copilot/*    → src/copilot/*
```

## Coding Conventions

### Naming
- **Files**: kebab-case (`mcp-types.ts`)
- **Components**: PascalCase (`CommandPalette.tsx`)
- **Functions**: camelCase (`sendMessage()`)
- **Constants**: UPPER_SNAKE_CASE (`APP_NAME`)
- **Types/Interfaces**: PascalCase (`Message`, `IPlatformAdapter`)

### Import Order
1. Standard library imports
2. External dependencies (`@github/copilot-sdk`, `react`, `zod`)
3. Internal shared imports (`@shared/types`)
4. Internal local imports (`./utils`)

### Error Handling
- `try/catch` for async operations
- Type guards: `error instanceof Error ? error.message : String(error)`
- Early returns for error conditions
- Permission gates before dangerous operations
- Unified adapter pattern: `{success: boolean, data?: T, error?: string}`

### Logging
Custom logger in `src/utils/logger.ts`:
- `logger.copilot()` - Copilot/SDK operations
- `logger.tool()` - Tool execution
- `logger.platform()` - Platform-specific operations
- `logger.ipc()` - IPC communication
- `logger.error(category, message, error)` - Errors with stack traces

### ESLint Configuration
- TypeScript plugin enabled
- Alpha iteration velocity prioritized (relaxed rules):
  - `@typescript-eslint/no-explicit-any: off`
  - `@typescript-eslint/ban-ts-comment: off`
- Run `npm run lint` before PRs

## Copilot CLI Requirements

The Copilot SDK requires the Copilot CLI, installed by VS Code's Copilot extension.

**Windows paths:**
- `%APPDATA%\Code - Insiders\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`
- `%APPDATA%\Code\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`

**macOS/Linux**: `copilot` must be on PATH.

**First-time setup:**
1. Run `copilot`
2. At the prompt, run `/login` and complete browser sign-in

**Environment variable override:** Set `COPILOT_CLI_PATH` to point to a specific Copilot CLI executable.

## Security Considerations

- File operations are constrained to user home directory and temp directory by default
- URL validation before `shell.openExternal()` to prevent protocol attacks
- Permission gates for destructive operations (delete, kill, system sleep)
- MCP servers: Only enable servers you trust
- See `SECURITY.md` for reporting security issues

## Common Tasks

### Adding a New Tool
1. Define tool in `src/tools/index.ts` using `defineTool()` and Zod schema
2. Wrap schema with `wrapZodSchema()` for SDK compatibility
3. Implement handler that calls unified platform adapter
4. Add permission gate if operation is sensitive
5. Update tool array export: `desktopCommanderTools`

### Adding Platform Support
1. Implement platform adapter interfaces in `src/platform/<platform>.ts`
2. Update `getPlatformAdapter()` in `src/platform/index.ts`
3. Test with platform-specific build command

### Debugging Copilot Session
- Check DevTools console for `[Copilot]` logs
- Session events logged in real-time
- Tool execution start/complete events show arguments and results
- Check `logs/` folder for file-based logs

### Troubleshooting Intent Classification
- Model file: `models/intent_model.json` (~41 KB)
- Training data: 818 examples across 26 tools
- Retrain: `npm run train:all`
- Test accuracy: 99.3% on test set (142/143 correct)
- See `TESTING_GUIDE.md` for detailed testing instructions
