# Feature: Recording Manager Device Integration

## Summary
Update RecordingManager to use user-selected devices instead of hardcoded names, and remove non-functional "both" audio option.

## Status
- [x] Completed

## Dependencies
- 01-device-discovery.md

## Tasks
- [x] Modify `getAudioInputDevice()` to read from settings first, fall back to defaults
- [x] Modify `buildWebcamRecordingArgs()` to use selected video device
- [x] Remove `AudioSource.BOTH` option from types enum
- [x] Update tool schema in `src/tools/index.ts` to remove "both" from enum
- [x] Make build methods async to support settings lookup

## Implementation Notes
- Current hardcoded values: "Stereo Mix", "Microphone", "Integrated Camera"
- Need to handle case where user's selected device was unplugged
- Consider caching device list to avoid repeated FFmpeg calls

## Files to Modify
- `src/main/recording-manager.ts` - Device selection logic
- `src/tools/index.ts` - Remove "both" from audioSource enum
- `src/shared/types.ts` - Optionally remove AudioSource.BOTH

## Acceptance Criteria
- Screen recording uses user-selected audio device
- Audio recording uses user-selected audio device
- Webcam recording uses user-selected video device
- Clear error if selected device unavailable
- "both" option removed from tool parameters
