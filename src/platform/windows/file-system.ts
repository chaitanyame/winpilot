// Windows File System Implementation

import { runPowerShell } from './powershell-pool';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { shell } from 'electron';
import { IFileSystem } from '../index';
import { FileInfo, FileFilter } from '../../shared/types';
import { getFileExtension } from '../../shared/utils';
import { assertPathAllowed, assertPathsAllowed } from '../path-validator';
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);

/**
 * Escapes a string for safe use in PowerShell single-quoted strings.
 * In single-quoted strings, only the single quote character needs escaping (doubled).
 */
function escapePowerShellString(input: string): string {
  if (input === null || input === undefined) return '';
  // In PowerShell single-quoted strings, only ' needs to be escaped as ''
  return String(input).replace(/'/g, "''");
}

export class WindowsFileSystem implements IFileSystem {

  async listFiles(params: { path: string; recursive?: boolean; filter?: FileFilter }): Promise<FileInfo[]> {
    // Validate root path is allowed before listing
    assertPathAllowed(params.path, 'list');
    try {
      const results: FileInfo[] = [];
      await this.walkDirectory(params.path, params.recursive ?? false, params.filter, results);
      return results;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  private static readonly STAT_BATCH_SIZE = 50;

  private async walkDirectory(
    dirPath: string,
    recursive: boolean,
    filter: FileFilter | undefined,
    results: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      // Process entries in parallel batches for stat() calls
      const batchSize = WindowsFileSystem.STAT_BATCH_SIZE;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const statResults = await Promise.allSettled(
          batch.map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            const stats = await stat(fullPath);
            return { entry, fullPath, stats };
          })
        );

        const subdirs: { fullPath: string }[] = [];
        for (const result of statResults) {
          if (result.status === 'rejected') continue; // Skip inaccessible files
          const { entry, fullPath, stats } = result.value;
          const fileInfo = this.createFileInfo(entry.name, fullPath, stats, entry.isDirectory());

          if (this.matchesFilter(fileInfo, filter)) {
            results.push(fileInfo);
          }

          if (recursive && entry.isDirectory()) {
            subdirs.push({ fullPath });
          }
        }

        // Recurse into subdirectories
        for (const { fullPath } of subdirs) {
          await this.walkDirectory(fullPath, recursive, filter, results);
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }

  private createFileInfo(name: string, fullPath: string, stats: fs.Stats, isDirectory: boolean): FileInfo {
    return {
      name,
      path: fullPath,
      isDirectory,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: isDirectory ? undefined : getFileExtension(name),
    };
  }

  private matchesFilter(file: FileInfo, filter?: FileFilter): boolean {
    if (!filter) return true;

    if (filter.extension && filter.extension.length > 0) {
      if (!file.extension || !filter.extension.includes(file.extension.toLowerCase())) {
        return false;
      }
    }

    if (filter.nameContains) {
      if (!file.name.toLowerCase().includes(filter.nameContains.toLowerCase())) {
        return false;
      }
    }

    if (filter.modifiedAfter) {
      const afterDate = new Date(filter.modifiedAfter);
      if (file.modified < afterDate) return false;
    }

    if (filter.modifiedBefore) {
      const beforeDate = new Date(filter.modifiedBefore);
      if (file.modified > beforeDate) return false;
    }

    if (filter.sizeGreaterThan !== undefined && file.size <= filter.sizeGreaterThan) {
      return false;
    }

    if (filter.sizeLessThan !== undefined && file.size >= filter.sizeLessThan) {
      return false;
    }

    return true;
  }

  async searchFiles(params: { query: string; startPath?: string; maxResults?: number }): Promise<FileInfo[]> {
    try {
      const startPath = params.startPath || process.env.USERPROFILE || os.homedir();
      const maxResults = params.maxResults || 100;

      // Validate start path is allowed
      assertPathAllowed(startPath, 'search');

      // Sanitize user input to prevent command injection
      const safeStartPath = escapePowerShellString(startPath);
      const safeQuery = escapePowerShellString(params.query);

      // Use Windows Search via PowerShell for better performance
      const script = `
        Get-ChildItem -Path '${safeStartPath}' -Recurse -Filter '*${safeQuery}*' -ErrorAction SilentlyContinue |
        Select-Object -First ${maxResults} |
        ForEach-Object {
          @{
            name = $_.Name
            path = $_.FullName
            isDirectory = $_.PSIsContainer
            size = if($_.PSIsContainer) { 0 } else { $_.Length }
            created = $_.CreationTime.ToString("o")
            modified = $_.LastWriteTime.ToString("o")
          }
        } | ConvertTo-Json -Compress
      `;

      const { stdout } = await runPowerShell(script);

      if (!stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const files = Array.isArray(parsed) ? parsed : [parsed];

      return files.map((f: any) => ({
        name: f.name,
        path: f.path,
        isDirectory: f.isDirectory,
        size: f.size,
        created: new Date(f.created),
        modified: new Date(f.modified),
        extension: f.isDirectory ? undefined : getFileExtension(f.name),
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      return [];
    }
  }

  async moveFiles(params: { source: string | string[]; destination: string; overwrite?: boolean }): Promise<boolean> {
    // Validate all source and destination paths are allowed
    const sources = Array.isArray(params.source) ? params.source : [params.source];
    assertPathsAllowed(sources, 'move (source)');
    assertPathAllowed(params.destination, 'move (destination)');
    
    try {
      // Ensure destination exists if it's a directory
      if (!fs.existsSync(params.destination)) {
        await mkdir(params.destination, { recursive: true });
      }

      for (const source of sources) {
        const destPath = path.join(params.destination, path.basename(source));
        
        if (fs.existsSync(destPath) && !params.overwrite) {
          console.warn(`File exists and overwrite is false: ${destPath}`);
          continue;
        }

        await rename(source, destPath);
      }

      return true;
    } catch (error) {
      console.error('Error moving files:', error);
      return false;
    }
  }

  async copyFiles(params: { source: string | string[]; destination: string; overwrite?: boolean }): Promise<boolean> {
    // Validate all source and destination paths are allowed
    const sources = Array.isArray(params.source) ? params.source : [params.source];
    assertPathsAllowed(sources, 'copy (source)');
    assertPathAllowed(params.destination, 'copy (destination)');
    
    try {
      if (!fs.existsSync(params.destination)) {
        await mkdir(params.destination, { recursive: true });
      }

      for (const source of sources) {
        const destPath = path.join(params.destination, path.basename(source));
        
        if (fs.existsSync(destPath) && !params.overwrite) {
          continue;
        }

        const stats = await stat(source);
        if (stats.isDirectory()) {
          await this.copyDirectory(source, destPath);
        } else {
          await copyFile(source, destPath);
        }
      }

      return true;
    } catch (error) {
      console.error('Error copying files:', error);
      return false;
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  async deleteFiles(params: { paths: string[]; moveToTrash?: boolean }): Promise<boolean> {
    // Validate all paths are allowed before deleting
    assertPathsAllowed(params.paths, 'delete');
    
    try {
      const moveToTrash = params.moveToTrash !== false; // Default to true for safety

      for (const filePath of params.paths) {
        if (moveToTrash) {
          // Use shell to move to recycle bin
          await shell.trashItem(filePath);
        } else {
          // Permanent delete using Node.js native fs (safer than PowerShell)
          await fsPromises.rm(filePath, { recursive: true, force: true });
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting files:', error);
      return false;
    }
  }

  async renameFile(params: { path: string; newName: string }): Promise<boolean> {
    try {
      assertPathAllowed(params.path, 'rename');
      const dir = path.dirname(params.path);
      const newPath = path.join(dir, params.newName);
      assertPathAllowed(newPath, 'rename');
      await rename(params.path, newPath);
      return true;
    } catch (error) {
      console.error('Error renaming file:', error);
      return false;
    }
  }

  async createFolder(folderPath: string): Promise<boolean> {
    try {
      assertPathAllowed(folderPath, 'create folder');
      await mkdir(folderPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Error creating folder:', error);
      return false;
    }
  }

  async readFile(params: { path: string; encoding?: string; maxSize?: number }): Promise<string> {
    // Validate path is allowed before reading
    assertPathAllowed(params.path, 'read');
    
    try {
      const stats = await stat(params.path);
      const maxSize = params.maxSize || 1024 * 1024; // 1MB default

      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }

      const content = await readFile(params.path, { encoding: (params.encoding as BufferEncoding) || 'utf-8' });
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      assertPathAllowed(filePath, 'info');
      const stats = await stat(filePath);
      return this.createFileInfo(path.basename(filePath), filePath, stats, stats.isDirectory());
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  async writeFile(params: { path: string; content: string; encoding?: BufferEncoding; append?: boolean }): Promise<boolean> {
    // Validate path is allowed before writing
    assertPathAllowed(params.path, 'write');
    
    try {
      const encoding = params.encoding || 'utf-8';
      const append = params.append ?? false;

      // Create parent directories if they don't exist
      const dir = path.dirname(params.path);
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      if (append) {
        await appendFileAsync(params.path, params.content, { encoding });
      } else {
        await writeFileAsync(params.path, params.content, { encoding });
      }

      return true;
    } catch (error) {
      console.error('Error writing file:', error);
      return false;
    }
  }
}
