# Web Speech API Improvements

## Overview
Improved the Web Speech API implementation in Desktop Commander with better error handling, user feedback, and configuration support.

## Changes Made

### 1. Removed Input Dependency Bug
**Before:**
```typescript
}, [input]); // Re-initialized on every keystroke!
```

**After:**
```typescript
}, [voiceLanguage]); // Only re-initializes when language changes
```

**Impact:** Speech recognition no longer re-initializes on every keystroke, improving performance and stability.

### 2. Load Language from Settings
**Before:**
```typescript
recognition.lang = 'en-US'; // Hardcoded
```

**After:**
```typescript
// Load from settings on mount
useEffect(() => {
  const loadVoiceSettings = async () => {
    const settings = await window.electronAPI.getSettings();
    if (settings?.voiceInput?.language) {
      setVoiceLanguage(settings.voiceInput.language);
    }
  };
  loadVoiceSettings();
}, []);

// Update recognition when language changes
useEffect(() => {
  if (recognitionRef.current && recognitionRef.current.lang !== voiceLanguage) {
    recognitionRef.current.lang = voiceLanguage;
  }
}, [voiceLanguage]);
```

**Impact:** Voice recognition now respects the user's language preference from settings.

### 3. User-Friendly Error Messages
**Before:**
```typescript
console.error('Speech recognition error:', event.error);
setIsRecording(false);
```

**After:**
```typescript
const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No speech detected. Please try again.',
  'audio-capture': 'Microphone not found or not accessible.',
  'not-allowed': 'Microphone permission denied. Please allow microphone access.',
  'network': 'Network error. Please check your connection.',
  'aborted': 'Recording was cancelled.',
  'service-not-allowed': 'Speech recognition service is not allowed.',
};

const errorMessage = SPEECH_ERROR_MESSAGES[event.error] || `Speech recognition error: ${event.error}`;
setVoiceError(errorMessage);
clearVoiceError(); // Auto-hide after 3 seconds
```

**Impact:** Users now see clear, actionable error messages instead of cryptic error codes.

### 4. Confidence-Based Filtering
**Before:**
```typescript
const transcript = event.results[0][0].transcript;
// Accepted all transcripts regardless of confidence
```

**After:**
```typescript
const CONFIDENCE_THRESHOLD = 0.5;
const result = event.results[0][0];
const transcript = result.transcript;
const confidence = result.confidence;

if (confidence < CONFIDENCE_THRESHOLD) {
  setVoiceError('Speech was unclear. Please try again.');
  clearVoiceError();
  return;
}
```

**Impact:** Low-confidence transcriptions are rejected, reducing errors from unclear speech.

### 5. Speech Detection Feedback
**Before:**
```typescript
<Mic className="w-4 h-4 animate-pulse" />
<span>Listening...</span>
```

**After:**
```typescript
{isSpeechDetected ? (
  <Volume2 className="w-4 h-4 animate-pulse" />
) : (
  <Mic className="w-4 h-4 animate-pulse" />
)}
<span className="text-sm font-medium">
  {isSpeechDetected ? 'Capturing...' : 'Listening...'}
</span>
```

**Impact:** Visual feedback when speech is detected vs. just waiting for input.

### 6. Dynamic Voice Hotkey Display
**Before:**
```typescript
placeholder="What would you like to do? (Voice: Ctrl+Shift+V)"
```

**After:**
```typescript
const [voiceHotkey, setVoiceHotkey] = useState('Ctrl+Shift+V');

// Load from settings
useEffect(() => {
  const settings = await window.electronAPI.getSettings();
  if (settings?.voiceInput?.hotkey) {
    setVoiceHotkey(settings.voiceInput.hotkey);
  }
}, []);

placeholder={`What would you like to do? (Voice: ${voiceHotkey})`}
```

**Impact:** Placeholder shows the actual hotkey from settings.

### 7. Better State Management
**New States:**
- `voiceError: string | null` - User-friendly error messages
- `voiceLanguage: string` - Current recognition language
- `voiceHotkey: string` - Current voice hotkey
- `isSpeechDetected: boolean` - Whether speech has been detected

**New Refs:**
- `voiceErrorTimeoutRef` - Clears error messages after delay
- `speechTimeoutRef` - Manages speech detection timeout

### 8. Improved Error Handling

**Before:**
```typescript
try {
  recognitionRef.current.start();
} catch (err) {
  console.error('Failed to start speech recognition:', err);
  setIsRecording(false);
}
```

**After:**
```typescript
try {
  recognitionRef.current.lang = voiceLanguage;
  recognitionRef.current.start();
} catch (err) {
  if (err instanceof Error && err.message.includes('already started')) {
    setVoiceError('Recording already in progress');
  } else {
    setVoiceError('Failed to start speech recognition');
  }
  clearVoiceError();
  setIsRecording(false);
}
```

**Impact:** Better error messages and handling for specific error conditions.

## Summary of Improvements

| Issue | Before | After |
|-------|--------|-------|
| Re-initialization | On every keystroke | Only on language change |
| Language support | Hardcoded 'en-US' | From settings |
| Error messages | Console logs | User-friendly UI messages |
| Confidence filtering | None | 50% threshold |
| Speech feedback | "Listening..." only | "Listening..." / "Capturing..." |
| Hotkey display | Hardcoded | From settings |
| Error display | None | Orange toast notification |
| State cleanup | Partial | Complete with timeouts |

## Testing Checklist

- [ ] Language changes in settings update recognition
- [ ] Error messages display correctly
- [ ] Speech detection indicator shows
- [ ] Hotkey changes update placeholder
- [ ] Low confidence transcriptions are rejected
- [ ] Recognition doesn't re-initialize on typing
- [ ] Microphone permission error shows
- [ ] No-speech error shows and clears
- [ ] Multiple recordings work without errors

## Files Modified

- `src/renderer/components/CommandPalette.tsx` - Main improvements
