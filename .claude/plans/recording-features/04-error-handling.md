# Feature: Error Handling Improvements

## Summary
Improve error messages for recording failures across tools, IPC, and UI.

## Status
- [ ] Not started

## Dependencies
- 01-device-discovery.md

## Tasks
- [ ] Add FFmpeg availability check on app startup, store status
- [ ] Show FFmpeg status in Settings > Recording (installed/missing with install link)
- [ ] Improve tool error messages: "FFmpeg not found. Install from https://ffmpeg.org"
- [ ] Add device validation before recording starts
- [ ] Surface recording errors in RecordingsPanel (not just console)
- [ ] Handle output path permission errors gracefully

## Implementation Notes
- Current errors are technical (FFmpeg stderr output)
- Users need actionable error messages
- Consider toast notifications for recording failures

## Files to Modify
- `src/main/recording-manager.ts` - Better error messages
- `src/tools/index.ts` - Improve tool error responses
- `src/renderer/components/SettingsPanel.tsx` - Show FFmpeg status
- `src/renderer/components/RecordingsPanel.tsx` - Show errors

## Acceptance Criteria
- User sees clear message if FFmpeg not installed
- User sees clear message if device not found
- User sees clear message if output path not writable
- Errors visible in UI, not just logs
