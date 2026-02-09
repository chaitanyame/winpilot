// Windows Window Manager Implementation

import { screen } from 'electron';
import { IWindowManager } from '../index';
import { WindowInfo } from '../../shared/types';
import { WINDOW_LAYOUTS } from '../../shared/constants';
import { runPowerShell } from './powershell-pool';

/**
 * Escapes a string for safe use in PowerShell single-quoted strings.
 * In single-quoted strings, only the single quote character needs escaping (doubled).
 */
function escapePowerShellString(input: string): string {
  if (input === null || input === undefined) return '';
  // In PowerShell single-quoted strings, only ' needs to be escaped as ''
  return String(input).replace(/'/g, "''");
}

/**
 * Validates that a windowId is a valid numeric handle.
 * Window handles should only contain digits.
 */
function isValidWindowId(windowId: string): boolean {
  return /^\d+$/.test(windowId);
}

// Track the last focused window that wasn't our own app
let lastFocusedExternalWindowId: string | null = null;

// TTL cache for window list to avoid expensive re-enumeration in agentic loops
const WINDOW_LIST_CACHE_TTL_MS = 3000; // 3 seconds
let windowListCache: WindowInfo[] | null = null;
let windowListCacheTime = 0;

export class WindowsWindowManager implements IWindowManager {

  async listWindows(): Promise<WindowInfo[]> {
    // Return cached result if still valid
    const now = Date.now();
    if (windowListCache && (now - windowListCacheTime) < WINDOW_LIST_CACHE_TTL_MS) {
      return windowListCache;
    }
    try {
      // PowerShell script to get all visible windows using Win32 API
      // Optimized: removed Process.GetProcessById (can hang) and GetWindowDisplayAffinity (slow)
      const script = `
if (-not ("WindowInfo" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class WindowInfo {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    
public static List<object> GetWindows() {
        var windows = new List<object>();
        IntPtr foreground = GetForegroundWindow();
        
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            
            int length = GetWindowTextLength(hWnd);
            if (length == 0) return true;
            
            StringBuilder sb = new StringBuilder(length + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (string.IsNullOrWhiteSpace(title)) return true;
            
            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            
            RECT rect;
            GetWindowRect(hWnd, out rect);
            
            bool isMinimized = IsIconic(hWnd);
            if (!isMinimized && (rect.Right - rect.Left < 50 || rect.Bottom - rect.Top < 50)) return true;
            
            windows.Add(new {
                id = hWnd.ToString(),
                title = title,
                processId = processId,
                x = rect.Left,
                y = rect.Top,
                width = isMinimized ? 0 : rect.Right - rect.Left,
                height = isMinimized ? 0 : rect.Bottom - rect.Top,
                isMinimized = isMinimized,
                isMaximized = IsZoomed(hWnd),
                isFocused = hWnd == foreground
            });
            return true;
        }, IntPtr.Zero);
        
        return windows;
    }
}
"@
}
[WindowInfo]::GetWindows() | ConvertTo-Json -Compress
`;

      const { stdout } = await runPowerShell(script, { timeout: 15000 });

      const parsed = JSON.parse(stdout || '[]');
      const windowsArray = Array.isArray(parsed) ? parsed : [parsed];

      // Filter out our own app's windows (WinPilot / electron)
      const filteredWindows = windowsArray.filter((w: any) => {
        const title = (w.title || '').toLowerCase();
        // Filter out our own window
        if (title.includes('winpilot') || title.includes('desktop commander')) return false;
        return true;
      });

      // Find the currently focused external window
      const focusedExternal = filteredWindows.find((w: any) => w.isFocused);
      if (focusedExternal) {
        lastFocusedExternalWindowId = focusedExternal.id;
      }

      // Map results and mark the "active" window (last focused external, not Desktop Commander)
      // Get app names from running processes (fast lookup)
      const processes = new Map<number, string>();
      const result = filteredWindows.map((w: any) => {
        // Try to find app name from cached processes or use processId as fallback
        const appName = processes.get(w.processId) || `pid:${w.processId}`;

        return {
          id: w.id,
          title: w.title,
          app: appName,
          processId: w.processId,
          bounds: {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          },
          isMinimized: w.isMinimized,
          isMaximized: w.isMaximized,
          // Mark as focused if it's the last known focused external window
          isFocused: w.id === lastFocusedExternalWindowId,
          isHiddenFromCapture: false, // Disabled to improve speed
        };
      });

      // Cache the result
      windowListCache = result;
      windowListCacheTime = Date.now();

      return result;
    } catch (error) {
      console.error('Error listing windows:', error);
      return [];
    }
  }

  /** Invalidate the window list cache after a mutation */
  private invalidateCache(): void {
    windowListCache = null;
    windowListCacheTime = 0;
  }

  async focusWindow(params: { windowId?: string; appName?: string; titleContains?: string }): Promise<boolean> {
    try {
      let targetHandle: string | null = null;

      if (params.windowId) {
        // Validate windowId is a valid numeric handle to prevent injection
        if (!isValidWindowId(params.windowId)) {
          console.error('Invalid window ID format');
          return false;
        }
        targetHandle = params.windowId;
      } else {
        const windows = await this.listWindows();
        const target = windows.find(w => {
          if (params.appName && w.app.toLowerCase().includes(params.appName.toLowerCase())) return true;
          if (params.titleContains && w.title.toLowerCase().includes(params.titleContains.toLowerCase())) return true;
          return false;
        });
        if (target) targetHandle = target.id;
      }

      if (!targetHandle) return false;

      const script = `
        if (-not ("Win32" -as [type])) {
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
        }
"@
        }
        $handle = [IntPtr]::new(${targetHandle})
        if ([Win32]::IsIconic($handle)) {
            [Win32]::ShowWindow($handle, 9)
        }
        [Win32]::SetForegroundWindow($handle)
      `;

      await runPowerShell(script);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Error focusing window:', error);
      return false;
    }
  }

  async moveWindow(params: { windowId: string; x?: number; y?: number; width?: number; height?: number }): Promise<boolean> {
    try {
      // Validate windowId is a valid numeric handle to prevent injection
      if (!isValidWindowId(params.windowId)) {
        console.error('Invalid window ID format');
        return false;
      }

      // Build the script with proper values
      const xVal = params.x !== undefined ? params.x : '$rect.Left';
      const yVal = params.y !== undefined ? params.y : '$rect.Top';
      const widthVal = params.width !== undefined ? params.width : '($rect.Right - $rect.Left)';
      const heightVal = params.height !== undefined ? params.height : '($rect.Bottom - $rect.Top)';
      
      const script = `
if (-not ("Win32Move" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Move {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
}
$handle = [IntPtr]::new(${params.windowId})
if ([Win32Move]::IsIconic($handle)) {
    [Win32Move]::ShowWindow($handle, 9) | Out-Null
    Start-Sleep -Milliseconds 50
}
if ([Win32Move]::IsZoomed($handle)) {
    [Win32Move]::ShowWindow($handle, 9) | Out-Null
    Start-Sleep -Milliseconds 50
}
$rect = New-Object Win32Move+RECT
[Win32Move]::GetWindowRect($handle, [ref]$rect) | Out-Null
$x = ${xVal}
$y = ${yVal}
$width = ${widthVal}
$height = ${heightVal}
[Win32Move]::MoveWindow($handle, $x, $y, $width, $height, $true)
`;

      await runPowerShell(script);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Error moving window:', error);
      return false;
    }
  }

  async closeWindow(params: { windowId?: string; appName?: string }): Promise<boolean> {
    try {
      if (params.windowId) {
        // Validate windowId is a valid numeric handle to prevent injection
        if (!isValidWindowId(params.windowId)) {
          console.error('Invalid window ID format');
          return false;
        }
        const script = `
if (-not ("Win32Close" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Close {
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@
}
[Win32Close]::PostMessage([IntPtr]::new(${params.windowId}), 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
`;
        await runPowerShell(script);
        this.invalidateCache();
      } else if (params.appName) {
        // Sanitize appName to prevent command injection
        const safeAppName = escapePowerShellString(params.appName);
        await runPowerShell(`Stop-Process -Name '${safeAppName}' -ErrorAction SilentlyContinue`);
        this.invalidateCache();
      }
      return true;
    } catch (error) {
      console.error('Error closing window:', error);
      return false;
    }
  }

  async minimizeWindow(windowId: string): Promise<boolean> {
    try {
      // Validate windowId is a valid numeric handle to prevent injection
      if (!isValidWindowId(windowId)) {
        console.error('Invalid window ID format');
        return false;
      }

      const script = `
if (-not ("Win32Minimize" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Minimize {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
}
[Win32Minimize]::ShowWindow([IntPtr]::new(${windowId}), 6)
`;
      await runPowerShell(script);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Error minimizing window:', error);
      return false;
    }
  }

  async maximizeWindow(windowId: string): Promise<boolean> {
    try {
      // Validate windowId is a valid numeric handle to prevent injection
      if (!isValidWindowId(windowId)) {
        console.error('Invalid window ID format');
        return false;
      }

      const script = `
if (-not ("Win32Maximize" -as [type])) {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Maximize {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
}
[Win32Maximize]::ShowWindow([IntPtr]::new(${windowId}), 3)
`;
      await runPowerShell(script);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Error maximizing window:', error);
      return false;
    }
  }

  async arrangeWindows(params: { layout: string; windows?: string[] }): Promise<boolean> {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      const { x: screenX, y: screenY } = primaryDisplay.workArea;

      const windows = await this.listWindows();
      const layout = params.layout.toLowerCase().replace(/\s+/g, '-');
      
      // For grid layout, use ALL windows (moveWindow will restore them)
      // For other layouts, only use non-minimized windows
      let targetWindows;
      if (params.windows) {
        targetWindows = windows.filter(w => params.windows!.includes(w.id));
      } else if (layout === 'grid' || layout === 'grid-all') {
        // Grid layout includes ALL windows - they will be restored automatically
        targetWindows = windows;
      } else {
        targetWindows = windows.filter(w => !w.isMinimized);
      }

      if (targetWindows.length === 0) return false;

      if (layout === 'side-by-side' && targetWindows.length >= 2) {
        const halfWidth = Math.floor(screenWidth / 2);
        await this.moveWindow({ windowId: targetWindows[0].id, x: screenX, y: screenY, width: halfWidth, height: screenHeight });
        await this.moveWindow({ windowId: targetWindows[1].id, x: screenX + halfWidth, y: screenY, width: halfWidth, height: screenHeight });
      } else if (layout === 'stacked' && targetWindows.length >= 2) {
        const halfHeight = Math.floor(screenHeight / 2);
        await this.moveWindow({ windowId: targetWindows[0].id, x: screenX, y: screenY, width: screenWidth, height: halfHeight });
        await this.moveWindow({ windowId: targetWindows[1].id, x: screenX, y: screenY + halfHeight, width: screenWidth, height: halfHeight });
      } else if (layout === 'grid') {
        const cols = Math.ceil(Math.sqrt(targetWindows.length));
        const rows = Math.ceil(targetWindows.length / cols);
        const cellWidth = Math.floor(screenWidth / cols);
        const cellHeight = Math.floor(screenHeight / rows);

        for (let i = 0; i < targetWindows.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          await this.moveWindow({
            windowId: targetWindows[i].id,
            x: screenX + col * cellWidth,
            y: screenY + row * cellHeight,
            width: cellWidth,
            height: cellHeight,
          });
        }
      } else if (WINDOW_LAYOUTS[layout as keyof typeof WINDOW_LAYOUTS] && targetWindows.length >= 1) {
        const layoutConfig = WINDOW_LAYOUTS[layout as keyof typeof WINDOW_LAYOUTS];
        await this.moveWindow({
          windowId: targetWindows[0].id,
          x: screenX + Math.floor(screenWidth * layoutConfig.x),
          y: screenY + Math.floor(screenHeight * layoutConfig.y),
          width: Math.floor(screenWidth * layoutConfig.widthFraction),
          height: Math.floor(screenHeight * layoutConfig.heightFraction),
        });
      }

      return true;
    } catch (error) {
      console.error('Error arranging windows:', error);
      return false;
    }
  }
}
