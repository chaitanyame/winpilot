# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Desktop Application with Three-Layer Architecture (Electron Main/Renderer + Platform Abstractions)

**Key Characteristics:**
- **Electron-based desktop app** with main process (Node.js) and renderer process (React)
- **Three-layer separation**: Main Process → Preload Bridge → Renderer Process → Platform Adapters
- **Platform abstraction layer** for cross-platform compatibility (Windows, macOS, Linux)
- **AI-driven automation** using GitHub Copilot SDK with custom tool definitions
- **IPC communication** for all inter-process communication
- **Permission system** for dangerous operations (Circuit Breaker pattern)

## Layers

### Main Process Layer

**Purpose:** Desktop OS interaction, tool execution, state management, security

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/main/`

**Contains:**
- `index.ts` - Application entry point, window lifecycle, tray management
- `ipc.ts` - IPC handler registration for all tool operations
- `store.ts` - Electron-store based settings, history, permissions
- `permission-gate.ts` - Security gate for dangerous operations
- `windows.ts` - Window management (hide, resize, drag regions)
- `tray.ts` - System tray icon and context menu
- `hotkeys.ts` - Global hotkey registration
- `scheduler.ts` - Node-cron based scheduled task execution
- `notifications.ts` - Desktop notification handling

**Depends on:**
- Platform adapters (`src/platform/`)
- Copilot client (`src/copilot/client.ts`)
- MCP server management
- Electron APIs (window, clipboard, shell, app)

**Used by:**
- Preload script (`src/preload/index.ts`)

### Preload Bridge Layer

**Purpose:** Secure IPC bridge between main and renderer processes

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/preload/`

**Contains:**
- `index.ts` - `contextBridge.exposeInMainWorld('electronAPI', {...})` exposing all APIs

**Pattern:**
- Uses `contextBridge` to expose protected methods to renderer
- All IPC calls go through `ipcRenderer.invoke()` (promisified) or `ipcRenderer.on()` (events)
- Type-safe API exposed via `ElectronAPI` interface

**API Categories:**
- App control (getSettings, setSettings, getHistory, hide, resize)
- Window management (list, focus, move, close, minimize, maximize, arrange)
- File operations (list, search, move, copy, delete, rename, read, write)
- Applications (list, launch, quit, switch)
- System control (volume, brightness, screenshot, DND, lock, sleep)
- Process management (list, info, kill, top)
- Clipboard (read, write, clear)
- Copilot (sendMessage, cancel, clearSession, stream events)
- Permissions (request, respond)
- MCP servers (list, add, update, delete, toggle)
- Scheduled tasks (list, add, update, delete, toggle, execute, logs)
- Notifications (onNotification)
- Voice input (test, isRecording, transcript events)

**Used by:**
- Renderer process (`src/renderer/`)

### Renderer Process Layer

**Purpose:** UI rendering, user interaction, state management

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/renderer/`

**Contains:**
- `main.tsx` - React entry point with global error handler
- `App.tsx` - Root component with theme provider
- `components/` - React components
- `hooks/` - Custom React hooks
- `styles/` - Global CSS

**Key Components:**
- `CommandPalette.tsx` - Main chat interface with input, history, voice input
- `MessageStream.tsx` - Chat message rendering with streaming support
- `SettingsPanel.tsx` - Settings UI (hotkey, theme, permissions, tools, safety, agentic loop, notifications, scheduled tasks, voice input)
- `MCPServersPanel.tsx` - MCP server configuration UI
- `ScheduledTasksPanel.tsx` - Scheduled task management UI
- `ToastNotifications.tsx` - Toast notification display
- `ConfirmationDialog.tsx` - Permission request dialog

**State Management:**
- Zustand store for UI state (used in hooks)
- React hooks for local component state

**Dependency on:**
- Preload bridge (`window.electronAPI`)

**Used by:**
- Electron BrowserWindow

### Platform Abstraction Layer

**Purpose:** Platform-specific OS operations with unified interface

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/platform/`

**Contains:**
- `index.ts` - Interface definitions and factory function
- `unified-adapter.ts` - Unified adapter with consistent `{success, data, error}` return format
- `path-validator.ts` - Security validation for file paths
- Platform-specific implementations:
  - `windows/` - Windows-specific APIs (window, file system, apps, process, system)
  - `macos/` - macOS-specific APIs
  - `linux/` - Linux-specific APIs

**Interface Definitions (`IPlatformAdapter`):**
```typescript
interface IPlatformAdapter {
  readonly platform: 'windows' | 'macos' | 'linux';
  readonly windowManager: IWindowManager;
  readonly fileSystem: IFileSystem;
  readonly apps: IApps;
  readonly system: ISystem;
  readonly process: IProcess;
  readonly network: INetwork;
  readonly services: IServices;
}
```

**Implementation Pattern:**
```typescript
// Factory function selects platform adapter at runtime
export function getPlatformAdapter(): IPlatformAdapter {
  const platform = process.platform;
  switch (platform) {
    case 'win32': return windowsAdapter;
    case 'darwin': return macosAdapter;
    case 'linux': return linuxAdapter;
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

**Used by:**
- Tool definitions (`src/tools/index.ts`)
- IPC handlers (`src/main/ipc.ts`)

### Copilot AI Layer

**Purpose:** Natural language understanding and tool execution via GitHub Copilot SDK

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/copilot/`

**Contains:**
- `client.ts` - CopilotController class wrapping GitHub Copilot SDK

**Key Features:**
- Agentic loop implementation with configurable iterations
- Tool execution tracking (ToolExecutionRecord, TurnSummary)
- MCP server integration
- Streaming event handling (text, tool_call, tool_result, iteration_start, iteration_complete, loop_complete, error, done)
- Session lifecycle management
- Multi-model support (Claude 4.5, GPT-5, GPT-4, etc.)

**Patterns:**
- AsyncGenerator for streaming responses
- Singleton controller pattern (`copilotController`)
- Event-driven architecture (SessionEvent subscription)
- Circuit breaker for repeated tool failures

**Used by:**
- IPC handler (`src/main/ipc.ts`)

### Tool Definitions Layer

**Purpose:** AI-executable tool definitions with schema validation

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/tools/`

**Contains:**
- `index.ts` - Tool definitions exported as array

**Tool Categories:**
- Window Management (15 tools)
- File System (10 tools)
- Applications (4 tools)
- System Control (6 tools)
- Process Management (4 tools)
- Clipboard (3 tools)
- Office (2 tools)
- System Information (1 tool)
- Network (2 tools)
- Services (2 tools)
- Web Search (1 tool)
- Troubleshooting (2 tools)

**Pattern:**
```typescript
export const toolName = defineTool('tool_name', {
  description: '...',
  parameters: p({ param: z.string() }),
  handler: async (params) => {
    const result = await adapter.someMethod(params);
    return result.success ? 'Success' : `Failed: ${result.error}`;
  }
});
```

**Used by:**
- Copilot client (`src/copilot/client.ts`)

## Data Flow

### Message Flow (User → AI → Tools → Response)

```
1. User types command in CommandPalette
   ↓
2. CommandPalette.handleSubmit() calls useCopilot.sendMessage()
   ↓
3. IPC handler ipcMain.handle('copilot:sendMessage')
   ↓
4. CopilotController.sendMessageWithLoop() starts agentic loop
   ↓
5. CopilotClient.createSession() with tools and MCP servers
   ↓
6. Copilot SDK processes message, calls tools
   ↓
7. Tool handler executes (calls platform adapter)
   ↓
8. Platform adapter performs OS operation
   ↓
9. Tool execution result sent back to AI
   ↓
10. Agentic loop continues until completion or timeout
   ↓
11. Stream events sent to renderer via IPC
   ↓
12. MessageStream renders responses in real-time
```

### Permission Flow

```
1. Tool handler detects dangerous operation
   ↓
2. Calls requestPermissionForTool() in permission-gate.ts
   ↓
3. PermissionRequest created with tool name, description, level, params
   ↓
4. IPC event 'app:permissionRequest' sent to renderer
   ↓
5. CommandPalette shows ConfirmationDialog
   ↓
6. User approves or denies
   ↓
7. Renderer calls electronAPI.respondPermission()
   ↓
8. IPC event 'app:permissionResponse' sent to main
   ↓
9. PermissionGate stores decision (with 24h expiry)
   ↓
10. Tool execution proceeds or cancels
```

### MCP Server Flow

```
1. User adds/updates MCP server in MCPServersPanel
   ↓
2. IPC handler mcpAdd/mcpUpdate called
   ↓
3. Store updated with new/modified server config
   ↓
4. CopilotController.notifyMcpServersChanged() called
   ↓
5. CopilotController builds MCP servers config
   ↓
6. On next sendMessage, CopilotController.buildMcpServersConfig()
   ↓
7. MCP servers passed to CopilotClient.createSession()
   ↓
8. Copilot SDK uses MCP tools for AI execution
```

### Scheduled Task Flow

```
1. User creates task in ScheduledTasksPanel
   ↓
2. IPC handler task:add called with task config (cronExpression, prompt)
   ↓
3. Task added to store with generated ID
   ↓
4. taskScheduler.scheduleTask() registers cron job
   ↓
5. On scheduled time, cron executes taskExecute()
   ↓
6. Task executes via sendMessageWithLoop()
   ↓
7. Result logged to taskLogs store
   ↓
8. Renderer can view logs via taskLogs handler
```

## State Management

### Storage

**Storage Layer:**
- `electron-store` package (package.json)
- Store schema in `src/main/store.ts`

**Storage Keys:**
- `settings` - Application settings (hotkey, theme, permissions, tools, safety, agenticLoop, notifications, scheduledTasks, voiceInput)
- `history` - Command history (last 100)
- `permissions` - Saved permission decisions (24h expiry)
- `mcpServers` - MCP server configurations
- `scheduledTasks` - Scheduled tasks
- `taskLogs` - Task execution logs (last 100)

### Centralized State

**Single Source of Truth:**
- `src/main/store.ts` exports functions for each data type
- Functions follow CRUD pattern (get, add, update, delete, list)

**Global Singleton:**
- Store initialized once in main process (`initStore()`)

## Key Abstractions

### IPC Channel Pattern

**Purpose:** Type-safe communication between processes

**Location:** `src/shared/types.ts`

**Pattern:**
```typescript
export const IPC_CHANNELS = {
  WINDOW_LIST: 'window:list',
  WINDOW_FOCUS: 'window:focus',
  // ... more channels
} as const;
```

**Handler Pattern:**
```typescript
// Main process
ipcMain.handle(IPC_CHANNELS.WINDOW_LIST, async () => {
  return platform.windowManager.listWindows();
});

// Preload bridge
windowList: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_LIST),

// Renderer
const windows = await window.electronAPI.windowList();
```

### Operation Result Pattern

**Purpose:** Consistent error handling and data return format

**Location:** `src/platform/unified-adapter.ts`

**Pattern:**
```typescript
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Usage:**
```typescript
async listFiles(params: ListFilesParams): Promise<OperationResult<FileInfo[]>> {
  try {
    const files = await this.adapter.fileSystem.listFiles(params);
    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: this.formatError(error) };
  }
}
```

### Tool Definition Pattern

**Purpose:** Define AI-executable tools with schema validation

**Location:** `src/tools/index.ts`

**Pattern:**
```typescript
export const toolName = defineTool('tool_name', {
  description: 'Tool description for AI',
  parameters: p({
    param: z.string().describe('Parameter description'),
  }),
  handler: async (params) => {
    // Validate params
    // Execute operation
    // Return result
  }
});

// Expose tools array to Copilot
export const desktopCommanderTools = [toolName, ...];
```

### Stream Event Pattern

**Purpose:** Event-driven streaming of AI responses

**Location:** `src/copilot/client.ts`

**Pattern:**
```typescript
export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' |
        'iteration_start' | 'iteration_complete' | 'loop_complete';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  iterationNumber?: number;
}

async *sendMessage(message: string): AsyncGenerator<StreamEvent> {
  // Subscribe to session events
  this.session.on((event: SessionEvent) => {
    const streamEvent = convertToStreamEvent(event);
    this.eventQueue.push(streamEvent);
  });

  // Yield events as they arrive
  while (!this.isComplete) {
    while (this.eventQueue.length > 0) {
      yield this.eventQueue.shift()!;
    }
    await waitForMoreEvents();
  }
}
```

## Entry Points

### Application Entry (Main Process)

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/main/index.ts`

**Triggers:**
- `app.whenReady()` in Electron API

**Responsibilities:**
- Initialize store
- Create command window
- Create system tray
- Register global hotkeys
- Setup IPC handlers
- Initialize task scheduler
- Handle app lifecycle (ready, window-all-closed, activate, before-quit)

### Application Entry (Renderer Process)

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/renderer/main.tsx`

**Triggers:**
- Electron loads `index.html` from preload bridge

**Responsibilities:**
- Render React app
- Set up global error handler
- Setup theme provider

### Window Entry

**Location:** `/mnt/c/code/claudecode/desktop-commander/src/main/windows.ts`

**Triggers:**
- Main process app initialization
- macOS dock icon click

**Responsibilities:**
- Create BrowserWindow with webPreferences
- Set drag regions
- Handle show/hide events
- Handle resize events
- Update tray menu on settings change

## Error Handling

**Strategy:** Defensive error handling with graceful degradation

**Patterns:**

1. **Try-Catch in Async Operations:**
   - All async platform operations wrapped in try-catch
   - Return `OperationResult` with error message

2. **IPC Error Propagation:**
   - Errors in IPC handlers propagated to renderer
   - Renderer displays error messages to user

3. **Tool Execution Safety:**
   - Dangerous tools require permission approval
   - Circuit breaker prevents infinite loops on repeated failures

4. **Store Errors:**
   - Electron-store silent failures logged but not propagated
   - Default values used if store read fails

5. **Platform Adapter Errors:**
   - Errors formatted to strings for UI display
   - Null/undefined results handled gracefully

**Example:**
```typescript
async listFiles(params: ListFilesParams): Promise<OperationResult<FileInfo[]>> {
  try {
    const files = await this.adapter.fileSystem.listFiles(params);
    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: this.formatError(error) };
  }
}

private formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
```

## Cross-Cutting Concerns

### Logging

**Framework:** Custom logger in `src/utils/logger.ts`

**Categories:**
- `copilot:` - AI/copilot activity
- `platform:` - Platform adapter operations
- `tool:` - Tool execution
- `error:` - Errors
- `info:` - General information

**Usage:**
```typescript
logger.copilot('Session created', { sessionId });
logger.tool('launchApp called', { name, path });
logger.error('Copilot', 'Failed to create session', error);
```

### Validation

**Framework:** Zod schemas in tool definitions and IPC

**Pattern:**
```typescript
import { z } from 'zod';

export const windowResizeTool = defineTool('window_resize', {
  parameters: p({
    x: z.number().optional().describe('New X position'),
    y: z.number().optional().describe('New Y position'),
    width: z.number().optional().describe('New width'),
    height: z.number().optional().describe('New height')
  }),
  // ...
});
```

### Authentication

**Pattern:** Permission-based access control

**Levels:**
- `READ_ONLY` - Safe operations (list, get info)
- `STANDARD` - Moderate operations (move, copy, launch)
- `SENSITIVE` - Potentially destructive (delete, quit)
- `DANGEROUS` - Dangerous operations (lock screen, kill process, format disk)

**Mechanism:**
- Tool handler calls `requestPermissionForTool()`
- User approves or denies
- Decision saved with 24h expiry

### Theme Support

**Framework:** CSS variables with dark mode support

**Location:** `src/renderer/styles/globals.css`

**Pattern:**
```css
:root {
  --dark-100: ...;
  --dark-200: ...;
  --dark-300: ...;
  --dark-400: ...;
  --dark-500: ...;
  --dark-600: ...;
  --dark-700: ...;
  --dark-800: ...;
  --dark-900: ...;
}

html.dark {
  /* Dark mode overrides */
}

html.light {
  /* Light mode overrides */
}
```

**Usage:**
```typescript
const { theme } = useTheme();
className={`app ${theme}`}
```

---

*Architecture analysis: 2026-01-29*
