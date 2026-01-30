# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
/mnt/c/code/claudecode/desktop-commander/
├── .github/                 # GitHub workflows, copilot instructions
├── .planning/codebase/      # Codebase documentation (this directory)
├── docs/                    # API and concepts documentation
├── node_modules/            # Dependencies (not committed)
├── release/                 # Electron build outputs
├── resources/               # App icons, README
├── src/                     # Source code
│   ├── copilot/            # Copilot AI client
│   ├── main/               # Electron main process
│   ├── platform/           # Platform abstraction layer
│   ├── preload/            # Preload bridge
│   ├── renderer/           # React renderer process
│   ├── shared/             # Shared types and constants
│   ├── tools/              # Tool definitions
│   └── utils/              # Utility functions
├── dist/                    # Build outputs
├── logs/                    # Application logs
├── tsconfig.json            # TypeScript config
├── tsconfig.node.json       # TypeScript config (node)
├── vite.config.ts           # Vite config
├── electron-builder.json    # Electron builder config
├── package.json             # Dependencies and scripts
└── README.md                # Project README
```

## Directory Purposes

### `src/` - Source Code

**Purpose:** All application source code

**Contains:**
- Subdirectories for each major component
- Shared types between processes

### `src/copilot/` - AI Client

**Purpose:** Copilot AI client and agentic loop implementation

**Contains:**
- `client.ts` - CopilotController class wrapping GitHub Copilot SDK

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/copilot/client.ts` (881 lines)

**Purpose:** Handles all AI interactions including session creation, streaming, tool execution, and agentic loop logic

### `src/main/` - Electron Main Process

**Purpose:** OS-level operations, IPC handling, state management

**Contains:**
- `index.ts` - App entry point
- `ipc.ts` - IPC handler registration
- `store.ts` - Electron-store for settings/history
- `permission-gate.ts` - Security gate for dangerous operations
- `windows.ts` - Window management
- `tray.ts` - System tray management
- `hotkeys.ts` - Global hotkey registration
- `scheduler.ts` - Scheduled task execution (node-cron)
- `notifications.ts` - Desktop notifications

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/main/index.ts` (131 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/main/ipc.ts` (435 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/main/store.ts` (367 lines)

**Purpose:** Main process orchestrates all OS-level operations, IPC communication, and state persistence

### `src/platform/` - Platform Abstraction Layer

**Purpose:** Cross-platform OS operations with unified interface

**Contains:**
- `index.ts` - Interface definitions and factory function
- `unified-adapter.ts` - Unified adapter with consistent result format
- `path-validator.ts` - File path security validation
- Platform-specific implementations (`windows/`, `macos/`, `linux/`)

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/platform/index.ts` (245 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/platform/unified-adapter.ts` (787 lines)

**Purpose:** Provides platform-agnostic interface for window management, file system, apps, system control, processes, network, and services

### `src/preload/` - Preload Bridge

**Purpose:** Secure IPC bridge between main and renderer processes

**Contains:**
- `index.ts` - `contextBridge` API exposure

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/preload/index.ts` (257 lines)

**Purpose:** Exposes typed API to renderer process via `window.electronAPI`

### `src/renderer/` - React Renderer Process

**Purpose:** UI rendering, user interaction

**Contains:**
- `main.tsx` - React entry point
- `App.tsx` - Root component
- `components/` - React components
- `hooks/` - Custom React hooks
- `styles/` - Global CSS
- `types/` - Renderer-specific types

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/main.tsx` (23 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/App.tsx` (34 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/CommandPalette.tsx` (550 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/SettingsPanel.tsx` (883 lines)

**Purpose:** Renders UI and handles user interactions via React

### `src/shared/` - Shared Types

**Purpose:** Type definitions shared between main, renderer, and platform layers

**Contains:**
- `types.ts` - Core type definitions
- `mcp-types.ts` - MCP server type definitions
- `constants.ts` - Default values

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/shared/types.ts` (352 lines)
- `/mnt/c/code/claudecode/desktop-commander/src/shared/mcp-types.ts` (73 lines)

**Purpose:** Central type definitions for IPC channels, data structures, settings, and tool definitions

### `src/tools/` - Tool Definitions

**Purpose:** AI-executable tool definitions with schema validation

**Contains:**
- `index.ts` - Tool definitions exported as array

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/tools/index.ts` (1151 lines)

**Purpose:** Defines 40+ tools that AI can execute for desktop control

### `src/utils/` - Utilities

**Purpose:** Shared utility functions

**Contains:**
- `logger.ts` - Logging utility
- `zod-wrapper.ts` - Zod wrapper for tool parameters

**Key Files:**
- `/mnt/c/code/claudecode/desktop-commander/src/utils/logger.ts`
- `/mnt/c/code/claudecode/desktop-commander/src/utils/zod-wrapper.ts`

**Purpose:** Helper functions for logging and Zod schema validation

## Key File Locations

### Entry Points

**Main Process Entry:**
- `/mnt/c/code/claudecode/desktop-commander/src/main/index.ts`

**Renderer Process Entry:**
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/main.tsx`

### Configuration

**TypeScript:**
- `/mnt/c/code/claudecode/desktop-commander/tsconfig.json`
- `/mnt/c/code/claudecode/desktop-commander/tsconfig.node.json`

**Build Tools:**
- `/mnt/c/code/claudecode/desktop-commander/vite.config.ts`
- `/mnt/c/code/claudecode/desktop-commander/electron-builder.json`
- `/mnt/c/code/claudecode/desktop-commander/package.json`

### Core Logic

**Main Process:**
- `/mnt/c/code/claudecode/desktop-commander/src/main/ipc.ts` - IPC handler registration
- `/mnt/c/code/claudecode/desktop-commander/src/main/store.ts` - State management
- `/mnt/c/code/claudecode/desktop-commander/src/main/permission-gate.ts` - Security

**Renderer:**
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/CommandPalette.tsx` - Main UI
- `/mnt/c/code/claudecode/desktop-commander/src/renderer/hooks/useCopilot.ts` - Copilot integration

**Platform:**
- `/mnt/c/code/claudecode/desktop-commander/src/platform/index.ts` - Platform interfaces
- `/mnt/c/code/claudecode/desktop-commander/src/platform/unified-adapter.ts` - Unified interface

**AI:**
- `/mnt/c/code/claudecode/desktop-commander/src/copilot/client.ts` - Copilot controller
- `/mnt/c/code/claudecode/desktop-commander/src/tools/index.ts` - Tool definitions

### Build Output

**Main Process:**
- `/mnt/c/code/claudecode/desktop-commander/dist/main/`

**Preload:**
- `/mnt/c/code/claudecode/desktop-commander/dist/preload/`

**Renderer:**
- `/mnt/c/code/claudecode/desktop-commander/dist/renderer/`

## Naming Conventions

### Files

**General Pattern:**
- PascalCase for TypeScript files
- Descriptive names ending in `.ts` or `.tsx`

**Examples:**
- `CommandPalette.tsx` - Component
- `ipc.ts` - Main process module
- `index.ts` - Entry point or barrel file
- `utils.ts` - Utility module

### Directories

**General Pattern:**
- kebab-case
- Singular or plural nouns

**Examples:**
- `src/main/` - Main process
- `src/renderer/components/` - React components
- `src/platform/windows/` - Windows-specific implementation
- `src/utils/` - Utilities

### Functions

**General Pattern:**
- camelCase
- Verbs for actions

**Examples:**
- `sendMessage()` - Send message to AI
- `getSettings()` - Get application settings
- `requestPermissionForTool()` - Request permission for dangerous operation
- `buildMcpServersConfig()` - Build MCP server configuration

### Variables

**General Pattern:**
- camelCase
- Descriptive names

**Examples:**
- `copilotController` - Singleton controller instance
- `desktopCommanderTools` - Array of tool definitions
- `unifiedAdapterInstance` - Singleton adapter instance
- `windowManager` - Window management instance

### Types

**General Pattern:**
- PascalCase

**Examples:**
- `OperationResult` - Result with success/error
- `StreamEvent` - Streaming event type
- `IPlatformAdapter` - Platform adapter interface
- `StreamEvent` - Streaming event type

### Constants

**General Pattern:**
- UPPER_SNAKE_CASE
- Descriptive names

**Examples:**
- `IPC_CHANNELS` - IPC channel constants
- `MCP_IPC_CHANNELS` - MCP IPC channel constants
- `DEFAULT_SETTINGS` - Default settings object
- `CONFIDENCE_THRESHOLD` - Voice recognition confidence threshold

## Where to Add New Code

### New Tool Definition

**File:** `/mnt/c/code/claudecode/desktop-commander/src/tools/index.ts`

**Pattern:**
```typescript
export const toolName = defineTool('tool_name', {
  description: 'Tool description for AI',
  parameters: p({
    param: z.string().describe('Parameter description'),
  }),
  handler: async (params) => {
    const result = await adapter.someMethod(params);
    return result.success ? 'Success' : `Failed: ${result.error}`;
  }
});

export const desktopCommanderTools = [
  // ... existing tools
  toolName,
];
```

### New Platform-Specific Implementation

**Directory:** `/mnt/c/code/claudecode/desktop-commander/src/platform/{platform}/`

**Files:**
- `{platform}/index.ts` - Implement `I{Platform}` interface
- `{platform}/index.ts` - Export platform adapter as default

**In `/mnt/c/code/claudecode/desktop-commander/src/platform/index.ts`:**
```typescript
import { newPlatform } from './new-platform';
// Add to getPlatformAdapter switch case
```

**In `/mnt/c/code/claudecode/desktop-commander/src/platform/unified-adapter.ts`:**
- Add parameters interface to top of file
- Add method implementation to `UnifiedPlatformAdapter` class

### New IPC Channel

**Step 1 - Define Channel:**
File: `/mnt/c/code/claudecode/desktop-commander/src/shared/types.ts`
```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  NEW_CHANNEL: 'new:channel',
} as const;
```

**Step 2 - Register Handler:**
File: `/mnt/c/code/claudecode/desktop-commander/src/main/ipc.ts`
```typescript
ipcMain.handle(IPC_CHANNELS.NEW_CHANNEL, async (_, params) => {
  return platform.someMethod(params);
});
```

**Step 3 - Expose to Renderer:**
File: `/mnt/c/code/claudecode/desktop-commander/src/preload/index.ts`
```typescript
someMethod: (params: unknown) => ipcRenderer.invoke(IPC_CHANNELS.NEW_CHANNEL, params),
```

**Step 4 - Add Type Definition:**
File: `/mnt/c/code/claudecode/desktop-commander/src/preload/index.ts`
```typescript
// In ElectronAPI interface
someMethod: (params: unknown) => Promise<unknown>;
```

**Step 5 - Use in Renderer:**
```typescript
const result = await window.electronAPI.someMethod(params);
```

### New Settings Property

**Step 1 - Define Type:**
File: `/mnt/c/code/claudecode/desktop-commander/src/shared/types.ts`
```typescript
export interface Settings {
  // ... existing properties
  newProperty: string;
}
```

**Step 2 - Add Default:**
File: `/mnt/c/code/claudecode/desktop-commander/src/shared/constants.ts`
```typescript
export const DEFAULT_SETTINGS: Settings = {
  // ... existing defaults
  newProperty: 'default-value',
};
```

**Step 3 - Use in Store:**
File: `/mnt/c/code/claudecode/desktop-commander/src/main/store.ts`
```typescript
// In initStore defaults
settings: DEFAULT_SETTINGS,
// ...
```

**Step 4 - Update Settings Panel:**
File: `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/SettingsPanel.tsx`
```typescript
// Add UI for new setting
<SettingInput
  label="New Property"
  value={settings.newProperty}
  onChange={(value) => handleSettingChange({ newProperty: value })}
/>
```

### New React Component

**File:** `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/NewComponent.tsx`

**Pattern:**
```typescript
export function NewComponent() {
  // Component logic
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

**In Parent Component:**
```typescript
import { NewComponent } from './NewComponent';

function ParentComponent() {
  return (
    <div>
      <NewComponent />
    </div>
  );
}
```

### New Hook

**File:** `/mnt/c/code/claudecode/desktop-commander/src/renderer/hooks/useSomething.ts`

**Pattern:**
```typescript
import { useState, useEffect } from 'react';

export function useSomething() {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    // Effect logic
    return () => {
      // Cleanup
    };
  }, []);

  return { value, setValue };
}
```

### New UI Panel

**File:** `/mnt/c/code/claudecode/desktop-commander/src/renderer/components/NewPanel.tsx`

**Pattern:**
```typescript
export function NewPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="panel">
      {/* Panel content */}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**In Parent:**
```typescript
import { NewPanel } from './NewPanel';

function ParentComponent() {
  const [showNewPanel, setShowNewPanel] = useState(false);

  return (
    <div>
      <button onClick={() => setShowNewPanel(true)}>Open Panel</button>
      <NewPanel isOpen={showNewPanel} onClose={() => setShowNewPanel(false)} />
    </div>
  );
}
```

## Special Directories

### `node_modules/` - Dependencies

**Purpose:** Installed npm packages (not committed to git)

**Contents:**
- All packages from `package.json` dependencies

### `dist/` - Build Output

**Purpose:** Compiled TypeScript and built assets

**Contents:**
- `dist/main/` - Compiled main process
- `dist/preload/` - Compiled preload script
- `dist/renderer/` - Compiled renderer process

### `release/` - Electron Build

**Purpose:** Production-ready Electron application

**Contents:**
- `release/{version}/` - Build output for specific version
  - `win-unpacked/` - Windows unpacked application
  - `resources/` - App resources

### `docs/` - Documentation

**Purpose:** API and concepts documentation

**Contents:**
- `docs/api/` - API documentation (session, types)
- `docs/concepts/` - Concept documentation (events, sessions, tools)

### `logs/` - Application Logs

**Purpose:** Application runtime logs

**Contents:**
- Log files generated by the application

---

*Structure analysis: 2026-01-29*
