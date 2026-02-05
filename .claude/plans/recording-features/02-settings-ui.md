# Feature: Settings UI for Device Selection

## Summary
Add device selection dropdowns in Settings > Recording tab so users can choose preferred audio/video devices.

## Status
- [ ] Not started

## Dependencies
- 01-device-discovery.md

## Tasks
- [ ] Add to Settings type: `recording.preferredAudioDevice`, `recording.preferredVideoDevice`
- [ ] Add default values in `src/main/store.ts`
- [ ] In SettingsPanel Recording tab, fetch devices on mount
- [ ] Render dropdown for audio device selection
- [ ] Render dropdown for video device selection  
- [ ] Save selected devices to settings
- [ ] Show "Refresh devices" button

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
