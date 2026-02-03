// Windows OCR Implementation
// Uses Windows.Media.Ocr API via PowerShell for text extraction

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Annotation types for screenshot markup
 */
export interface Annotation {
  type: 'rectangle' | 'arrow' | 'text' | 'highlight';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  color?: string;
  text?: string;
  thickness?: number;
}

/**
 * OCR Interface
 */
export interface IOcr {
  extractText(imagePath: string): Promise<string>;
  extractTextFromClipboard(): Promise<string>;
  extractTextFromRegion(): Promise<string>;
  annotateScreenshot(imagePath: string, annotations: Annotation[]): Promise<string>;
}

/**
 * Windows OCR Implementation using Windows.Media.Ocr API
 */
export class WindowsOcr implements IOcr {
  /**
   * Extract text from an image file using Windows OCR
   */
  async extractText(imagePath: string): Promise<string> {
    // Resolve and validate path
    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${resolvedPath}`);
    }

    const script = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Load Windows Runtime assemblies
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime]

# Helper to await async operations
function Await($WinRtTask, $ResultType) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

# Get the image file
$imagePath = '${resolvedPath.replace(/\\/g, '\\\\')}'
$storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)) ([Windows.Storage.StorageFile])

# Open the file stream
$stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])

# Create bitmap decoder
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])

# Get software bitmap
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

# Create OCR engine (uses system language)
$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

if ($ocrEngine -eq $null) {
    # Fall back to English
    $language = [Windows.Globalization.Language]::new('en-US')
    $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
}

if ($ocrEngine -eq $null) {
    Write-Error "OCR engine not available"
    exit 1
}

# Perform OCR
$ocrResult = Await ($ocrEngine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

# Output the text
$ocrResult.Text
`;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
      );
      return stdout.trim();
    } catch (error: any) {
      console.error('OCR extraction failed:', error);
      throw new Error(`OCR failed: ${error.message || error}`);
    }
  }

  /**
   * Extract text from clipboard image
   */
  async extractTextFromClipboard(): Promise<string> {
    // First, save clipboard image to temp file
    const tempFile = path.join(os.tmpdir(), `ocr_clipboard_${Date.now()}.png`);

    const saveClipboardScript = `
Add-Type -AssemblyName System.Windows.Forms
$image = [System.Windows.Forms.Clipboard]::GetImage()
if ($image -eq $null) {
    Write-Error "No image in clipboard"
    exit 1
}
$image.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "OK"
`;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${saveClipboardScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { timeout: 10000 }
      );

      if (!stdout.includes('OK')) {
        throw new Error('No image found in clipboard');
      }

      // Now extract text from the saved image
      const text = await this.extractText(tempFile);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      return text;
    } catch (error: any) {
      throw new Error(`Failed to extract text from clipboard: ${error.message || error}`);
    }
  }

  /**
   * Capture a screen region and extract text
   */
  async extractTextFromRegion(): Promise<string> {
    // Use Windows Snipping Tool to capture region
    const tempFile = path.join(os.tmpdir(), `ocr_region_${Date.now()}.png`);

    const captureScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Use SnippingTool for region capture
Start-Process snippingtool -ArgumentList '/clip' -Wait

# Wait for clipboard to be populated
Start-Sleep -Milliseconds 500

# Get image from clipboard
$image = [System.Windows.Forms.Clipboard]::GetImage()
if ($image -eq $null) {
    Write-Error "No image captured"
    exit 1
}
$image.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "OK"
`;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${captureScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { timeout: 60000 } // Longer timeout for user interaction
      );

      if (!stdout.includes('OK')) {
        throw new Error('Region capture cancelled or failed');
      }

      // Extract text from captured region
      const text = await this.extractText(tempFile);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      return text;
    } catch (error: any) {
      throw new Error(`Failed to extract text from region: ${error.message || error}`);
    }
  }

  /**
   * Add annotations to a screenshot
   */
  async annotateScreenshot(imagePath: string, annotations: Annotation[]): Promise<string> {
    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${resolvedPath}`);
    }

    const outputPath = resolvedPath.replace(/(\.[^.]+)$/, '_annotated$1');

    // Build PowerShell drawing commands
    const drawCommands = annotations.map(a => {
      const color = a.color || 'Red';
      const thickness = a.thickness || 2;

      switch (a.type) {
        case 'rectangle':
          return `
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::${color}, ${thickness})
$graphics.DrawRectangle($pen, ${a.x}, ${a.y}, ${a.width || 100}, ${a.height || 50})
$pen.Dispose()`;

        case 'highlight':
          return `
$brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(80, [System.Drawing.Color]::${color}))
$graphics.FillRectangle($brush, ${a.x}, ${a.y}, ${a.width || 100}, ${a.height || 20})
$brush.Dispose()`;

        case 'arrow':
          return `
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::${color}, ${thickness})
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$graphics.DrawLine($pen, ${a.x}, ${a.y}, ${a.endX || a.x + 50}, ${a.endY || a.y + 50})
$pen.Dispose()`;

        case 'text':
          return `
$font = [System.Drawing.Font]::new('Arial', 14)
$brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::${color})
$graphics.DrawString('${(a.text || '').replace(/'/g, "''")}', $font, $brush, ${a.x}, ${a.y})
$font.Dispose()
$brush.Dispose()`;

        default:
          return '';
      }
    }).join('\n');

    const script = `
Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile('${resolvedPath.replace(/\\/g, '\\\\')}')
$graphics = [System.Drawing.Graphics]::FromImage($image)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

${drawCommands}

$graphics.Dispose()
$image.Save('${outputPath.replace(/\\/g, '\\\\')}')
$image.Dispose()

Write-Output '${outputPath.replace(/\\/g, '\\\\')}'
`;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
        { timeout: 30000 }
      );
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Failed to annotate screenshot: ${error.message || error}`);
    }
  }
}

export const windowsOcr = new WindowsOcr();
