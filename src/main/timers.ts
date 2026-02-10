// Timer State Management for Desktop Commander
// Handles Timer, Countdown, and Pomodoro timers

import { EventEmitter } from 'events';
import { getStore } from './store';
import { Notification } from 'electron';
import { Timer, TimerType, TimerStatus } from '../shared/types';

// ============================================================================
// Timer Manager
// ============================================================================

class TimerManager extends EventEmitter {
  private timers: Map<string, Timer> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private store = getStore();

  constructor() {
    super();
    this.loadTimers();
  }

  // -------------------------------------------------------------------------
  // Timer CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new timer
   */
  createTimer(type: TimerType, name: string, options?: { duration?: number; workDuration?: number; breakDuration?: number }): Timer {
    const timer: Timer = {
      id: `timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: TimerStatus.IDLE,
      name,
      elapsed: 0,
      ...options
    };

    if (type === TimerType.POMODORO) {
      timer.pomodoroCycle = 0;
      timer.pomodoroWorkDuration = options?.workDuration || 25;
      timer.pomodoroBreakDuration = options?.breakDuration || 5;
      timer.duration = (timer.pomodoroWorkDuration * 60 * 1000);
      timer.remaining = timer.duration;
      timer.isBreak = false;
    } else if (type === TimerType.COUNTDOWN && options?.duration) {
      timer.duration = options.duration;
      timer.remaining = options.duration;
    }

    this.timers.set(timer.id, timer);
    this.saveTimers();
    this.emit('timer-created', timer);

    return timer;
  }

  /**
   * Get a timer by ID
   */
  getTimer(id: string): Timer | undefined {
    return this.timers.get(id);
  }

  /**
   * Get all timers
   */
  getAllTimers(): Timer[] {
    return Array.from(this.timers.values());
  }

  /**
   * Delete a timer
   */
  deleteTimer(id: string): boolean {
    const timer = this.timers.get(id);
    if (!timer) return false;

    // Stop if running
    if (timer.status === TimerStatus.RUNNING) {
      this.stopTimer(id);
    }

    this.timers.delete(id);
    this.saveTimers();
    this.emit('timer-deleted', id);

    return true;
  }

  // -------------------------------------------------------------------------
  // Timer Controls
  // -------------------------------------------------------------------------

  /**
   * Start a timer
   */
  startTimer(id: string): Timer | null {
    const timer = this.timers.get(id);
    if (!timer) return null;

    timer.status = TimerStatus.RUNNING;
    timer.startTime = Date.now() - (timer.type === TimerType.TIMER ? timer.elapsed : 0);

    const interval = setInterval(() => {
      this.tickTimer(id);
    }, 1000);

    this.intervals.set(id, interval);
    this.saveTimers();
    this.emit('timer-started', timer);

    return timer;
  }

  /**
   * Pause a timer
   */
  pauseTimer(id: string): Timer | null {
    const timer = this.timers.get(id);
    if (!timer || timer.status !== TimerStatus.RUNNING) return null;

    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    timer.status = TimerStatus.PAUSED;
    this.saveTimers();
    this.emit('timer-paused', timer);

    return timer;
  }

  /**
   * Reset a timer
   */
  resetTimer(id: string): Timer | null {
    const timer = this.timers.get(id);
    if (!timer) return null;

    // Stop if running
    if (timer.status === TimerStatus.RUNNING) {
      this.pauseTimer(id);
    }

    timer.elapsed = 0;
    timer.status = TimerStatus.IDLE;

    if (timer.type === TimerType.COUNTDOWN || timer.type === TimerType.POMODORO) {
      timer.remaining = timer.duration || 0;
    }

    if (timer.type === TimerType.POMODORO) {
      timer.pomodoroCycle = 0;
      timer.isBreak = false;
    }

    this.saveTimers();
    this.emit('timer-reset', timer);

    return timer;
  }

  /**
   * Stop a timer (internal use)
   */
  private stopTimer(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  // -------------------------------------------------------------------------
  // Timer Logic
  // -------------------------------------------------------------------------

  /**
   * Tick - called every second for running timers
   */
  private tickTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer || timer.status !== TimerStatus.RUNNING) return;

    const now = Date.now();

    switch (timer.type) {
      case TimerType.TIMER:
        timer.elapsed = now - (timer.startTime || now);
        this.emit('timer-tick', timer);
        break;

      case TimerType.COUNTDOWN:
        if (timer.remaining !== undefined && timer.remaining > 0) {
          timer.remaining = Math.max(0, timer.remaining - 1000);
          this.emit('timer-tick', timer);

          if (timer.remaining === 0) {
            this.completeTimer(id);
          }
        }
        break;

      case TimerType.POMODORO:
        if (timer.remaining !== undefined && timer.remaining > 0) {
          timer.remaining = Math.max(0, timer.remaining - 1000);
          this.emit('timer-tick', timer);

          if (timer.remaining === 0) {
            this.pomodoroPhaseComplete(id);
          }
        }
        break;
    }

    // Removed saveTimers() - now only save on pause/stop/complete for performance
  }

  /**
   * Complete a countdown timer
   */
  private completeTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;

    this.stopTimer(id);
    timer.status = TimerStatus.COMPLETED;

    this.showNotification('Timer Complete', `${timer.name} has finished!`);
    this.emit('timer-completed', timer);
    this.saveTimers();
  }

  /**
   * Handle Pomodoro phase completion
   */
  private pomodoroPhaseComplete(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;

    this.stopTimer(id);

    if (timer.isBreak) {
      // Break is over, back to work
      timer.isBreak = false;
      timer.duration = (timer.pomodoroWorkDuration || 25) * 60 * 1000;
      timer.remaining = timer.duration;
      timer.status = TimerStatus.IDLE;

      this.showNotification(
        'Break Over',
        `Time to focus! Starting work cycle ${timer.pomodoroCycle ? timer.pomodoroCycle + 1 : 1}.`
      );
    } else {
      // Work is over, start break
      timer.isBreak = true;
      timer.pomodoroCycle = (timer.pomodoroCycle || 0) + 1;
      timer.duration = (timer.pomodoroBreakDuration || 5) * 60 * 1000;
      timer.remaining = timer.duration;
      timer.status = TimerStatus.IDLE;

      this.showNotification(
        'Pomodoro Complete',
        `Great work! Cycle ${timer.pomodoroCycle} complete. Take a ${timer.pomodoroBreakDuration || 5} minute break.`
      );
    }

    this.emit('timer-completed', timer);
    this.saveTimers();
  }

  /**
   * Skip to next Pomodoro phase
   */
  skipPomodoroPhase(id: string): Timer | null {
    const timer = this.timers.get(id);
    if (!timer || timer.type !== TimerType.POMODORO) return null;

    this.stopTimer(id);

    if (timer.isBreak) {
      // Skip break, go back to work
      timer.isBreak = false;
      timer.duration = (timer.pomodoroWorkDuration || 25) * 60 * 1000;
    } else {
      // Skip work, go to break
      timer.isBreak = true;
      timer.pomodoroCycle = (timer.pomodoroCycle || 0) + 1;
      timer.duration = (timer.pomodoroBreakDuration || 5) * 60 * 1000;
    }

    timer.remaining = timer.duration;
    timer.status = TimerStatus.IDLE;

    this.saveTimers();
    this.emit('timer-skipped', timer);

    return timer;
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Show a notification
   */
  private showNotification(title: string, body: string): void {
    try {
      const settings = this.store.get('settings');
      if (settings?.notifications?.enabled !== false) {
        new Notification({ title, body }).show();
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Format milliseconds to MM:SS or HH:MM:SS
   */
  static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get timer progress (0-1)
   */
  static getProgress(timer: Timer): number {
    if (timer.type === TimerType.TIMER) {
      return 0; // Timer doesn't have a defined end
    }

    if (!timer.duration || timer.duration === 0) return 0;
    return 1 - ((timer.remaining || 0) / timer.duration);
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Save timers to store
   */
  private saveTimers(): void {
    try {
      this.store.set('activeTimers', Array.from(this.timers.values()));
    } catch (error) {
      console.error('Error saving timers:', error);
    }
  }

  /**
   * Load timers from store
   */
  private loadTimers(): void {
    try {
      const savedTimers = this.store.get('activeTimers') as Timer[] || [];
      for (const timer of savedTimers) {
        // Reset all timers to idle on app load so they don't appear automatically
        timer.status = TimerStatus.IDLE;
        this.timers.set(timer.id, timer);
      }
    } catch (error) {
      console.error('Error loading timers:', error);
    }
  }

  /**
   * Clean up (call on app shutdown)
   */
  destroy(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const timerManager = new TimerManager();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple timer
 */
export function createTimer(name: string): Timer {
  return timerManager.createTimer(TimerType.TIMER, name);
}

/**
 * Create a countdown timer
 */
export function createCountdown(name: string, durationMinutes: number): Timer {
  const durationMs = durationMinutes * 60 * 1000;
  return timerManager.createTimer(TimerType.COUNTDOWN, name, { duration: durationMs });
}

/**
 * Create a Pomodoro timer
 */
export function createPomodoro(name: string, workMinutes?: number, breakMinutes?: number): Timer {
  return timerManager.createTimer(TimerType.POMODORO, name, {
    workDuration: workMinutes,
    breakDuration: breakMinutes
  });
}

/**
 * Get formatted time string
 */
export function formatTime(ms: number): string {
  return TimerManager.formatTime(ms);
}
