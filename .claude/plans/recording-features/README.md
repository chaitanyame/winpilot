# Recording Features Enhancement Plan

## Overview
Robustify audio/video recording features by implementing device discovery, improving error handling, and wiring UI properly.

## Current State
- FFmpeg-based recording manager exists (`src/main/recording-manager.ts`)
- Tools: `screen_record_start/stop/status`, `audio_record_start/stop`
- Hotkeys: Ctrl+Shift+A (audio), Ctrl+Shift+R (video)
- RecordingsPanel UI exists for viewing/managing recordings
- Windows-only implementation using DirectShow

## Limitations to Address
1. Hardcoded device names ("Stereo Mix", "Microphone", "Integrated Camera")
2. No device selection UI
3. "both" audio source not actually implemented (falls back to system)
4. Webcam recording uses hardcoded device name
5. Recording windows (audio/video) created but may not be fully wired
6. Limited error messaging for FFmpeg/device failures

## Feature Files
| Feature | Description | Can Parallelize |
|---------|-------------|-----------------|
| 01-device-discovery.md | FFmpeg device enumeration + IPC | No (foundation) |
| 02-settings-ui.md | Device selection in Settings | After 01 |
| 03-recording-manager-fixes.md | Use selected devices, remove "both" option | After 01 |
| 04-error-handling.md | Improve error UX across stack | After 01 |
| 05-testing-docs.md | Manual test checklist + docs | After 03, 04 |

## Scope Decisions
- **Platform**: Windows-only for now (macOS/Linux deferred)
- **Webcam**: Include in device discovery but deprioritize testing
- **Audio "both"**: Remove option (document as limitation vs complex FFmpeg mixing)

## Execution Order
```
01-device-discovery
       |
       v
  +----+----+
  |         |
  v         v
02-settings  03-recording-manager
  |         |
  +----+----+
       |
       v
04-error-handling
       |
       v
05-testing-docs
```
