# Tools (Project Notes)

WinPilot exposes a curated set of desktop-control tools to the Copilot session.

Key project conventions:

- Tool names are `snake_case` (e.g. `files_delete`).
- For user-facing permissions, we normalize tool names to a `dot.case` form (e.g. `files.delete`) to match settings (`requireConfirmFor`).
- Destructive tools (delete/kill/sleep/lock) must be gated by an explicit user confirmation prompt in the UI.

See also:

- Source of truth for tool definitions: `src/tools/index.ts`
- Permission gating for tools: `src/main/permission-gate.ts`
