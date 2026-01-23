# Desktop Commander Icons

This folder contains application icons for electron-builder packaging.

## Required Icon Files

### icon.ico (Windows)
- **Format**: ICO (Windows Icon)
- **Minimum Size**: 256x256 pixels
- **Recommended**: Include multiple sizes (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
- **Used by**: Windows NSIS installer and executable

### icon.icns (macOS)
- **Format**: ICNS (Apple Icon Image)
- **Sizes Required**: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- **Note**: Can be generated from a 1024x1024 PNG using `iconutil` on macOS
- **Used by**: macOS DMG and application bundle

### icon.png (Linux)
- **Format**: PNG
- **Recommended Size**: 512x512 pixels (256x256 minimum)
- **Used by**: Linux AppImage and .deb packages

## Generating Icons

### From a source PNG (512x512 or 1024x1024):

**Windows (.ico)**:
- Use ImageMagick: `magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
- Or use online tools like [ConvertICO](https://convertico.com/)

**macOS (.icns)**:
```bash
# Create iconset folder with required sizes
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

**Linux (.png)**:
- Simply use your source PNG resized to 512x512

## Design Recommendations

- Use a simple, recognizable design that works at small sizes
- Ensure good contrast for visibility in taskbars and docks
- Consider both light and dark mode contexts
- Desktop Commander suggestion: A command terminal/console icon with a lightning bolt or wand
