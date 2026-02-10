# WinPilot

> Control your Windows desktop with natural language using AI

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![Electron](https://img.shields.io/badge/electron-28-blue.svg)

WinPilot is a Windows system-tray application that lets you control your desktop through natural language. It uses the GitHub Copilot SDK to understand your intent and exposes **90+ tools** spanning window management, file operations, system control, productivity, and more.

> **Status: Public Alpha** — Windows-only. Destructive actions require confirmation. Treat as experimental.

---

## ✨ Features

### 🪟 Window Management
List, focus, move, resize, minimize, maximize, close, and snap windows to grid layouts (left/right half, quarters, maximize). Arrange multiple windows side-by-side.

### 🔒 Screen-Share Privacy
Hide sensitive windows from screen sharing and recording software using [Invisiwind](https://github.com/nicehash/Invisiwind). Auto-hide when screen sharing is detected (Zoom, Teams, Discord, etc.).

### 📁 File Operations
List, search, read, write, move, copy, rename, delete files and create folders. File operations are sandboxed to user home and temp directories by default. Protected system paths (C:\Windows, Program Files) are blocked.

### 🚀 Application Control
List installed apps, launch by name or path, quit running apps, switch focus between apps. Installed app cache for fast lookup.

### ⚙️ System Control
Adjust volume (set/get/mute/unmute), screen brightness, toggle Do Not Disturb, take screenshots, lock the workstation, and put the system to sleep. On-screen display (OSD) overlay for volume/brightness changes.

### 📊 Process & Service Management
List running processes with CPU/memory stats, get process details, kill processes, view top resource consumers. List Windows services, start/stop/restart services.

### 📋 Clipboard
Read, write, and clear clipboard. Automatic clipboard history monitoring with support for text, images, and file references. Search and restore from history. Pinnable entries. Image thumbnails stored locally.

### 🌐 Network & WiFi
View network adapter info, run connectivity tests (ping, DNS, traceroute). Check WiFi status, enable/disable WiFi, scan available networks.

### 🌍 Browser Automation
Open URLs, web search, new tab, close tab, next/previous tab, refresh, bookmark current page — all via keyboard simulation on the default browser.

### 🎵 Media Control
Play, pause, toggle play/pause, next track, previous track, stop media. Query current media status (now playing info).

### ⏱️ Productivity
- **Timers** — start/pause/resume/stop named timers
- **Countdowns** — set countdown with notification on completion
- **Pomodoro** — configurable work/break cycles with notifications
- **World Clock** — check time in 50+ cities, search by city name
- **Unit Conversion** — length, weight, temperature, volume, speed, data, time, area
- **Reminders** — set time-based reminders with natural language ("remind me at 3pm to call Bob")

### 📝 Notes & Todos
Create, read, update, search, and delete notes. Create todos, mark complete, delete. Stored in local SQLite database.

### 📧 Email
Compose email (opens default mail client with pre-filled fields) and open the default email application.

### 🏢 Office Documents
Create Word, Excel, and PowerPoint documents via COM automation. Generate structured PowerPoint presentations with multiple slides, layouts, and content.

### 🔍 OCR & Annotation
Extract text from images (file path), clipboard images, or screen regions using Windows OCR engine. Annotate screenshots with text, arrows, and highlights.

### 🎥 Recording
Screen recording and audio recording powered by FFmpeg. Start/stop/status for both screen and audio. Configurable output path, format, FPS, audio source, and screen region.

### 🗣️ Text-to-Speech
Speak text aloud using Windows SAPI voices. List available voices, speak with configurable voice/rate/volume, stop speech.

### 🎤 Voice Input
Speech-to-text via local Whisper (offline, whisper.cpp), OpenAI Whisper API (cloud), or browser Web Speech API (limited in Electron). Configurable provider, language, and hotkey.

### 🌤️ Weather
Current weather lookup via [wttr.in](https://wttr.in) (free, no API key). Supports brief and detailed formats.

### 🌐 Web
Fetch and extract text content from URLs. Optional web search tool (requires search API key).

### 🔧 Shell Commands
Execute arbitrary PowerShell commands (permission-gated as dangerous). Output captured and returned.

### 🛠️ Troubleshooting
Guided troubleshooting workflows that combine system info, network tests, and process diagnostics to diagnose issues.

### 🧩 MCP Servers
Extend WinPilot with [Model Context Protocol](https://modelcontextprotocol.io/) servers. Supports local (stdio), remote HTTP, and remote SSE server types. Manage servers from the UI (plug icon in command palette). Bundled MCP server stubs for docx, pdf, pptx, xlsx.

### 🧠 Agent Skills
Inject domain-specific instructions into the AI via `SKILL.md` files. Skills are loaded JIT (just-in-time) when the intent classifier detects a relevant query. Supports user skills in `~/.claude/skills/` or `./.agents/skills/`.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              WinPilot                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Main Process (Node.js / Electron)                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐               │
│  │  Copilot SDK │  │  Tool        │  │  Intent       │               │
│  │  Client      │──│  Registry    │──│  Router       │               │
│  │  (Session)   │  │  (90+ tools) │  │  (3-tier)     │               │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘               │
│         │                 │                                          │
│  ┌──────▼─────────────────▼──────────────────────────────────────┐   │
│  │                   Unified Platform Adapter                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │  │ Window   │ │ File     │ │ System   │ │ Network  │  ...     │   │
│  │  │ Manager  │ │ System   │ │ Control  │ │ / WiFi   │         │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │   │
│  │  Backed by persistent PowerShell pool (eliminates spawn lag)  │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Renderer Process (React + Tailwind + Vite)                          │
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐        │
│  │  Command     │  │  Chat    │  │ Settings  │  │ Panels   │        │
│  │  Palette     │  │  Stream  │  │           │  │ (6+)     │        │
│  └─────────────┘  └──────────┘  └───────────┘  └──────────┘        │
│                                                                      │
│  Preload (Secure IPC Bridge — typed API, no direct Node access)      │
└──────────────────────────────────────────────────────────────────────┘
```

### Three-Tier Intent Classification

| Tier | Method | Latency | Coverage |
|------|--------|---------|----------|
| 1 | Pattern matching (regex) | < 5 ms | ~40% of queries |
| 2 | ML classifier (`natural` library, 818 training examples) | ~15 ms | ~30% of queries |
| 3 | LLM fallback (Copilot SDK) | ~2 s | Remaining ~30% |

Simple commands ("take a screenshot", "list windows") are handled in Tier 1/2 without an LLM round-trip. Complex or ambiguous queries fall through to the full Copilot session.

### Key Design Decisions

- **Custom tools only** — Built-in Copilot CLI shell tools are disabled via `availableTools` whitelist. Only WinPilot's 90+ tools are exposed.
- **Persistent PowerShell pool** — Eliminates ~400ms spawn overhead per command. C# types (Add-Type) are compiled once and guarded against recompilation.
- **Async buffered logging** — Log writes are batched and flushed asynchronously to avoid blocking tool execution.
- **Session idle TTL** — Copilot sessions are destroyed after 10 minutes of inactivity and recreated on demand.
- **Permission gates** — Four levels (Read-Only → Standard → Sensitive → Dangerous) with per-tool configuration.
- **File sandboxing** — Operations constrained to user home directory and temp by default; system paths are blocked.

---

## 📁 Project Structure

```
winpilot/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App init, single instance lock
│   │   ├── ipc.ts         # IPC handlers (50+ channels)
│   │   ├── windows.ts     # Command palette window management
│   │   ├── hotkeys.ts     # Global hotkey registration
│   │   ├── tray.ts        # System tray
│   │   ├── store.ts       # Settings persistence (electron-store)
│   │   ├── database.ts    # SQLite database (better-sqlite3)
│   │   ├── permission-gate.ts  # Permission system
│   │   ├── recording-manager.ts # FFmpeg recording
│   │   ├── timers.ts      # Timer/countdown/Pomodoro
│   │   ├── reminders.ts   # Reminder scheduling
│   │   ├── worldclock.ts  # World clock (50+ cities)
│   │   ├── unit-converter.ts   # Unit conversion
│   │   ├── notes.ts / todos.ts # Notes & todos (SQLite)
│   │   ├── weather.ts     # Weather via wttr.in
│   │   ├── url-fetch.ts   # URL content fetcher
│   │   ├── chat-history.ts     # Conversation persistence
│   │   ├── clipboard-monitor.ts # Clipboard history
│   │   ├── skills-registry.ts  # SKILL.md loader & watcher
│   │   ├── osd-window.ts  # On-screen display overlay
│   │   ├── scheduler.ts   # Cron-based task scheduler
│   │   ├── notifications.ts    # Native + toast notifications
│   │   ├── context-capture.ts  # Active window context
│   │   ├── screen-share-detector.ts # Screen share detection
│   │   ├── screen-share-privacy.ts  # Window hiding service
│   │   └── voice-input.ts # Voice input manager
│   ├── renderer/          # React UI
│   │   ├── components/    # 18 components (CommandPalette, MessageStream, etc.)
│   │   ├── hooks/         # useCopilot, useHotkey, useTheme
│   │   ├── slash-commands.ts  # /help, /new, /compact, /clear, /model, etc.
│   │   └── styles/        # Tailwind styles
│   ├── preload/           # Secure IPC bridge (typed API)
│   ├── copilot/           # Copilot SDK integration
│   │   └── client.ts      # CopilotController (session lifecycle, MCP, skills)
│   ├── tools/             # Tool definitions (90+ tools via defineTool)
│   │   └── index.ts       # All tool definitions with Zod schemas
│   ├── platform/          # Platform-specific implementations
│   │   ├── windows/       # Windows adapter (PowerShell 5.x based)
│   │   │   ├── powershell-pool.ts  # Persistent PS session pool
│   │   │   ├── window-manager.ts   # Window enumeration & control
│   │   │   ├── file-system.ts      # File operations
│   │   │   ├── apps.ts, system.ts, process.ts, network.ts, wifi.ts
│   │   │   ├── browser.ts, media.ts, email.ts, ocr.ts, services.ts
│   │   │   ├── tts.ts, media-status.ts, invisiwind.ts
│   │   │   └── index.ts   # Platform adapter factory
│   │   ├── macos/         # macOS adapter (stub)
│   │   ├── linux/         # Linux adapter (stub)
│   │   ├── unified-adapter.ts  # Consistent {success, data, error} wrapper
│   │   └── path-validator.ts   # File path sandboxing
│   ├── shared/            # Shared types and constants
│   │   ├── types.ts       # All shared TypeScript interfaces
│   │   ├── constants.ts   # App constants, defaults, layouts
│   │   ├── mcp-types.ts   # MCP server types
│   │   └── skill-tools.ts # Skill tool helpers
│   ├── intent/            # Intent classification (ML)
│   │   ├── router.ts      # 3-tier routing orchestrator
│   │   ├── patterns.ts    # Tier 1: regex patterns
│   │   ├── ml-classifier.ts  # Tier 2: ML model (natural library)
│   │   ├── extractors.ts  # Parameter extraction
│   │   ├── executor.ts    # Direct tool execution
│   │   └── skill-intents.ts  # Skill intent detection
│   ├── utils/             # Utilities
│   │   ├── logger.ts      # Async buffered logger
│   │   ├── ffmpeg-path.ts # FFmpeg detection
│   │   ├── invisiwind-path.ts  # Invisiwind detection
│   │   ├── whisper-path.ts     # Whisper detection
│   │   └── zod-wrapper.ts # Zod schema wrapper for SDK
│   └── mcp-servers/       # Bundled MCP server stubs (docx, pdf, pptx, xlsx)
├── models/                # Trained ML model (intent_model.json, ~41 KB)
├── training/              # ML training scripts
├── resources/             # App icons, FFmpeg, Invisiwind binaries, skills
├── docs/                  # Copilot SDK documentation
└── .github/               # Issue/PR templates, Copilot instructions
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | ≥ 18 | v22+ recommended for full Copilot CLI compat |
| **npm** | (bundled) | |
| **Windows** | 10 or 11 | Only supported platform |
| **GitHub Copilot CLI** | Latest | Required for AI features |

### Install & Run

```bash
# Clone
git clone https://github.com/chaitanyame/winpilot.git
cd winpilot

# Install dependencies
npm install

# (Optional) Copy environment template
cp .env.example .env

# Run in development mode
npm run electron:dev
```

### Copilot CLI Setup (Required)

WinPilot uses the GitHub Copilot SDK, which requires the Copilot CLI to be installed and authenticated.

1. **Auto-detected paths** (VS Code extension):
   - `%APPDATA%\Code\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`
   - `%APPDATA%\Code - Insiders\User\globalStorage\github.copilot-chat\copilotCli\copilot.bat`
2. **Manual override**: Set `COPILOT_CLI_PATH` environment variable
3. **Authenticate once**:
   ```
   copilot
   /login
   ```
   Complete the browser sign-in flow. This only needs to be done once.

### Build

```bash
npm run build          # Build for current platform
npm run build:win      # Build Windows installer (NSIS)
```

### Development Commands

| Command | Description |
|---|---|
| `npm run electron:dev` | Start dev mode (Vite + Electron hot reload) |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run rebuild` | Rebuild native modules (better-sqlite3) |
| `npm run train:all` | Regenerate training data + retrain ML model |

---

## 🎮 Usage

1. **Launch** — App appears in the system tray
2. **Hotkey** — Press `Ctrl+Shift+A` (configurable) to open the command palette
3. **Type** — Use natural language to describe what you want
4. **Confirm** — Sensitive/dangerous operations prompt for confirmation

### Example Commands

```
"Put my browser on the left half and VS Code on the right"
"Find all PDFs in Downloads modified this week"
"Close all browsers and open Spotify"
"What's using all my CPU?"
"Take a screenshot"
"Set volume to 50%"
"Set a timer for 25 minutes"
"Remind me at 3pm to call the client"
"What time is it in Tokyo?"
"Convert 100 miles to kilometers"
"Start screen recording"
"Read the text from clipboard image"
"Hide Teams from screen sharing"
"What's the weather in London?"
```

### Slash Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/new [title]` | Start a new chat session |
| `/sessions` | List recent sessions |
| `/switch <id>` | Switch to a different session |
| `/compact` | Summarize and reset context |
| `/clear` | Clear chat display |
| `/model [name]` | Show or switch AI model |
| `/settings` | Open settings panel |

---

## ✅ Feature Availability Matrix

| Feature | Tools | Status | Requirements |
|---|---|---|---|
| **Window management** | `window_list`, `window_focus`, `window_resize`, `window_move`, `window_close`, `window_minimize`, `window_maximize`, `window_arrange` | ✅ Ready | None |
| **Screen-share privacy** | `window_hide_from_sharing`, `window_show_in_sharing`, `window_list_hidden`, `window_hide_all_sensitive` | ⚠️ Optional | Invisiwind binaries in `resources/invisiwind/` |
| **File operations** | `files_list`, `files_search`, `files_read`, `files_write`, `files_move`, `files_copy`, `files_delete`, `files_rename`, `files_create_folder`, `files_info` | ✅ Ready | Sandboxed to home/temp |
| **App control** | `apps_list`, `apps_launch`, `apps_quit`, `apps_switch` | ✅ Ready | None |
| **System control** | `system_volume`, `system_brightness`, `system_screenshot`, `system_dnd`, `system_lock`, `system_sleep`, `system_info` | ✅ Ready | None |
| **WiFi** | `system_wifi` | ✅ Ready | WiFi adapter present |
| **Processes** | `process_list`, `process_info`, `process_kill`, `process_top` | ✅ Ready | Permission-gated |
| **Services** | `service_list`, `service_control` | ✅ Ready | Permission-gated |
| **Clipboard** | `clipboard_read`, `clipboard_write`, `clipboard_clear`, `clipboard_history`, `clipboard_restore` | ✅ Ready | None |
| **Network** | `network_info`, `network_test` | ✅ Ready | None |
| **Browser** | `browser_open`, `browser_search`, `browser_new_tab`, `browser_close_tab`, `browser_next_tab`, `browser_prev_tab`, `browser_refresh`, `browser_bookmark` | ✅ Ready | Default browser |
| **Media** | `media_play`, `media_pause`, `media_play_pause`, `media_next`, `media_previous`, `media_stop`, `media_status` | ✅ Ready | Active media session |
| **Productivity** | `productivity_timer`, `productivity_countdown`, `productivity_pomodoro`, `productivity_worldclock`, `productivity_convert` | ✅ Ready | None |
| **Reminders** | `set_reminder`, `list_reminders`, `cancel_reminder` | ✅ Ready | None |
| **Notes & Todos** | `notes_create/list/get/update/search/delete/delete_all`, `todos_create/list/complete/delete` | ✅ Ready | None |
| **Email** | `email_compose`, `email_open` | ⚠️ Optional | Default mail client |
| **Office** | `office_create`, `powerpoint_create` | ⚠️ Optional | Microsoft Office installed |
| **OCR** | `ocr_extract`, `ocr_clipboard`, `ocr_region`, `screenshot_annotate` | ⚠️ Optional | Windows OCR engine |
| **Recording** | `screen_record_start/stop/status`, `audio_record_start/stop` | ⚠️ Optional | FFmpeg (`ffmpeg.exe`) |
| **TTS** | `speak_text`, `stop_speaking`, `list_voices` | ✅ Ready | Windows SAPI voices |
| **Weather** | `weather_get` | ✅ Ready | Internet access |
| **Web fetch** | `web_fetch_url` | ✅ Ready | Internet access |
| **Web search** | `web_search` | ⚠️ Placeholder | Search API key |
| **Shell** | `run_shell_command` | ✅ Ready | Permission-gated (Dangerous) |
| **Troubleshooting** | `troubleshoot_start`, `troubleshoot_propose_fix` | ✅ Ready | None |
| **Unit conversion** | `convert_unit` | ✅ Ready | None |
| **Skills** | `skills_list`, `skills_refresh` | ✅ Ready | SKILL.md files |
| **Voice input** | (renderer-side) | ⚠️ Optional | Whisper binary + FFmpeg or OpenAI API key |
| **Copilot AI** | (session) | ⚠️ Required | Copilot CLI installed + `/login` |

**Legend:** ✅ Works out of the box · ⚠️ Requires optional dependency or configuration

---

## 🔒 Security & Permissions

| Level | Behavior | Example Tools |
|---|---|---|
| **Read-Only** | No confirmation | `window_list`, `files_list`, `system_info`, `clipboard_read` |
| **Standard** | Ask once per session | `window_focus`, `apps_launch`, `browser_open` |
| **Sensitive** | Always confirm | `files_move`, `files_write`, `apps_quit` |
| **Dangerous** | Explicit approval | `files_delete`, `process_kill`, `system_sleep`, `service_control`, `run_shell_command` |

- File operations sandboxed to `%USERPROFILE%` and `%TEMP%` by default
- System paths (`C:\Windows`, `C:\Program Files`) are protected
- MCP servers can extend tool capabilities — only enable servers you trust

---

## 🎨 Customization

Configurable via the Settings panel (`/settings`):

- **Hotkey** — Global shortcut to open command palette (default: `Ctrl+Shift+A`)
- **Theme** — Light, dark, or system
- **AI Model** — Switch between available models (`/model`)
- **Permissions** — Per-tool confirmation levels
- **Safety** — Protected paths, max files per operation
- **Agentic Loop** — Max iterations, timeout, auto-compaction threshold
- **Notifications** — Native OS, in-app toast, sound
- **Voice Input** — Provider, language, hotkey
- **Recording** — Output path
- **Context Awareness** — Capture active window context with each query
- **Scheduled Tasks** — Cron-based recurring tasks
- **Additional Hotkeys** — Clipboard history, voice transcribe, audio/video recording, chat

---

## 🧠 Agent Skills

WinPilot supports agent skills via `SKILL.md` files for domain-specific AI behavior.

**Skill directories** (checked in order):
```
~/.claude/skills/<skill-name>/SKILL.md
~/.agents/skills/<skill-name>/SKILL.md
./.agents/skills/<skill-name>/SKILL.md
resources/skills/<skill-name>/SKILL.md (built-in)
```

**Anthropic document skills** (pptx/docx/pdf/xlsx) are **source-available and proprietary**. You must bring your own copies:

```
~/.claude/skills/
  pptx/SKILL.md
  docx/SKILL.md
  pdf/SKILL.md
  xlsx/SKILL.md
```

Skills are auto-detected and injected into the Copilot system prompt only when the intent classifier matches a relevant query. They expire after 5 minutes of inactivity.

---

## 🔌 MCP Servers

WinPilot supports three types of MCP servers:

| Type | Protocol | Example |
|---|---|---|
| **Local (stdio)** | Child process | `npx @modelcontextprotocol/server-sqlite` |
| **Remote HTTP** | HTTP + Authorization header | Custom API server |
| **Remote SSE** | Server-Sent Events | Streaming server |

Manage servers via the plug icon (🔌) in the command palette header. Tool name collisions with built-in tools are detected and warned.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Electron 28 |
| AI | GitHub Copilot SDK (`@github/copilot-sdk`) |
| Frontend | React 18, Tailwind CSS 3, Framer Motion |
| State | Zustand |
| Schema validation | Zod |
| Database | better-sqlite3 (SQLite) |
| Settings | electron-store |
| ML classification | natural (Naive Bayes) |
| Task scheduling | node-cron |
| Icons | Lucide React |
| Build | Vite + vite-plugin-electron + electron-builder |
| Language | TypeScript (strict mode) |

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## 📄 License

MIT — see [LICENSE](LICENSE).

## 🔐 Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## 🙏 Acknowledgments

- [Electron](https://electronjs.org/) — desktop framework
- [GitHub Copilot SDK](https://github.com/github/copilot-sdk) — AI engine
- [React](https://reactjs.org/) + [Tailwind CSS](https://tailwindcss.com/) — UI
- [Invisiwind](https://github.com/nicehash/Invisiwind) — screen-share privacy
- [wttr.in](https://wttr.in) — weather data
- [natural](https://github.com/NaturalNode/natural) — NLP / ML classification
