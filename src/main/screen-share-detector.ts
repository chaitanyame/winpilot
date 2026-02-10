import { getPlatformAdapter } from '../platform';
import { logger } from '../utils/logger';

const SCREEN_SHARE_APPS = [
  'zoom',
  'teams',
  'obs64',
  'obs32',
  'obs',
  'discord',
  'webex',
  'gotomeeting',
  'skype',
  'slack',
];

export class ScreenShareDetector {
  private timer: NodeJS.Timeout | null = null;
  private isActive = false;
  private listeners: Array<(active: boolean) => void> = [];
  private isPolling = false; // Prevent concurrent polls
  private isPaused = false; // Pause polling during long operations
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds - balance between responsiveness and CPU usage

  start(): void {
    if (this.timer) return;
    // Do initial poll immediately
    this.poll().catch(error => {
      logger.error('ScreenShareDetector', 'Initial poll failed', error);
    });
    // Then poll every 30 seconds
    this.timer = setInterval(() => {
      this.poll().catch(error => {
        logger.error('ScreenShareDetector', 'Polling failed', error);
      });
    }, this.POLL_INTERVAL_MS);
    logger.copilot('[ScreenShareDetector] Started with 30s polling interval');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.copilot('[ScreenShareDetector] Stopped');
    }
    // Reset state when stopped
    this.isActive = false;
    this.isPolling = false;
    this.isPaused = false;
  }

  /**
   * Pause polling temporarily during long-running operations
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume polling after long-running operations complete
   */
  resume(): void {
    this.isPaused = false;
  }

  onChange(listener: (active: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async poll(): Promise<void> {
    // Skip if paused or previous poll still running
    if (this.isPaused || this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      const adapter = getPlatformAdapter();
      const processes = await adapter.process.listProcesses({ sortBy: 'name', limit: 200 });
      const running = processes.map(p => p.name.toLowerCase());
      if (running.length === 0) {
        return;
      }
      const isSharing = running.some(name => SCREEN_SHARE_APPS.some(app => name.includes(app)));

      if (isSharing !== this.isActive) {
        this.isActive = isSharing;
        logger.copilot(`[ScreenShareDetector] Screen sharing status changed: ${isSharing ? 'ACTIVE' : 'INACTIVE'}`);
        this.listeners.forEach(listener => listener(isSharing));
      }
    } finally {
      this.isPolling = false;
    }
  }
}

export const screenShareDetector = new ScreenShareDetector();
