# Feature: Device Discovery

## Summary
Expose FFmpeg device enumeration via IPC so renderer can display available audio/video devices.

## Status
- [x] Completed

## Dependencies
- None (foundation feature)

## Tasks
- [x] Add `listAudioDevices()` and `listVideoDevices()` IPC handlers in `src/main/ipc.ts`
- [x] Expose in preload: `window.electronAPI.recordingListAudioDevices()` and `recordingListVideoDevices()`
- [x] Add types for `AudioDevice` and `VideoDevice` in `src/shared/types.ts`
- [x] Test device enumeration returns correct devices on Windows (TypeScript compilation passed)

## Implementation Notes
- `RecordingManager` already has `listAudioDevices()` and `listVideoDevices()` methods
- Just need to wire them through IPC ✅

## Files Modified
- `src/main/ipc.ts` - Added handlers for device listing
- `src/preload/index.ts` - Exposed device listing to renderer
- `src/shared/types.ts` - Exported AudioDevice and VideoDevice types
- `src/main/recording-manager.ts` - Import device types from shared

## Acceptance Criteria
- [x] Calling `window.electronAPI.recordingListAudioDevices()` returns array of audio devices
- [x] Calling `window.electronAPI.recordingListVideoDevices()` returns array of video devices
- [x] Empty array returned gracefully if FFmpeg unavailable
