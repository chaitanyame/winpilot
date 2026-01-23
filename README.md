# Desktop Commander

> Control your entire desktop with natural language using AI

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Desktop Commander is a cross-platform system tray application that lets you control your desktop environment through natural language. It acts as an AI layer over your operating system, enabling you to manage windows, files, applications, and system settings through conversation.

## ✨ Features

- **Window Management** - List, focus, move, resize, and arrange windows
- **File Operations** - Search, move, copy, rename, and delete files
- **Application Control** - Launch, quit, and switch between applications
- **System Settings** - Control volume, brightness, and take screenshots
- **Process Monitoring** - List and manage running processes
- **Clipboard Management** - Read and write clipboard content

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A GitHub API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/desktop-commander.git
cd desktop-commander

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GitHub API key

# Run in development mode
npm run electron:dev
```

### Building

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux
```

## 🎮 Usage

1. **Launch the app** - It will appear in your system tray
2. **Press the hotkey** - `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS)
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

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop Commander                            │
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
desktop-commander/
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

Desktop Commander uses a permission system to protect your system:

| Level | Description | Examples |
|-------|-------------|----------|
| **Read-Only** | No confirmation needed | List windows, search files |
| **Standard** | Ask once per session | Focus window, launch app |
| **Sensitive** | Always confirm | Move/delete files, quit apps |
| **Dangerous** | Explicit approval required | Kill processes, system sleep |

## 🎨 Customization

Settings are stored locally and can be configured:

- **Hotkey** - Change the global shortcut
- **Theme** - Light, dark, or system
- **Permissions** - Customize confirmation requirements
- **Safety** - Set protected paths and operation limits

## 🗺️ Roadmap

- [x] Phase 1: Windows support with core tools
- [ ] Phase 2: Complete file system operations
- [ ] Phase 3: Application & system control
- [ ] Phase 4: Process & clipboard management
- [ ] Phase 5: macOS support
- [ ] Phase 6: Linux support
- [ ] Phase 7: Voice input support

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/)
- AI powered by [Copilot SDK](https://github.com/github/copilot-sdk)
- UI with [React](https://reactjs.org/) and [Tailwind CSS](https://tailwindcss.com/)
