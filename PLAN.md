# Desktop Commander - Project Plan

> Control your entire desktop with natural language using the GitHub Copilot SDK

## Overview

Desktop Commander is a cross-platform system tray application that lets users control their desktop environment through natural language. It acts as an AI layer over the operating system, enabling users to manage windows, files, applications, and system settings through conversation.

**Core Value Proposition:** "Your desktop, commanded by voice and text."

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Desktop Commander                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   System     │    │   Copilot    │    │    Tool      │      │
│  │   Tray UI    │◄──►│    SDK       │◄──►│   Registry   │      │
│  │  (Electron)  │    │   Client     │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                    │               │
│         │                   │                    ▼               │
│         │                   │           ┌──────────────┐        │
│         │                   │           │   Platform   │        │
│         │                   │           │   Adapters   │        │
│         │                   │           └──────────────┘        │
│         │                   │                    │               │
│         ▼                   ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Native Bindings                        │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │  │
│  │  │ Windows │   │  Files  │   │  Apps   │   │ System  │  │  │
│  │  │ Manager │   │  Ops    │   │ Launcher│   │ Control │  │  │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │     Operating System APIs       │
              │  Win32 / AppleScript / X11     │
              └────────────────────────────────┘
```

### Component Breakdown

#### 1. Electron Shell (`/src/electron/`)
- System tray icon and menu
- Global hotkey registration (Ctrl/Cmd + Space)
- Floating command palette window
- Settings/preferences window
- Native notification integration

#### 2. Copilot SDK Integration (`/src/copilot/`)
- SDK client initialization
- Session management
- Tool registration
- Event streaming handler
- Permission request handling

#### 3. Tool Registry (`/src/tools/`)
- Window management tools
- File system tools
- Application control tools
- System settings tools
- Clipboard tools
- Process monitoring tools

#### 4. Platform Adapters (`/src/platform/`)
- Windows adapter (Win32 API via ffi-napi or node-ffi)
- macOS adapter (AppleScript + node-applescript, Accessibility API)
- Linux adapter (X11/Wayland via xdotool, dbus)

---

## Technology Stack

### Core

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Desktop App | Electron 28+ | Cross-platform, native integration, mature ecosystem |
| Language | TypeScript 5.x | Type safety, better tooling, SDK compatibility |
| SDK | @github/copilot-sdk | Official GitHub Copilot SDK for Node.js |
| Build | Vite + electron-builder | Fast builds, reliable packaging |

### Platform-Specific Native Modules

| Platform | Technology | Purpose |
|----------|------------|---------|
| Windows | node-ffi-napi + Win32 | Window management, process control |
| Windows | powershell (child_process) | System settings, file operations |
| macOS | node-applescript | Window/app control via AppleScript |
| macOS | Accessibility API (native module) | Window positioning, UI automation |
| Linux | xdotool (child_process) | Window management |
| Linux | dbus (node-dbus) | System settings, notifications |

### UI

| Component | Technology |
|-----------|------------|
| Command Palette | React 18 + Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |
| State | Zustand |

---

## Tools Specification

### Tool Categories

#### 1. Window Management (`window.*`)

```typescript
// window.list - List all open windows
interface WindowListResult {
  windows: {
    id: string;
    title: string;
    app: string;
    bounds: { x: number; y: number; width: number; height: number };
    isMinimized: boolean;
    isFocused: boolean;
  }[];
}

// window.focus - Focus a specific window
interface WindowFocusParams {
  windowId?: string;
  appName?: string;
  titleContains?: string;
}

// window.move - Move/resize a window
interface WindowMoveParams {
  windowId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// window.arrange - Arrange windows in a layout
interface WindowArrangeParams {
  layout: 'side-by-side' | 'stacked' | 'grid' | 'custom';
  windows?: string[]; // Window IDs to arrange
  custom?: { windowId: string; bounds: Bounds }[];
}

// window.close - Close windows
interface WindowCloseParams {
  windowId?: string;
  appName?: string;
  allExcept?: string; // Close all except this app
}

// window.minimize / window.maximize
interface WindowStateParams {
  windowId: string;
}
```

#### 2. File System (`files.*`)

```typescript
// files.list - List files in a directory
interface FilesListParams {
  path: string;
  recursive?: boolean;
  filter?: {
    extension?: string[];
    nameContains?: string;
    modifiedAfter?: string; // ISO date
    modifiedBefore?: string;
    sizeGreaterThan?: number;
    sizeLessThan?: number;
  };
}

// files.search - Search for files
interface FilesSearchParams {
  query: string; // Filename pattern
  startPath?: string;
  maxResults?: number;
}

// files.move - Move files
interface FilesMoveParams {
  source: string | string[];
  destination: string;
  overwrite?: boolean;
}

// files.copy - Copy files
interface FilesCopyParams {
  source: string | string[];
  destination: string;
  overwrite?: boolean;
}

// files.delete - Delete files (with safety)
interface FilesDeleteParams {
  paths: string[];
  moveToTrash?: boolean; // Default true for safety
}

// files.rename - Rename a file
interface FilesRenameParams {
  path: string;
  newName: string;
}

// files.create_folder - Create directory
interface FilesCreateFolderParams {
  path: string;
}

// files.read - Read file contents (for text files)
interface FilesReadParams {
  path: string;
  encoding?: string;
  maxSize?: number; // Limit to prevent reading huge files
}

// files.info - Get file metadata
interface FilesInfoParams {
  path: string;
}
```

#### 3. Applications (`apps.*`)

```typescript
// apps.list - List installed/running applications
interface AppsListParams {
  filter?: 'running' | 'installed' | 'all';
}

// apps.launch - Launch an application
interface AppsLaunchParams {
  name?: string;
  path?: string;
  args?: string[];
}

// apps.quit - Quit an application
interface AppsQuitParams {
  name: string;
  force?: boolean;
}

// apps.switch - Switch to an application
interface AppsSwitchParams {
  name: string;
}
```

#### 4. System Control (`system.*`)

```typescript
// system.volume - Get/set system volume
interface SystemVolumeParams {
  action: 'get' | 'set' | 'mute' | 'unmute';
  level?: number; // 0-100
}

// system.brightness - Get/set display brightness
interface SystemBrightnessParams {
  action: 'get' | 'set';
  level?: number; // 0-100
}

// system.wifi - Control Wi-Fi
interface SystemWifiParams {
  action: 'status' | 'on' | 'off' | 'list_networks' | 'connect';
  network?: string;
  password?: string;
}

// system.bluetooth - Control Bluetooth
interface SystemBluetoothParams {
  action: 'status' | 'on' | 'off' | 'list_devices' | 'connect' | 'disconnect';
  device?: string;
}

// system.dnd - Do Not Disturb mode
interface SystemDndParams {
  action: 'status' | 'on' | 'off';
  duration?: number; // Minutes
}

// system.screenshot - Take a screenshot
interface SystemScreenshotParams {
  region?: 'fullscreen' | 'window' | 'selection';
  savePath?: string;
  filename?: string;
}

// system.lock - Lock the screen
interface SystemLockParams {}

// system.sleep - Put computer to sleep
interface SystemSleepParams {}
```

#### 5. Process Monitoring (`process.*`)

```typescript
// process.list - List running processes
interface ProcessListParams {
  sortBy?: 'cpu' | 'memory' | 'name';
  limit?: number;
}

// process.info - Get process details
interface ProcessInfoParams {
  pid?: number;
  name?: string;
}

// process.kill - Kill a process
interface ProcessKillParams {
  pid?: number;
  name?: string;
  force?: boolean;
}

// process.top - Get top resource consumers
interface ProcessTopParams {
  resource: 'cpu' | 'memory';
  limit?: number;
}
```

#### 6. Clipboard (`clipboard.*`)

```typescript
// clipboard.read - Read clipboard contents
interface ClipboardReadParams {
  format?: 'text' | 'html' | 'image' | 'files';
}

// clipboard.write - Write to clipboard
interface ClipboardWriteParams {
  content: string;
  format?: 'text' | 'html';
}

// clipboard.history - Get clipboard history
interface ClipboardHistoryParams {
  limit?: number;
}

// clipboard.clear - Clear clipboard
interface ClipboardClearParams {}
```

---

## Permission System

### Permission Levels

```typescript
enum PermissionLevel {
  // No confirmation needed
  READ_ONLY = 'read_only',      // List windows, files, processes

  // Ask once per session
  STANDARD = 'standard',        // Move windows, launch apps

  // Always confirm
  SENSITIVE = 'sensitive',      // Move/delete files, change settings

  // Require explicit approval with warning
  DANGEROUS = 'dangerous',      // Kill processes, system sleep/lock
}
```

### Tool Permission Mapping

| Tool | Permission Level |
|------|------------------|
| window.list | READ_ONLY |
| window.focus | STANDARD |
| window.move | STANDARD |
| window.close | SENSITIVE |
| files.list | READ_ONLY |
| files.search | READ_ONLY |
| files.move | SENSITIVE |
| files.delete | DANGEROUS |
| apps.list | READ_ONLY |
| apps.launch | STANDARD |
| apps.quit | SENSITIVE |
| system.volume | STANDARD |
| system.screenshot | STANDARD |
| system.lock | DANGEROUS |
| process.list | READ_ONLY |
| process.kill | DANGEROUS |

### Confirmation UI

For SENSITIVE and DANGEROUS operations:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Confirmation Required                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ The assistant wants to:                                     │
│                                                             │
│   Delete 12 files from ~/Downloads                          │
│                                                             │
│   Files:                                                    │
│   • old-report.pdf                                          │
│   • image-2024-01.png                                       │
│   ... and 10 more                                           │
│                                                             │
│ ☑️ Move to Trash (safer)                                   │
│ ☐ Permanently delete                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│         [Cancel]              [Allow This Once]             │
└─────────────────────────────────────────────────────────────┘
```

---

## User Interface

### System Tray

- Icon in system tray (platform-specific location)
- Right-click menu:
  - Open Commander (or hotkey reminder)
  - Settings
  - View History
  - About
  - Quit

### Command Palette

Activated via global hotkey (Ctrl/Cmd + Space):

```
┌─────────────────────────────────────────────────────────────────┐
│  🖥️ Desktop Commander                                    ─ □ ✕  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ What would you like to do?                            🎤  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Recent:                                                         │
│  • "Arrange browser and terminal side by side"                  │
│  • "Find large files in Downloads"                              │
│  • "Turn off Wi-Fi"                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Active Session View

When a command is being processed:

```
┌─────────────────────────────────────────────────────────────────┐
│  🖥️ Desktop Commander                                    ─ □ ✕  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  💬 "Organize my Downloads folder by file type"                 │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  📂 Analyzing Downloads folder...                               │
│                                                                  │
│  Found 156 files:                                               │
│  • 📄 Documents (34): PDF, DOCX, TXT                           │
│  • 🖼️ Images (45): PNG, JPG, GIF                               │
│  • 📦 Archives (12): ZIP, TAR.GZ                               │
│  • 🎵 Audio (8): MP3, WAV                                      │
│  • 📹 Video (5): MP4, MOV                                      │
│  • 💻 Code (23): JS, PY, JSON                                  │
│  • 📎 Other (29): Various formats                              │
│                                                                  │
│  I'll create folders and organize files. Proceed?               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Yes, organize them                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Wait, exclude the code files                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Cancel                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
desktop-commander/
├── package.json
├── tsconfig.json
├── electron-builder.json
├── vite.config.ts
├── .env.example
├── README.md
├── PLAN.md
│
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Entry point
│   │   ├── tray.ts                # System tray management
│   │   ├── windows.ts             # Window management (Electron)
│   │   ├── hotkeys.ts             # Global hotkey registration
│   │   ├── ipc.ts                 # IPC handlers
│   │   └── store.ts               # Electron store for settings
│   │
│   ├── renderer/                  # Electron renderer (React)
│   │   ├── index.html
│   │   ├── main.tsx               # React entry
│   │   ├── App.tsx                # Main app component
│   │   ├── components/
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── MessageStream.tsx
│   │   │   ├── ConfirmationDialog.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── HistoryPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useCopilot.ts
│   │   │   ├── useHotkey.ts
│   │   │   └── useTheme.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   ├── copilot/                   # Copilot SDK integration
│   │   ├── client.ts              # SDK client setup
│   │   ├── session.ts             # Session management
│   │   ├── tools.ts               # Tool registration
│   │   └── permissions.ts         # Permission handling
│   │
│   ├── tools/                     # Tool implementations
│   │   ├── index.ts               # Tool registry
│   │   ├── window.ts              # Window management tools
│   │   ├── files.ts               # File system tools
│   │   ├── apps.ts                # Application tools
│   │   ├── system.ts              # System control tools
│   │   ├── process.ts             # Process monitoring tools
│   │   └── clipboard.ts           # Clipboard tools
│   │
│   ├── platform/                  # Platform-specific implementations
│   │   ├── index.ts               # Platform detection & adapter selection
│   │   ├── types.ts               # Shared types
│   │   ├── windows/
│   │   │   ├── index.ts
│   │   │   ├── window-manager.ts
│   │   │   ├── file-system.ts
│   │   │   ├── apps.ts
│   │   │   └── system.ts
│   │   ├── macos/
│   │   │   ├── index.ts
│   │   │   ├── window-manager.ts
│   │   │   ├── file-system.ts
│   │   │   ├── apps.ts
│   │   │   └── system.ts
│   │   └── linux/
│   │       ├── index.ts
│   │       ├── window-manager.ts
│   │       ├── file-system.ts
│   │       ├── apps.ts
│   │       └── system.ts
│   │
│   └── shared/                    # Shared utilities
│       ├── types.ts
│       ├── constants.ts
│       └── utils.ts
│
├── scripts/
│   ├── build.ts
│   └── dev.ts
│
├── resources/                     # App resources
│   ├── icon.png
│   ├── icon.ico
│   └── icon.icns
│
└── tests/
    ├── tools/
    │   ├── window.test.ts
    │   ├── files.test.ts
    │   └── ...
    └── e2e/
        └── ...
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Basic Electron app with Copilot SDK integration and one working tool category.

- [ ] Project setup (Electron + Vite + TypeScript)
- [ ] System tray with basic menu
- [ ] Global hotkey registration
- [ ] Command palette UI (basic)
- [ ] Copilot SDK client integration
- [ ] Session management
- [ ] Basic streaming response display
- [ ] **Window management tools (Windows only)**
  - [ ] window.list
  - [ ] window.focus
  - [ ] window.move
  - [ ] window.arrange

**Deliverable:** Can list, focus, and arrange windows via natural language on Windows.

### Phase 2: File System Tools (Week 3)

**Goal:** Complete file system operations with safety measures.

- [ ] files.list with filters
- [ ] files.search
- [ ] files.move
- [ ] files.copy
- [ ] files.delete (with trash support)
- [ ] files.rename
- [ ] files.create_folder
- [ ] Permission confirmation dialogs
- [ ] Undo support for file operations

**Deliverable:** Full file management via natural language.

### Phase 3: Application & System Control (Week 4)

**Goal:** Control apps and system settings.

- [ ] apps.list
- [ ] apps.launch
- [ ] apps.quit
- [ ] apps.switch
- [ ] system.volume
- [ ] system.brightness
- [ ] system.screenshot
- [ ] system.dnd
- [ ] system.lock

**Deliverable:** Complete system control capabilities.

### Phase 4: Process & Clipboard (Week 5)

**Goal:** Advanced monitoring and clipboard operations.

- [ ] process.list
- [ ] process.top
- [ ] process.kill
- [ ] clipboard.read
- [ ] clipboard.write
- [ ] clipboard.history (local storage)

**Deliverable:** Process management and clipboard AI.

### Phase 5: macOS Support (Week 6)

**Goal:** Full macOS compatibility.

- [ ] macOS platform adapter
- [ ] AppleScript integration
- [ ] Accessibility API integration
- [ ] macOS-specific system controls
- [ ] Testing on macOS

**Deliverable:** Feature parity on macOS.

### Phase 6: Linux Support (Week 7)

**Goal:** Full Linux compatibility.

- [ ] Linux platform adapter
- [ ] X11/Wayland support
- [ ] xdotool integration
- [ ] dbus integration
- [ ] Testing on Ubuntu/Fedora

**Deliverable:** Feature parity on Linux.

### Phase 7: Polish & Release (Week 8)

**Goal:** Production-ready release.

- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Settings UI
- [ ] Command history
- [ ] Auto-update support
- [ ] Code signing (Windows/macOS)
- [ ] Documentation
- [ ] Release builds

**Deliverable:** v1.0 release.

---

## Example Interactions

### Window Management

```
User: "Put my browser on the left half and terminal on the right"
Copilot: I'll arrange your windows for you.

[Tool Call: window.list]
 Found: Chrome (PID 1234), Windows Terminal (PID 5678)

[Tool Call: window.arrange left_half]
 Chrome moved to left half

[Tool Call: window.arrange right_half]
 Terminal moved to right half

Copilot: Done! Browser is on the left, terminal on the right.
```

### File System Operations

```
User: "Find all PDFs I downloaded this week and move them to my Documents folder"

Copilot: I'll search your Downloads folder for recent PDFs.

[Tool Call: files.search downloads *.pdf modified:7d]
 Found 5 PDFs: invoice.pdf, report.pdf, manual.pdf, receipt.pdf, contract.pdf

[Permission Request: Move 5 files to Documents?]
[User: Approve]

[Tool Call: files.move ...]
 5 files moved to C:\Users\...\Documents

Copilot: Moved 5 PDFs to your Documents folder.
```

### Application Control

```
User: "Close all my browsers and open Spotify"

Copilot: I'll close browsers and launch Spotify.

[Tool Call: apps.list]
 Running: Chrome, Firefox, Edge, Slack, Terminal

[Tool Call: apps.quit Chrome, Firefox, Edge]
 3 browsers closed

[Tool Call: apps.launch Spotify]
 Spotify launched

Copilot: Done! Closed 3 browsers and Spotify is now open.
```

### System Control

```
User: "I'm about to present, set up my screen"

Copilot: Setting up presentation mode:

[Tool Call: system.dnd enable]
 Do Not Disturb enabled

[Tool Call: system.brightness 80]
 Brightness set to 80%

[Tool Call: system.volume 50]
 Volume set to 50%

Copilot: You're ready! DND is on, brightness at 80%, volume at 50%.
```

### Process Management

```
User: "What's using all my CPU?"

Copilot: Let me check your running processes.

[Tool Call: process.top cpu 5]
 Top 5 by CPU: node.exe (45%), chrome.exe (20%), ...

Copilot: Node.js is using 45% of your CPU. Want me to show details or end it?
```

### Multi-Step Workflows

```
User: "I'm done for the day, prepare my computer for shutdown"

Copilot: I'll prepare your computer for shutdown.

[Tool Call: apps.list]
 12 apps running

[Permission Request: Close all applications?]
[User: Approve]

[Tool Call: apps.quit_all]
 Applications closed

[Tool Call: clipboard.clear]
 Clipboard cleared

Copilot: All apps closed, clipboard cleared. Ready to shut down.
Want me to put the computer to sleep?
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Accidental file deletion | Medium | High | Require confirmation, implement trash/undo |
| Wrong window targeted | Medium | Low | Show preview before action, allow undo |
| System setting conflicts | Low | Medium | Log all changes, provide quick restore |
| Permission fatigue | Medium | Medium | Smart grouping, remember preferences |
| Platform API differences | High | High | Abstraction layer, extensive testing |
| Performance impact | Low | Medium | Lazy loading, efficient polling |

---

## Configuration

### settings.json

```json
{
  "desktop-commander": {
    "hotkey": "Ctrl+Shift+Space",
    "theme": "system",
    "permissions": {
      "defaultLevel": "STANDARD",
      "rememberChoices": true,
      "requireConfirmFor": ["files.delete", "process.kill", "system.sleep"]
    },
    "tools": {
      "enabled": ["window", "files", "apps", "system", "process", "clipboard"],
      "disabled": []
    },
    "ui": {
      "showInTray": true,
      "floatingWindow": true,
      "toastNotifications": true
    },
    "safety": {
      "maxFilesPerOperation": 100,
      "protectedPaths": ["C:\\Windows", "C:\\Program Files"],
      "requireConfirmAbove": "10 files"
    }
  }
}
```

---

## Success Metrics

### User Engagement
- Daily active users
- Commands executed per session
- Session duration
- Retention rate (7-day, 30-day)

### Performance
- Time from command to first action
- Tool execution success rate
- Error rate by tool category

### User Satisfaction
- Task completion rate
- Permission approval rate
- Feature usage distribution

### Quality
- Crash rate
- Memory usage over time
- CPU usage at idle

---

## Conclusion

Desktop Commander demonstrates the power of the GitHub Copilot SDK by adding an AI layer to the operating system itself. Users can control their entire computer with natural language while maintaining complete safety through a robust permission system.

### Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Copilot SDK credentials
4. Run in development: `npm run dev`
5. Build for production: `npm run build`

### Next Steps

1. **Phase 1 Start**: Set up Electron + React + Vite foundation
2. **SDK Integration**: Connect to Copilot SDK with tool registration
3. **First Tool**: Implement window.list as proof of concept
4. **Permission System**: Build confirmation UI
5. **Iterate**: Add tools category by category

---

*This plan is a living document. Update as development progresses.*
