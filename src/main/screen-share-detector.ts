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

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.poll().catch(error => {
        logger.error('ScreenShareDetector', 'Polling failed', error);
      });
    }, 5000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onChange(listener: (active: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private async poll(): Promise<void> {
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
  }
}

export const screenShareDetector = new ScreenShareDetector();
