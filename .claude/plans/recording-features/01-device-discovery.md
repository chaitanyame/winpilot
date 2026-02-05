# Feature: Device Discovery

## Summary
Expose FFmpeg device enumeration via IPC so renderer can display available audio/video devices.

## Status
- [ ] Not started

## Dependencies
- None (foundation feature)

## Tasks
- [ ] Add `listAudioDevices()` and `listVideoDevices()` IPC handlers in `src/main/ipc.ts`
- [ ] Expose in preload: `window.electronAPI.recordingListAudioDevices()` and `recordingListVideoDevices()`
- [ ] Add types for `AudioDevice` and `VideoDevice` in `src/shared/types.ts`
- [ ] Test device enumeration returns correct devices on Windows

## Implementation Notes
- `RecordingManager` already has `listAudioDevices()` and `listVideoDevices()` methods
- Just need to wire them through IPC

## Files to Modify
- `src/main/ipc.ts` - Add handlers
- `src/preload/index.ts` - Expose to renderer
- `src/shared/types.ts` - Export device types

## Acceptance Criteria
- Calling `window.electronAPI.recordingListAudioDevices()` returns array of audio devices
- Calling `window.electronAPI.recordingListVideoDevices()` returns array of video devices
- Empty array returned gracefully if FFmpeg unavailable
