// Clipboard Monitor - Automatic clipboard history tracking

import { EventEmitter } from 'events';
import { clipboard } from 'electron';
import path from 'path';
import fsSync from 'fs';
import { getStore } from './store';
import { clipboardImageStorage } from './clipboard-image-storage';
import { CLIPBOARD_LIMITS } from '../shared/constants';
import type {
  ClipboardEntry,
  TextClipboardEntry,
  ImageClipboardEntry,
  FilesClipboardEntry,
  ClipboardFileReference,
} from '../shared/types';

class ClipboardMonitor extends EventEmitter {
  private history: ClipboardEntry[] = [];
  private lastTextHash: string = '';
  private lastImageHash: string = '';
  private lastFilesHash: string = '';
  private monitorInterval: NodeJS.Timeout | null = null;
  private usePolling = true;
  private store = getStore();
  private isMonitoring = false;

  constructor() {
    super();
    this.loadHistory();
  }

  /**
   * Start clipboard monitoring (event-driven on Windows; polling fallback)
   */
  startMonitoring(usePollingFallback = true): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.usePolling = usePollingFallback;

    // Initialize hashes with current clipboard state
    this.initializeHashes();

    if (this.usePolling) {
      // Poll every 500ms for changes
      this.monitorInterval = setInterval(() => {
        this.checkClipboard();
      }, 500);
    }

    this.emit('monitoring-started');
    console.log('Clipboard monitoring started');
  }

  /**
   * Initialize hashes to prevent capturing current clipboard on startup
   */
  private initializeHashes(): void {
    try {
      const text = clipboard.readText() || '';
      if (text) {
        this.lastTextHash = this.hashString(text);
      }

      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const pngData = image.toPNG();
        this.lastImageHash = this.hashBuffer(pngData);
      }

      // Initialize files hash if on Windows
      if (process.platform === 'win32') {
        const files = this.readFilePaths();
        if (files.length > 0) {
          this.lastFilesHash = this.hashString(files.join('|'));
        }
      }
    } catch (error) {
      console.error('Error initializing clipboard hashes:', error);
    }
  }

  /**
   * Simple string hash for deduplication
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Simple buffer hash for deduplication
   */
  private hashBuffer(buffer: Buffer): string {
    let hash = 0;
    for (let i = 0; i < Math.min(buffer.length, 10000); i++) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Check for file formats in clipboard (actual file copy, not screenshots)
   */
  private hasFileFormat(formats: string[]): boolean {
    // Only consider it a file copy if CF_HDROP is present (actual file drag/copy)
    // and there's no image format (screenshots may have FileNameW but are primarily images)
    const hasFileDrop = formats.some(f => f.includes('CF_HDROP'));
    const hasImage = formats.some(f => f.startsWith('image/'));

    // If there's both file drop and image, prefer image (likely a screenshot saved to file)
    if (hasFileDrop && hasImage) {
      return false;
    }

    return hasFileDrop;
  }

  /**
   * Read file paths from clipboard (Windows-specific)
   */
  private readFilePaths(): string[] {
    if (process.platform !== 'win32') {
      return [];
    }

    try {
      // On Windows, file paths can be read via the buffer
      const buffer = clipboard.readBuffer('FileNameW');
      if (buffer && buffer.length > 0) {
        // FileNameW is a null-terminated UTF-16LE string of file paths
        // Multiple files are separated by null characters
        const str = buffer.toString('utf16le');
        const paths = str.split('\0').filter(p => p.length > 0 && fsSync.existsSync(p));
        return paths;
      }
    } catch (error) {
      // Ignore errors - not all clipboard content has file paths
    }

    return [];
  }

  /**
   * Check clipboard for changes
   */
   checkClipboard(): void {
    try {
      const formats = clipboard.availableFormats();

      // Check for image - Electron's readImage works even without explicit image/ format
      // Windows uses formats like "CF_DIB", "CF_BITMAP", "PNG", etc.
      const hasImageFormat = formats.some(f =>
        f.startsWith('image/') ||
        f === 'PNG' ||
        f === 'CF_DIB' ||
        f === 'CF_BITMAP' ||
        f === 'CF_DIBV5'
      );

      const hasFiles = this.hasFileFormat(formats);

      // Priority: files > image > text
      if (hasFiles) {
         this.handleFileClipboard();
       } else if (hasImageFormat) {
         this.handleImageClipboard().catch(err => {
           console.error('[Clipboard] Error handling image:', err);
         });
      } else {
        this.handleTextClipboard();
      }
    } catch (error) {
      console.error('Error checking clipboard:', error);
    }
  }

  /**
   * Handle text clipboard content
   */
  private handleTextClipboard(): void {
    const text = clipboard.readText() || '';

    if (text.length === 0) return;
    if (text.length > CLIPBOARD_LIMITS.MAX_TEXT_SIZE_BYTES) return;

    const hash = this.hashString(text);
    if (hash === this.lastTextHash) return;

    this.lastTextHash = hash;

    const entry: TextClipboardEntry = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      content: text,
      timestamp: Date.now(),
      pinned: false,
      size: new Blob([text]).size,
    };

    this.addEntry(entry);
    this.emit('clipboard-changed', entry);
  }

  /**
   * Handle image clipboard content
   */
  private async handleImageClipboard(): Promise<void> {
    try {
      const image = clipboard.readImage();
      if (image.isEmpty()) {
       return;
      }

      const pngData = image.toPNG();
      const hash = this.hashBuffer(pngData);

      if (hash === this.lastImageHash) {
        return;
      }
      this.lastImageHash = hash;

      // Save image to storage
      const imageInfo = await clipboardImageStorage.saveImage(image);
      if (!imageInfo) {
        return;
      }

      const entry: ImageClipboardEntry = {
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        timestamp: Date.now(),
        pinned: false,
        size: imageInfo.size,
        thumbnailPath: imageInfo.thumbnailPath,
        imagePath: imageInfo.imagePath,
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format,
      };

      this.addEntry(entry);
      this.emit('clipboard-changed', entry);
    } catch (error) {
      console.error('Error handling image clipboard:', error);
    }
  }

  /**
   * Handle file clipboard content
   */
  private handleFileClipboard(): void {
    const filePaths = this.readFilePaths();

    if (filePaths.length === 0) return;
    if (filePaths.length > CLIPBOARD_LIMITS.MAX_FILES_PER_ENTRY) {
      console.log('Too many files in clipboard:', filePaths.length);
      return;
    }

    const hash = this.hashString(filePaths.join('|'));
    if (hash === this.lastFilesHash) return;

    this.lastFilesHash = hash;

    const files: ClipboardFileReference[] = filePaths.map(filePath => {
      const isDirectory = fsSync.statSync(filePath).isDirectory();
      const ext = isDirectory ? '' : path.extname(filePath).toLowerCase();
      return {
        path: filePath,
        name: path.basename(filePath),
        extension: ext,
        isDirectory,
      };
    });

    // Calculate total size
    let totalSize = 0;
    for (const filePath of filePaths) {
      try {
        const stat = fsSync.statSync(filePath);
        totalSize += stat.size;
      } catch {
        // Skip if can't get size
      }
    }

    const entry: FilesClipboardEntry = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'files',
      timestamp: Date.now(),
      pinned: false,
      size: totalSize,
      files,
    };

    this.addEntry(entry);
    this.emit('clipboard-changed', entry);
  }

  /**
   * Add new clipboard entry to history
   */
  private addEntry(entry: ClipboardEntry): void {
    // Check for duplicates at top based on type
    const topEntry = this.history[0];
    if (topEntry) {
      if (entry.type === 'text' && topEntry.type === 'text' && entry.content === topEntry.content) {
        return;
      }
      if (entry.type === 'image' && topEntry.type === 'image' && entry.imagePath === topEntry.imagePath) {
        return;
      }
      if (entry.type === 'files' && topEntry.type === 'files') {
        const newPaths = entry.files.map(f => f.path).sort().join('|');
        const oldPaths = topEntry.files.map(f => f.path).sort().join('|');
        if (newPaths === oldPaths) return;
      }
    }

    // Add to beginning
    this.history.unshift(entry);

    // Keep only 50 unpinned entries
    const pinnedEntries = this.history.filter(e => e.pinned);
    const unpinnedEntries = this.history.filter(e => !e.pinned);

    if (unpinnedEntries.length > CLIPBOARD_LIMITS.MAX_UNPINNED_ENTRIES) {
      // Get entries to remove
      const toRemove = unpinnedEntries.slice(CLIPBOARD_LIMITS.MAX_UNPINNED_ENTRIES);

      // Clean up image files for removed image entries
      for (const removed of toRemove) {
        if (removed.type === 'image') {
          clipboardImageStorage.deleteImage(removed.imagePath).catch(console.error);
        }
      }

      unpinnedEntries.splice(CLIPBOARD_LIMITS.MAX_UNPINNED_ENTRIES);
    }

    this.history = [...pinnedEntries, ...unpinnedEntries];
    this.saveHistory();
  }

  /**
   * Get all clipboard history
   */
  getHistory(): ClipboardEntry[] {
    return this.history;
  }

  /**
   * Delete entry by ID
   */
  deleteEntry(id: string): boolean {
    const entry = this.history.find(e => e.id === id);
    if (!entry) return false;

    // Clean up image files if it's an image entry
    if (entry.type === 'image') {
      clipboardImageStorage.deleteImage(entry.imagePath).catch(console.error);
    }

    this.history = this.history.filter(e => e.id !== id);
    this.saveHistory();
    return true;
  }

  /**
   * Toggle pin status
   */
  togglePin(id: string): boolean {
    const entry = this.history.find(e => e.id === id);
    if (!entry) return false;

    entry.pinned = !entry.pinned;
    this.saveHistory();
    this.emit('entry-pinned', entry);
    return true;
  }

  /**
   * Clear all history (except pinned)
   */
  clearHistory(): void {
    // Clean up image files for non-pinned image entries
    for (const entry of this.history) {
      if (!entry.pinned && entry.type === 'image') {
        clipboardImageStorage.deleteImage(entry.imagePath).catch(console.error);
      }
    }

    this.history = this.history.filter(e => e.pinned);
    this.saveHistory();
    this.emit('history-cleared');
  }

  /**
   * Restore entry to clipboard
   */
  restoreToClipboard(id: string): boolean {
    const entry = this.history.find(e => e.id === id);
    if (!entry) return false;

    switch (entry.type) {
      case 'text':
        clipboard.writeText(entry.content);
        this.lastTextHash = this.hashString(entry.content);
        break;

      case 'image': {
        const image = clipboardImageStorage.getNativeImage(entry.imagePath);
        if (image && !image.isEmpty()) {
          clipboard.writeImage(image);
          this.lastImageHash = this.hashBuffer(image.toPNG());
        } else {
          return false;
        }
        break;
      }

      case 'files': {
        // On Windows, write file paths back to clipboard
        if (process.platform === 'win32' && entry.files.length > 0) {
          // For files, we write the paths as text since Electron doesn't have
          // a direct API to write file references back to clipboard
          // The user can then paste as file paths
          const paths = entry.files.map(f => f.path).join('\n');
          clipboard.writeText(paths);
          this.lastTextHash = this.hashString(paths);
        }
        break;
      }
    }

    return true;
  }

  /**
   * Search history by content
   */
  searchHistory(query: string): ClipboardEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(e => {
      switch (e.type) {
        case 'text':
          return e.content.toLowerCase().includes(lowerQuery);
        case 'image':
          return `image ${e.width}x${e.height}`.toLowerCase().includes(lowerQuery);
        case 'files':
          return e.files.some(f => f.name.toLowerCase().includes(lowerQuery));
        default:
          return false;
      }
    });
  }

  /**
   * Save history to persistent storage
   */
  private saveHistory(): void {
    try {
      this.store.set('clipboardHistory', this.history);
    } catch (error) {
      console.error('Error saving clipboard history:', error);
    }
  }

  /**
   * Load history from persistent storage
   */
  private loadHistory(): void {
    try {
      const saved = this.store.get('clipboardHistory') as unknown[] | undefined;
      if (saved && Array.isArray(saved)) {
        // Migrate old entries without type field
        this.history = saved.map((rawEntry): ClipboardEntry => {
          const entry = rawEntry as Record<string, unknown>;
          if (!entry.type) {
            // Old entry format - convert to text entry
            return {
              id: String(entry.id || `clip-${Date.now()}`),
              type: 'text',
              content: String(entry.content || ''),
              timestamp: Number(entry.timestamp || Date.now()),
              pinned: Boolean(entry.pinned),
              size: Number(entry.size || 0),
            };
          }
          return rawEntry as ClipboardEntry;
        });
      } else {
        this.history = [];
      }
    } catch (error) {
      console.error('Error loading clipboard history:', error);
      this.history = [];
    }
  }

  /**
   * Get image data URL for an entry
   */
  async getImageDataUrl(imagePath: string): Promise<string | null> {
    return clipboardImageStorage.getImageAsDataUrl(imagePath);
  }

  /**
   * Get thumbnail data URL for an entry
   */
  async getThumbnailDataUrl(thumbnailPath: string): Promise<string | null> {
    return clipboardImageStorage.getThumbnailAsDataUrl(thumbnailPath);
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    this.saveHistory();
    console.log('Clipboard monitoring stopped');
  }
}

export const clipboardMonitor = new ClipboardMonitor();
