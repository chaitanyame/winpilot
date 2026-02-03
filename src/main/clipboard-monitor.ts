// Clipboard Monitor - Automatic clipboard history tracking

import { EventEmitter } from 'events';
import { clipboard } from 'electron';
import { getStore } from './store';

export interface ClipboardEntry {
  id: string;
  content: string;
  timestamp: number;
  pinned: boolean;
  size: number;
}

class ClipboardMonitor extends EventEmitter {
  private history: ClipboardEntry[] = [];
  private currentContent: string = '';
  private monitorInterval: NodeJS.Timeout | null = null;
  private store = getStore();
  private isMonitoring = false;

  constructor() {
    super();
    this.loadHistory();
  }

  /**
   * Start clipboard monitoring (500ms polling interval)
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Initialize with current clipboard
    this.currentContent = clipboard.readText() || '';

    // Poll every 500ms for changes
    this.monitorInterval = setInterval(() => {
      this.checkClipboard();
    }, 500);

    this.emit('monitoring-started');
    console.log('Clipboard monitoring started');
  }

  /**
   * Check clipboard for changes
   */
  private checkClipboard(): void {
    const newContent = clipboard.readText() || '';

    // Skip if content unchanged or empty
    if (newContent === this.currentContent || newContent.length === 0) {
      return;
    }

    // Skip if content too large (>1MB)
    if (newContent.length > 1024 * 1024) {
      return;
    }

    this.currentContent = newContent;

    const entry: ClipboardEntry = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: newContent,
      timestamp: Date.now(),
      pinned: false,
      size: new Blob([newContent]).size,
    };

    this.addEntry(entry);
    this.emit('clipboard-changed', entry);
  }

  /**
   * Add new clipboard entry to history
   */
  private addEntry(entry: ClipboardEntry): void {
    // Check for duplicates (don't add if exact same content is already at top)
    if (this.history[0]?.content === entry.content) {
      return;
    }

    // Add to beginning
    this.history.unshift(entry);

    // Keep only 50 entries (excluding pinned)
    const pinnedEntries = this.history.filter(e => e.pinned);
    const unpinnedEntries = this.history.filter(e => !e.pinned);

    if (unpinnedEntries.length > 50) {
      unpinnedEntries.splice(50); // Keep only first 50
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
    const initialLength = this.history.length;
    this.history = this.history.filter(e => e.id !== id);

    if (this.history.length < initialLength) {
      this.saveHistory();
      return true;
    }
    return false;
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

    clipboard.writeText(entry.content);
    this.currentContent = entry.content; // Update to prevent re-adding
    return true;
  }

  /**
   * Search history by content
   */
  searchHistory(query: string): ClipboardEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(e =>
      e.content.toLowerCase().includes(lowerQuery)
    );
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
      const saved = this.store.get('clipboardHistory') as ClipboardEntry[];
      this.history = saved || [];
    } catch (error) {
      console.error('Error loading clipboard history:', error);
      this.history = [];
    }
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
