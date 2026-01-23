// Windows File System Implementation

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { shell } from 'electron';
import { IFileSystem } from '../index';
import { FileInfo, FileFilter } from '../../shared/types';
import { getFileExtension } from '../../shared/utils';

const execAsync = promisify(exec);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);

export class WindowsFileSystem implements IFileSystem {

  async listFiles(params: { path: string; recursive?: boolean; filter?: FileFilter }): Promise<FileInfo[]> {
    try {
      const results: FileInfo[] = [];
      await this.walkDirectory(params.path, params.recursive ?? false, params.filter, results);
      return results;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  private async walkDirectory(
    dirPath: string,
    recursive: boolean,
    filter: FileFilter | undefined,
    results: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await stat(fullPath);
          const fileInfo = this.createFileInfo(entry.name, fullPath, stats, entry.isDirectory());

          if (this.matchesFilter(fileInfo, filter)) {
            results.push(fileInfo);
          }

          if (recursive && entry.isDirectory()) {
            await this.walkDirectory(fullPath, recursive, filter, results);
          }
        } catch {
          // Skip files we can't access
          continue;
        }
      }
    } catch (error) {
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
      const startPath = params.startPath || process.env.USERPROFILE || 'C:\\';
      const maxResults = params.maxResults || 100;

      // Use Windows Search via PowerShell for better performance
      const script = `
        Get-ChildItem -Path "${startPath}" -Recurse -Filter "*${params.query}*" -ErrorAction SilentlyContinue |
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

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

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
    try {
      const sources = Array.isArray(params.source) ? params.source : [params.source];
      
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
    try {
      const sources = Array.isArray(params.source) ? params.source : [params.source];

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
    try {
      const moveToTrash = params.moveToTrash !== false; // Default to true for safety

      for (const filePath of params.paths) {
        if (moveToTrash) {
          // Use shell to move to recycle bin
          await shell.trashItem(filePath);
        } else {
          // Permanent delete using PowerShell
          await execAsync(`powershell -NoProfile -Command "Remove-Item -Path '${filePath}' -Recurse -Force"`);
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
      const dir = path.dirname(params.path);
      const newPath = path.join(dir, params.newName);
      await rename(params.path, newPath);
      return true;
    } catch (error) {
      console.error('Error renaming file:', error);
      return false;
    }
  }

  async createFolder(folderPath: string): Promise<boolean> {
    try {
      await mkdir(folderPath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Error creating folder:', error);
      return false;
    }
  }

  async readFile(params: { path: string; encoding?: string; maxSize?: number }): Promise<string> {
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
      const stats = await stat(filePath);
      return this.createFileInfo(path.basename(filePath), filePath, stats, stats.isDirectory());
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  async writeFile(params: { path: string; content: string; encoding?: BufferEncoding; append?: boolean }): Promise<boolean> {
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
