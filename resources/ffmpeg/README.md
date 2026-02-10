# FFmpeg Binary Setup

This directory contains FFmpeg binaries for screen/audio recording functionality.

## Directory Structure

```
resources/ffmpeg/
├── windows/
│   └── ffmpeg.exe
├── macos/
│   └── ffmpeg
├── linux/
│   └── ffmpeg
└── README.md
```

## Development Setup

### Windows

1. Download FFmpeg from https://www.gyan.dev/ffmpeg/builds/
2. Get the "essentials" build (~80MB)
3. Extract and copy `ffmpeg.exe` to `resources/ffmpeg/windows/`

### macOS

1. Install via Homebrew: `brew install ffmpeg`
2. Or download from https://evermeet.cx/ffmpeg/
3. Copy the binary to `resources/ffmpeg/macos/`

### Linux

1. Install via package manager: `apt install ffmpeg` or `yum install ffmpeg`
2. Or download a static build from https://johnvansickle.com/ffmpeg/
3. Copy the binary to `resources/ffmpeg/linux/`

## Production

FFmpeg binaries are bundled with the app via electron-builder's `extraResources` configuration.
They will be located at `process.resourcesPath/ffmpeg/` in the packaged app.

## Alternative: System FFmpeg

If FFmpeg is not bundled, the app will also check common system paths:
- Windows: `C:\Program Files\ffmpeg\bin\ffmpeg.exe`, `C:\ffmpeg\bin\ffmpeg.exe`
- macOS: `/usr/local/bin/ffmpeg`, `/opt/homebrew/bin/ffmpeg`
- Linux: `/usr/bin/ffmpeg`, `/usr/local/bin/ffmpeg`

## File Size Note

The FFmpeg essentials build is approximately 80MB. Consider using git-lfs for binary storage
or downloading FFmpeg on first run if bundle size is a concern.
