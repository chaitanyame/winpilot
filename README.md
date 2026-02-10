# WinPilot

> Control your Windows desktop with natural language using AI

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20only-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

WinPilot is a Windows system tray application that lets you control your desktop environment through natural language. It acts as an AI layer over your operating system, enabling you to manage windows, files, applications, and system settings through conversation.

This repository is currently a **public alpha**:

- **Windows-only** today (macOS/Linux adapters are stubs).
- Destructive actions require confirmation in the UI.
- Treat as experimental software.

## ✨ Features

- **Window Management** - List, focus, move, resize, arrange, and close windows
- **Screen-share Privacy** - Hide/show windows from screen sharing (Invisiwind)
- **File Operations** - List, search, read, write, move, copy, rename, delete
- **Application Control** - List, launch, quit, and switch apps
- **System Control** - Volume, brightness, DND, lock/sleep, screenshots, system info
- **Process & Services** - List/kill processes; list/control Windows services
- **Clipboard** - Read/write/clear + history search & restore
- **Network & WiFi** - Network info/tests + WiFi status/on/off/list
- **Browser Automation** - Open/search/new tab/close tab/refresh/bookmark
- **Media** - Play/pause/next/previous/stop + media status
- **Productivity** - Timers, countdowns, Pomodoro, world clock, unit conversion, reminders
- **Content Tools** - OCR + screenshot annotation, notes & todos, email compose/open
- **Recording** - Screen/audio recording (FFmpeg)
- **Speech** - Text-to-speech (list voices, speak, stop)
- **Web** - web_fetch + optional web_search (API key)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm
- Windows 10/11 (required)
- GitHub Copilot CLI installed (the `copilot` command)
	- The app uses the Copilot CLI via `@github/copilot-sdk`.
	- Install guide: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli
	- On Windows, WinPilot will try to auto-detect the Copilot CLI that ships with VS Code's Copilot extension, but you can also install the Copilot CLI separately and ensure `copilot` is on your `PATH`.
	- Optional: set `COPILOT_CLI_PATH` to point to your Copilot CLI executable.
- Optional dependencies:
	- **FFmpeg** for recording and local whisper audio conversion (`ffmpeg.exe`)
	- **Invisiwind binaries** for screen-share privacy tools (`resources\\invisiwind\\`)
	- **OpenAI API key** for cloud Whisper
	- **Search API key** for the `web_search` tool
	- **Agent skills** (`SKILL.md` files) for docx/pptx/pdf/xlsx

### Sign in to Copilot CLI (required)

Before running WinPilot, you must authenticate the Copilot CLI at least once on this machine.

1. Run `copilot`
2. At the prompt, run `/login` and complete the browser sign-in flow

If you skip this step, the app won't be able to start a Copilot session.

### Installation

```bash
# Clone the repository
git clone https://github.com/chaitanyame/winpilot.git
cd winpilot

# Install dependencies
npm install

# (Optional) environment variables
cp .env.example .env

# Run in development mode
npm run electron:dev
```

### Building (Windows)

```bash
# Build for current platform
npm run build

# Build for Windows explicitly
npm run build:win
```

macOS/Linux builds are not supported yet (adapters are stubs).

## 🎮 Usage

1. **Launch the app** - It will appear in your system tray
2. **Press the hotkey** - `Ctrl+Shift+Space`
3. **Type your command** - Use natural language to describe what you want to do
4. **Confirm actions** - Sensitive operations will ask for confirmation

### Example Commands

```
"Put my browser on the left half and terminal on the right"
"Find all PDFs in Downloads from this week"
"Close all browsers and open Spotify"
"What's using all my CPU?"
"Take a screenshot"
"Set volume to 50%"
```

## ✅ Feature Availability (Windows)

| Feature Area | Status | Requirements |
|---|---|---|
| Window management | ✅ | None |
| Screen-share privacy (hide/show windows) | ⚠️ | Invisiwind binaries in `resources\\invisiwind\\` |
| File operations (list/read/write/move/copy/delete/search) | ✅ | Home/temp constrained by default |
| App control | ✅ | App must be installed |
| System control (volume/brightness/DND/lock/sleep/screenshot) | ✅ | None |
| System info | ✅ | None |
| Process list/kill/top | ✅ | Permission-gated |
| Services list/control | ✅ | Permission-gated |
| Clipboard read/write/clear/history/restore | ✅ | None |
| Network info/tests | ✅ | None |
| WiFi control | ✅ | WiFi adapter present |
| Browser automation | ✅ | Default browser installed |
| Media controls + status | ✅ | Media session available |
| Office document create | ⚠️ | Microsoft Office installed |
| PowerPoint generation | ⚠️ | Microsoft PowerPoint installed |
| Email compose/open | ⚠️ | Default mail client configured |
| OCR (image/clipboard/region) | ⚠️ | Windows OCR engine availability |
| Screenshot annotation | ✅ | None |
| Notes & todos | ✅ | None |
| Reminders | ✅ | Notifications enabled |
| Timers/countdowns/Pomodoro | ✅ | None |
| World clock | ✅ | None |
| Unit conversion | ✅ | None |
| Recording (screen/audio/webcam) | ⚠️ | FFmpeg (`ffmpeg.exe`) |
| Text-to-speech | ✅ | Windows TTS voices available |
| Voice input (local whisper) | ⚠️ | whisper.cpp binary + model + FFmpeg |
| Voice input (OpenAI Whisper) | ⚠️ | OpenAI API key |
| Voice input (Web Speech API) | ❌ | Not supported in Electron |
| Web fetch | ✅ | Internet access |
| Web search tool | ⚠️ | Search API key (placeholder tool) |
| Troubleshooting workflows | ✅ | Uses system/network/process tools |
| Shell command tool | ✅ | Permission-gated |
| Copilot SDK/LLM tools | ⚠️ | Copilot CLI installed + `/login` completed |
| Agent skills (docx/pptx/pdf/xlsx) | ⚠️ | User-provided `SKILL.md` files |

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           WinPilot                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   System     │    │   Copilot    │    │    Tool      │      │
│  │   Tray UI    │◄──►│     SDK      │◄──►│   Registry   │      │
│  │  (Electron)  │    │   Client     │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Platform Adapters                      │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │  │
│  │  │ Windows │   │  Files  │   │  Apps   │   │ System  │  │  │
│  │  │ Manager │   │  Ops    │   │ Launcher│   │ Control │  │  │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
winpilot/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI (command palette)
│   ├── preload/        # Electron preload scripts
│   ├── copilot/        # AI SDK integration
│   ├── tools/          # Tool definitions
│   ├── platform/       # Platform-specific implementations
│   │   ├── windows/    # Windows adapter
│   │   ├── macos/      # macOS adapter (stub)
│   │   └── linux/      # Linux adapter (stub)
│   └── shared/         # Shared types and utilities
├── resources/          # App icons and assets
└── docs/              # Documentation
```

## 🔒 Security & Permissions

WinPilot uses a permission system to protect your system:

| Level | Description | Examples |
|-------|-------------|----------|
| **Read-Only** | No confirmation needed | List windows, search files |
| **Standard** | Ask once per session | Focus window, launch app |
| **Sensitive** | Always confirm | Move/delete files, quit apps |
| **Dangerous** | Explicit approval required | Kill processes, system sleep |

Notes:

- File operations are constrained to the user home directory and temp directory by default.
- You can also configure MCP servers; only enable servers you trust.

## 🎨 Customization

Settings are stored locally and can be configured:

- **Hotkey** - Change the global shortcut
- **Theme** - Light, dark, or system
- **Permissions** - Customize confirmation requirements
- **Safety** - Set protected paths and operation limits

## 🧠 Agent Skills (Anthropic)

WinPilot supports Agent Skills via `SKILL.md` files. Skills are injected into the Copilot system prompt only when relevant, to avoid prompt bloat.

**Where to place skills:**

- **User skills (recommended):** `~/.claude/skills/<skill-name>/SKILL.md`, `~/.agents/skills/<skill-name>/SKILL.md`, or `./.agents/skills/<skill-name>/SKILL.md` (project root)
- **Built-in skills (packaged apps):** `resources/skills/` (empty by default)

**Anthropic document skills (pptx/docx/pdf/xlsx):**

Anthropic's document skills are **source-available and proprietary**. You must **bring your own copies** and place them in your user skills directory. We do **not** bundle them in the app.

Example layout:

```
~/.claude/skills/ (or ~/.agents/skills/ or ./.agents/skills/)
  pptx/
    SKILL.md
  docx/
    SKILL.md
  pdf/
    SKILL.md
  xlsx/
    SKILL.md
```

Once installed, WinPilot will automatically detect these skills and inject the correct instructions when you mention presentations, documents, PDFs, or spreadsheets.

## 🗺️ Roadmap

- [x] Phase 1: Windows support with core tools
- [ ] Phase 2: Complete file system operations
- [ ] Phase 3: Application & system control
- [ ] Phase 4: Process & clipboard management
- [ ] Phase 5: Voice input improvements

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/)
- AI powered by [Copilot SDK](https://github.com/github/copilot-sdk)
- UI with [React](https://reactjs.org/) and [Tailwind CSS](https://tailwindcss.com/)
