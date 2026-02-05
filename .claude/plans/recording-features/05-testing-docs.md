# Feature: Testing and Documentation

## Summary
Create manual test checklist and update documentation for recording features.

## Status
- [ ] Not started

## Dependencies
- 03-recording-manager-fixes.md
- 04-error-handling.md

## Tasks
- [ ] Create manual test checklist in TESTING_GUIDE.md
- [ ] Test screen recording with system audio
- [ ] Test screen recording with microphone
- [ ] Test audio-only recording
- [ ] Test recording stop produces valid file
- [ ] Test RecordingsPanel shows recordings
- [ ] Test playback of recorded files
- [ ] Update README with recording feature documentation
- [ ] Document FFmpeg requirement and installation

## Manual Test Checklist
```
Screen Recording:
- [ ] Start screen recording via tool/command
- [ ] Stop screen recording
- [ ] Verify MP4 file created in output directory
- [ ] Verify file plays correctly
- [ ] Verify audio captured (if selected)

Audio Recording:
- [ ] Start audio recording via tool/command
- [ ] Stop audio recording  
- [ ] Verify MP3/WAV file created
- [ ] Verify file plays correctly

UI:
- [ ] RecordingsPanel shows active recording with progress
- [ ] RecordingsPanel shows completed recordings
- [ ] Can play recording from panel
- [ ] Can open folder from panel
- [ ] Can delete recording from panel

Hotkeys:
- [ ] Ctrl+Shift+A toggles audio recording
- [ ] Ctrl+Shift+R toggles screen recording

Error Cases:
- [ ] Clear error if FFmpeg missing
- [ ] Clear error if device unavailable
```

## Files to Modify
- `TESTING_GUIDE.md` - Add recording test section
- `README.md` - Add recording feature docs

## Acceptance Criteria
- Manual test checklist exists and is followed
- All tests pass
- Documentation updated
