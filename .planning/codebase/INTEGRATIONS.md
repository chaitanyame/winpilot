# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**GitHub Copilot:**
- @github/copilot-sdk (0.1.15) - Core AI service for desktop control
  - Uses Copilot CLI installed by VS Code extension
  - Functionality:
    - Natural language command interpretation
    - Tool calling for desktop operations (window, files, apps, system)
    - MCP (Model Context Protocol) server integration
    - Streaming responses with event types: message_delta, assistant_message, tool_execution_start/complete, session.error, session.idle
  - Model selection: Configurable via settings (default: gpt-5)
  - System prompt: Custom instructions for agentic loop behavior
  - Authentication: OAuth token from GitHub Copilot CLI

**MCP (Model Context Protocol) Servers:**
- @github/copilot-sdk MCP integration
  - Local servers (stdio):
    - @modelcontextprotocol/server-filesystem - File system access
    - @modelcontextprotocol/server-memory - Persistent memory storage
    - @modelcontextprotocol/server-puppeteer - Browser automation
    - @modelcontextprotocol/server-fetch - HTTP requests without API keys
  - Remote servers (HTTP/SSE):
    - Custom HTTP/SSE endpoints with configurable headers
  - Configuration: Stored in app settings, enables/disabled per server
  - Tools: "*" (all) or explicit tool list via SDK

**Bing Search API:**
- BING_SEARCH_API_KEY (process.env)
  - Used in src/tools/index.ts for search functionality
  - Environment variable only - no SDK wrapper detected

## Data Storage

**Databases:**
- No SQL database detected - using local storage only
- Electron Store (electron-store 8.1.0) - JSON file-based storage
  - File: desktop-commander-config.json (platform-appropriate path)
  - Storage locations:
    - macOS: ~/Library/Application Support/desktop-commander/desktop-commander-config.json
    - Windows: %APPDATA%/desktop-commander/desktop-commander-config.json
    - Linux: ~/.config/desktop-commander/desktop-commander-config.json
  - Data structure: Nested object with settings, history, permissions, mcpServers, scheduledTasks, taskLogs

**File Storage:**
- Local filesystem only - no cloud storage integration
- Electron shell module for file operations
- Protected paths configured per platform (Windows Program Files, macOS /System, etc.)

**Caching:**
- None detected - using in-memory state only

## Authentication & Identity

**GitHub Copilot:**
- OAuth-based authentication via Copilot CLI
- CLI path discovery: Searches VS Code and VS Code Insiders AppData locations
  - Windows: %APPDATA%\Code*\User\globalStorage\github.copilot-chat\copilotCli\
- Session-based tokens managed by Copilot SDK

**User Permissions:**
- No external auth provider (GitHub, Google, etc.)
- Internal permission system with levels:
  - READ_ONLY - Read-only operations (window.list, apps.list, files.info)
  - STANDARD - Standard operations with confirmation (window.focus, apps.launch)
  - SENSITIVE - Sensitive operations (files.move, files.rename, apps.quit)
  - DANGEROUS - Dangerous operations requiring explicit confirmation (files.delete, process.kill, system.sleep, system.lock)
- Permission decisions: Saved per-tool basis with optional "remember choices" feature

## Monitoring & Observability

**Error Tracking:**
- None detected - uses console.error() for errors

**Logs:**
- File-based logging via src/utils/logger.ts
  - Logs written to: logs/desktop-commander.log
  - Log levels: info, error, copilot (debug for Copilot events)
  - Log retention: Not configured

**Application Events:**
- Electron IPC for communication between processes
  - Renderer-to-Main: invoke() calls for async operations
  - Main-to-Renderer: send() for async and sync events
  - Event channels defined in src/shared/types.ts (IPC_CHANNELS)
  - Event listeners managed in src/preload/index.ts via contextBridge

## CI/CD & Deployment

**Hosting:**
- GitHub Releases - Application distribution via GitHub Releases
- Binary distribution platforms: Windows (exe), macOS (dmg), Linux (AppImage, deb, rpm)

**CI Pipeline:**
- GitHub Actions (.github/workflows/ci.yml)
  - Platform: ubuntu-latest
  - Node version: 18
  - Steps:
    - npm ci - Install dependencies
    - npm run typecheck - TypeScript type checking
    - npm run lint - ESLint validation

## Environment Configuration

**Required env vars:**
- APPDATA - Override platform-default app data directory (Copilot SDK uses this)
- BING_SEARCH_API_KEY - Bing search functionality (optional)
- HOME - User home directory override
- USERPROFILE - Windows user profile path
- NODE_ENV - Development/production environment (affects build)
- VITE_DEV_SERVER_URL - Dev server URL for Electron (development only)

**Secrets location:**
- BING_SEARCH_API_KEY stored in environment (not in app files)
- No secrets stored in electron-store (only user settings, MCP configs)
- Copilot CLI tokens managed externally by GitHub

**Platform-specific paths:**
- Windows: %APPDATA%, %USERPROFILE%
- macOS: $HOME/Library/Application Support
- Linux: $HOME/.config

## Webhooks & Callbacks

**Incoming:**
- No webhooks detected

**Outgoing:**
- No outbound webhooks detected

## Voice Input

**Browser Web Speech API:**
- Browser native speech recognition (provider: 'browser' in settings)
- Language: Configurable (default: en-US)
- Hotkey: CommandOrControl+Shift+V
- Events exposed via IPC:
  - voice:recordingStarted
  - voice:recordingStopped
  - voice:transcript
  - voice:error
- No native voice SDK (e.g., SpeechRecognition API)

---

*Integration audit: 2026-01-29*
