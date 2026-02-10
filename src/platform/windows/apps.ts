// Windows Apps Implementation

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { IApps } from '../index';
import { AppInfo } from '../../shared/types';
import { logger } from '../../utils/logger';
import { runPowerShell } from './powershell-pool';

const execAsync = promisify(exec);

/**
 * Escapes a string for safe use in PowerShell single-quoted strings.
 * In single-quoted strings, only the single quote character needs escaping (doubled).
 */
function escapePowerShellString(input: string): string {
  if (input === null || input === undefined) return '';
  // In PowerShell single-quoted strings, only ' needs to be escaped as ''
  return String(input).replace(/'/g, "''");
}

export class WindowsApps implements IApps {

  async listApps(filter?: 'running' | 'installed' | 'all'): Promise<AppInfo[]> {
    try {
      const needRunning = filter === 'running' || filter === 'all' || !filter;
      const needInstalled = filter === 'installed' || filter === 'all';

      if (needRunning && needInstalled) {
        // Fetch both in parallel
        const [runningApps, installedApps] = await Promise.all([
          this.getRunningApps(),
          this.getInstalledApps(),
        ]);
        const apps: AppInfo[] = [...runningApps];
        // Use Set for O(1) duplicate lookup instead of O(n) find()
        const seen = new Set(runningApps.map(a => a.name));
        for (const app of installedApps) {
          if (!seen.has(app.name)) {
            seen.add(app.name);
            apps.push(app);
          }
        }
        return apps;
      }

      if (needRunning) {
        return await this.getRunningApps();
      }
      if (needInstalled) {
        return await this.getInstalledApps();
      }

      return [];
    } catch (error) {
      console.error('Error listing apps:', error);
      return [];
    }
  }

  private async getRunningApps(): Promise<AppInfo[]> {
    try {
      // Get processes with visible windows (MainWindowHandle != 0) - more reliable than MainWindowTitle
      // Note: Use semicolons in hashtable since newlines get replaced with spaces for command line
      const script = `
        Get-Process | 
        Where-Object { $_.MainWindowHandle -ne 0 } | 
        Select-Object -Property ProcessName, Id, Path, MainWindowTitle -Unique |
        ForEach-Object {
          @{
            name = $_.ProcessName;
            path = $_.Path;
            isRunning = $true;
            processId = $_.Id;
            title = $_.MainWindowTitle
          }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await runPowerShell(script);
      
      if (!stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const processes = Array.isArray(parsed) ? parsed : [parsed];

      return processes.map((p: any) => ({
        name: p.name,
        path: p.path || '',
        isRunning: true,
        processId: p.processId,
      }));
    } catch (error) {
      console.error('Error getting running apps:', error);
      return [];
    }
  }

  private async getInstalledApps(): Promise<AppInfo[]> {
    try {
      // Get installed apps - only require DisplayName (InstallLocation is often missing)
      // Note: Use semicolons in hashtable since newlines get replaced with spaces for command line
      const script = `
        $apps = @();
        $registryPaths = @(
          "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
          "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
          "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
        );
        foreach ($path in $registryPaths) {
          Get-ItemProperty $path -ErrorAction SilentlyContinue |
          Where-Object { $_.DisplayName } |
          ForEach-Object {
            $apps += @{
              name = $_.DisplayName;
              path = if ($_.InstallLocation) { $_.InstallLocation } elseif ($_.DisplayIcon) { $_.DisplayIcon } else { '' };
              isRunning = $false
            }
          }
        };
        $apps | Sort-Object { $_.name } -Unique | Select-Object -First 200 | ConvertTo-Json -Compress
      `;

      const { stdout } = await runPowerShell(script);

      if (!stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const apps = Array.isArray(parsed) ? parsed : [parsed];

      return apps.map((a: any) => ({
        name: a.name,
        path: a.path || '',
        isRunning: false,
      }));
    } catch (error) {
      console.error('Error getting installed apps:', error);
      return [];
    }
  }

  async launchApp(params: { name?: string; path?: string; args?: string[] }): Promise<boolean> {
    logger.platform('WindowsApps.launchApp called', params);
    try {
      if (params.path) {
        // Launch by path
        logger.platform('Launching by path', { path: params.path });
        const args = params.args || [];
        spawn(params.path, args, { detached: true, stdio: 'ignore' }).unref();
        logger.platform('Spawn completed for path');
        return true;
      }

      if (params.name) {
        // Try to find and launch by name
        // First check common locations
        const commonApps: Record<string, string> = {
          'chrome': 'chrome',
          'firefox': 'firefox',
          'edge': 'msedge',
          'notepad': 'notepad',
          'calculator': 'calc',
          'explorer': 'explorer',
          'cmd': 'cmd',
          'powershell': 'powershell',
          'terminal': 'wt',
          'code': 'code',
          'vscode': 'code',
          'spotify': 'spotify',
          'slack': 'slack',
          'discord': 'discord',
          'teams': 'teams',
          'powerpoint': 'powerpnt',
          'excel': 'excel',
          'word': 'winword',
          'outlook': 'outlook',
        };

        const appName = params.name.toLowerCase();
        const command = commonApps[appName] || params.name;
        const args = params.args || [];
        // Escape each arg: wrap in quotes and escape any internal quotes
        const escapedArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
        const fullCommand = escapedArgs ? `start "" "${command}" ${escapedArgs}` : `start "" "${command}"`;
        logger.platform('Launching by name', { name: params.name, resolvedCommand: command, args, fullCommand });

        const cmdResult = await execAsync(fullCommand, { shell: 'cmd.exe' });
        logger.platform('Start command result', { stdout: cmdResult.stdout, stderr: cmdResult.stderr });
        return true;
      }

      logger.platform('No name or path provided');
      return false;
    } catch (error) {
      logger.error('Platform', 'Error launching app', error);
      return false;
    }
  }

  async quitApp(params: { name: string; force?: boolean }): Promise<boolean> {
    try {
      const safeName = escapePowerShellString(params.name);
      const forceFlag = params.force ? '-Force' : '';
      const script = `Stop-Process -Name '${safeName}' ${forceFlag} -ErrorAction SilentlyContinue`;
      await runPowerShell(script);
      return true;
    } catch (error) {
      console.error('Error quitting app:', error);
      return false;
    }
  }

  async switchToApp(name: string): Promise<boolean> {
    try {
      const safeName = escapePowerShellString(name);
      const script = `
        if (-not ("Win32AppSwitch" -as [type])) {
        Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32AppSwitch {
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")]
            public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")]
            public static extern bool IsIconic(IntPtr hWnd);
        }
"@
        }
        $proc = Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($proc -and $proc.MainWindowHandle -ne 0) {
            $handle = $proc.MainWindowHandle
            if ([Win32AppSwitch]::IsIconic($handle)) {
                [Win32AppSwitch]::ShowWindow($handle, 9)
            }
            [Win32AppSwitch]::SetForegroundWindow($handle)
            Write-Output "true"
        } else {
            Write-Output "false"
        }
      `;

      const { stdout } = await runPowerShell(script);
      return stdout.trim() === 'true';
    } catch (error) {
      console.error('Error switching to app:', error);
      return false;
    }
  }

  async createPowerPoint(params: {
    savePath: string;
    slides: Array<{
      layout: 'title' | 'content' | 'blank' | 'titleOnly';
      title?: string;
      subtitle?: string;
      content?: string;
    }>;
  }): Promise<boolean> {
    logger.platform('WindowsApps.createPowerPoint called', params);
    try {
      // Expand ~ to user's home directory and normalize path
      let normalizedPath = params.savePath;
      if (normalizedPath.startsWith('~')) {
        const homeDir = process.env.USERPROFILE || process.env.HOME || '';
        normalizedPath = normalizedPath.replace(/^~/, homeDir);
      }
      // Also handle forward slashes
      normalizedPath = normalizedPath.replace(/\//g, '\\');
      
      // Escape path for PowerShell
      const escapedPath = normalizedPath.replace(/'/g, "''");
      
      // Build slide creation commands
      const slideCommands = params.slides.map((slide, index) => {
        // PowerPoint layout enums:
        // 1 = ppLayoutTitle, 2 = ppLayoutText (title + content), 7 = ppLayoutBlank, 11 = ppLayoutTitleOnly
        let layoutNum: number;
        switch (slide.layout) {
          case 'title': layoutNum = 1; break;
          case 'content': layoutNum = 2; break;
          case 'blank': layoutNum = 7; break;
          case 'titleOnly': layoutNum = 11; break;
          default: layoutNum = 2;
        }

        const slideVar = `$slide${index}`;
        let commands = `${slideVar} = $pres.Slides.Add(${index + 1}, ${layoutNum})`;

        // Add title if provided
        if (slide.title) {
          const escapedTitle = slide.title.replace(/'/g, "''").replace(/`/g, '``');
          commands += `\n${slideVar}.Shapes.Title.TextFrame.TextRange.Text = '${escapedTitle}'`;
        }

        // Add subtitle for title slides (shape index 2)
        if (slide.layout === 'title' && slide.subtitle) {
          const escapedSubtitle = slide.subtitle.replace(/'/g, "''").replace(/`/g, '``');
          commands += `\nif (${slideVar}.Shapes.Count -ge 2) { ${slideVar}.Shapes.Item(2).TextFrame.TextRange.Text = '${escapedSubtitle}' }`;
        }

        // Add content for content slides (shape index 2 is the content placeholder)
        if (slide.layout === 'content' && slide.content) {
          const escapedContent = slide.content.replace(/'/g, "''").replace(/`/g, '``');
          commands += `\nif (${slideVar}.Shapes.Count -ge 2) { ${slideVar}.Shapes.Item(2).TextFrame.TextRange.Text = '${escapedContent}' }`;
        }

        return commands;
      }).join('\n');

      const script = `
$ErrorActionPreference = 'Stop'
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
  $pres = $ppt.Presentations.Add()
  
  ${slideCommands}
  
  # Save as .pptx (format 24 = ppSaveAsOpenXMLPresentation)
  $pres.SaveAs('${escapedPath}', 24)
  
  # Release COM objects but leave PowerPoint open
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null
  
  Write-Output 'SUCCESS'
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`;

      const { stdout, stderr } = await runPowerShell(script);

      logger.platform('createPowerPoint result', { stdout: stdout.trim(), stderr: stderr?.trim() });
      return stdout.trim() === 'SUCCESS';
    } catch (error) {
      logger.error('Platform', 'Error creating PowerPoint', error);
      return false;
    }
  }
}
