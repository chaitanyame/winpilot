# Feature: Settings UI for Device Selection

## Summary
Add device selection dropdowns in Settings > Recording tab so users can choose preferred audio/video devices.

## Status
- [x] Completed

## Dependencies
- 01-device-discovery.md

## Tasks
- [x] Add to Settings type: `recording.preferredAudioDevice`, `recording.preferredVideoDevice`
- [x] Add default values in `src/shared/constants.ts` (undefined = auto-detect)
- [x] Add migration logic in `src/main/store.ts`
- [x] In SettingsPanel Recording tab, fetch devices on mount
- [x] Render dropdown for audio device selection
- [x] Render dropdown for video device selection  
- [x] Save selected devices to settings
- [x] Show "Refresh devices" button

## Implementation Notes
- Use existing Recording tab in SettingsPanel
- Handle case where no devices found (show message)
- Handle case where previously selected device no longer exists

## Files to Modify
- `src/shared/types.ts` - Extend Settings.recording
- `src/main/store.ts` - Add defaults
- `src/renderer/components/SettingsPanel.tsx` - Add dropdowns

## Acceptance Criteria
- User can see list of available audio devices in Settings
- User can see list of available video devices in Settings
- Selected devices persist across app restarts
- Graceful handling when no devices available
