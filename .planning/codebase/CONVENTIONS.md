# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- PascalCase for React components: `CommandPalette.tsx`, `MessageStream.tsx`
- camelCase for utility functions: `generateId()`, `formatFileSize()`
- snake_case for constants: `DEFAULT_SETTINGS`, `IPC_CHANNELS`
- kebab-case for file names: `PermissionGate.ts`, `mcp-types.ts`

**Functions:**
- camelCase for functions: `useCopilot()`, `sendMessage()`, `getSettings()`
- PascalCase for class methods: `initialize()`, `executeTask()`, `destroy()`
- camelCase for callbacks: `handleKeyDown()`, `handleSubmit()`, `respondPermission()`

**Variables:**
- camelCase for variables: `isLoading`, `error`, `inputRef`, `messages`
- UPPER_SNAKE_CASE for constants: `APP_NAME`, `MAX_ITERATIONS`
- camelCase for refs: `currentAssistantMessageRef`, `recognitionRef`

**Types/Interfaces:**
- PascalCase for types and interfaces: `Message`, `Settings`, `UseCopilotReturn`, `ToolDefinition`
- PascalCase for enums: `PermissionLevel`, `Theme`
- camelCase for type parameters: `<T extends ZodTypeAny>`

## Code Style

**Formatting:**
- Prettier not detected in config files (no `.prettierrc` found)
- Consistent 2-space indentation throughout codebase
- No trailing whitespace
- Braces on same line for control flow: `if (condition) { }`
- Block spacing: blank line before `catch`, `finally`, blocks
- Long lines wrapped at ~100-120 characters (based on file content)

**Linting:**
- ESLint configured with TypeScript plugin
- Rules enabled: `react-refresh/only-export-components`, `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-var-requires: off`, `@typescript-eslint/no-namespace: off`, `no-empty: off`
- Alpha: iteration velocity prioritized (relaxed rules on purpose)

## Import Organization

**Order:**
1. Standard library imports (`import { ... } from '...'`)
2. External dependencies (`import { ... } from '@github/copilot-sdk'`)
3. Internal shared imports (`import { ... } from '../../shared/types'`)
4. Internal local imports (`import { ... } from './module'`)

**Pattern:**
```typescript
// Third-party
import { useEffect } from 'react';
import { defineTool } from '@github/copilot-sdk';

// Internal shared
import type { Message } from '../../shared/types';
import { generateId } from '../../shared/utils';

// Internal local
import { logger } from '../utils/logger';
import { getSettings } from './store';
```

**Path Aliases:**
- `@/*` → `src/*`
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@platform/*` → `src/platform/*`
- `@tools/*` → `src/tools/*`
- `@copilot/*` → `src/copilot/*`

## Error Handling

**Patterns:**
- `try/catch` blocks for async operations and error-prone code
- Error logging to `logger.error()` before rethrowing or handling
- Type guards for Error objects: `error instanceof Error ? error.message : String(error)`
- Conditional error handling with early returns: `if (!success) return '...'`
- Permission gates that return permission decision objects before proceeding

**Examples:**
```typescript
try {
  const result = await adapter.listWindows();
  if (!result.success) {
    return `Failed to list windows: ${result.error}`;
  }
  return result.data || [];
} catch (error) {
  logger.error('Window', 'Failed to list windows', error);
  return [];
}
```

**Safety patterns:**
- File operations require permission approval via `requestPermissionForTool()`
- Dangerous operations (kill process, delete files) require explicit permission
- URL validation before `shell.openExternal()` to prevent protocol attacks

## Logging

**Framework:** Custom file-based logger (`/mnt/c/code/claudecode/desktop-commander/src/utils/logger.ts`)

**Patterns:**
- `logger.copilot()` - Copilot/SDK operations
- `logger.tool()` - Tool execution
- `logger.platform()` - Platform-specific operations
- `logger.ipc()` - IPC communication
- `logger.error(category, message, error)` - Errors with stack traces

**Logging structure:**
```typescript
[timestamp] [category] message
  Data: ...truncated...
```

**Console output:** Logs also written to console for development debugging

## Comments

**When to Comment:**
- Complex algorithms (agentic loop logic, tool handlers)
- Platform-specific workarounds
- Security considerations
- Security-related operations (URL validation, path validation)

**JSDoc/TSDoc:**
- Type functions that are exported and used across modules
- Complex type definitions
- Tool definitions with parameters

**Examples:**
```typescript
/**
 * Find the Copilot CLI path installed by VS Code's Copilot extension
 */
function findCopilotCliPath(): string | null { ... }

/**
 * Wraps a Zod schema to be compatible with the Copilot SDK's expected interface.
 * The SDK checks for a toJSONSchema() method on the parameters object.
 * Zod v3 doesn't have this method, so we add it using zod-to-json-schema.
 */
export function wrapZodSchema<T extends ZodTypeAny>(schema: T): T & { toJSONSchema: () => Record<string, unknown> } { ... }

/**
 * Initialize the Copilot session with streaming and custom tools
 */
async initialize(): Promise<void> { ... }
```

## Function Design

**Size:** Functions kept concise and focused. Complex logic broken into smaller helper functions.

**Parameters:**
- Optional parameters at end of signature
- Parameters grouped by purpose in handlers
- Helper parameters where appropriate

**Return Values:**
- `void` for event handlers and side-effect functions
- Specific types for pure functions (e.g., `Result<T, Error>`)
- Type guards to distinguish success/failure
- String results for tool handlers (user-facing messages)

## Module Design

**Exports:**
- Named exports for utilities and types: `export function generateId()`, `export type Message`
- Default export for React components: `export default App`
- Singleton instances exported as named: `export const taskScheduler`, `export const copilotController`
- Barrel file for all tools: `export const desktopCommanderTools = [...]`

**File organization:**
- Single responsibility: Each file handles one concern
- Logical grouping: Tools grouped by category, organized with section headers
- Type definitions separate from implementations

---

*Convention analysis: [date]*
