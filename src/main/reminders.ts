// Native Reminders System for Desktop Commander
// Simple reminder system with notifications

import { EventEmitter } from 'events';
import { getStore } from './store';
import { Notification } from 'electron';

export interface Reminder {
  id: string;
  message: string;
  scheduledTime: number; // Unix timestamp
  completed: boolean;
  createdAt: number;
}

class ReminderManager extends EventEmitter {
  private reminders: Map<string, Reminder> = new Map();
  private scheduledTasks: Map<string, any> = new Map();
  private store = getStore();

  constructor() {
    super();
    this.loadReminders();
    this.scheduleAllReminders();
  }

  /**
   * Create a new reminder
   */
  createReminder(message: string, scheduledTime: Date): Reminder {
    const reminder: Reminder = {
      id: `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      scheduledTime: scheduledTime.getTime(),
      completed: false,
      createdAt: Date.now(),
    };

    this.reminders.set(reminder.id, reminder);
    this.saveReminders();
    this.scheduleReminder(reminder);
    this.emit('reminder-created', reminder);

    return reminder;
  }

  /**
   * Create a reminder with a delay (in minutes)
   */
  createReminderWithDelay(message: string, delayMinutes: number): Reminder {
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    return this.createReminder(message, scheduledTime);
  }

  /**
   * Get all reminders
   */
  getAllReminders(): Reminder[] {
    return Array.from(this.reminders.values())
      .filter(r => !r.completed)
      .sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  /**
   * Get a specific reminder
   */
  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  /**
   * Cancel/delete a reminder
   */
  cancelReminder(id: string): boolean {
    const reminder = this.reminders.get(id);
    if (!reminder) return false;

    // Unschedule if scheduled
    const scheduledTask = this.scheduledTasks.get(id);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledTasks.delete(id);
    }

    this.reminders.delete(id);
    this.saveReminders();
    this.emit('reminder-cancelled', id);

    return true;
  }

  /**
   * Mark reminder as completed
   */
  completeReminder(id: string): boolean {
    const reminder = this.reminders.get(id);
    if (!reminder) return false;

    reminder.completed = true;
    this.saveReminders();
    this.emit('reminder-completed', reminder);

    // Clean up scheduled task
    const scheduledTask = this.scheduledTasks.get(id);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledTasks.delete(id);
    }

    return true;
  }

  /**
   * Get active reminders (not completed, in the future)
   */
  getActiveReminders(): Reminder[] {
    const now = Date.now();
    return Array.from(this.reminders.values())
      .filter(r => !r.completed && r.scheduledTime > now)
      .sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  /**
   * Get past due reminders
   */
  getPastDueReminders(): Reminder[] {
    const now = Date.now();
    return Array.from(this.reminders.values())
      .filter(r => !r.completed && r.scheduledTime <= now)
      .sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  /**
   * Schedule a reminder notification
   */
  private scheduleReminder(reminder: Reminder): void {
    const now = Date.now();
    const delay = reminder.scheduledTime - now;

    // If already past due, trigger immediately
    if (delay <= 0) {
      setImmediate(() => this.triggerReminder(reminder));
      return;
    }

    // Schedule notification using setTimeout for one-time reminders
    const timeoutId = setTimeout(() => {
      this.triggerReminder(reminder);
    }, delay);

    // Store timeout ID as a task-like object
    this.scheduledTasks.set(reminder.id, { stop: () => clearTimeout(timeoutId) });
  }

  /**
   * Trigger a reminder notification
   */
  private triggerReminder(reminder: Reminder): void {
    if (reminder.completed) return;

    const settings = this.store.get('settings');
    if (settings?.notifications?.enabled !== false) {
      new Notification({
        title: 'Reminder',
        body: reminder.message,
        silent: settings?.notifications?.sound === false,
      }).show();
    }

    reminder.completed = true;
    this.saveReminders();
    this.emit('reminder-triggered', reminder);

    // Clean up scheduled task
    const scheduledTask = this.scheduledTasks.get(reminder.id);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledTasks.delete(reminder.id);
    }
  }

  /**
   * Schedule all reminders on startup
   */
  private scheduleAllReminders(): void {
    const now = Date.now();
    for (const reminder of this.reminders.values()) {
      if (!reminder.completed && reminder.scheduledTime > now) {
        this.scheduleReminder(reminder);
      } else if (!reminder.completed && reminder.scheduledTime <= now) {
        // Past due reminder
        this.triggerReminder(reminder);
      }
    }
  }

  /**
   * Save reminders to store
   */
  private saveReminders(): void {
    try {
      this.store.set('reminders', Array.from(this.reminders.values()));
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  }

  /**
   * Load reminders from store
   */
  private loadReminders(): void {
    try {
      const saved = this.store.get('reminders') as Reminder[] || [];
      for (const reminder of saved) {
        // Clean up old completed reminders
        if (reminder.completed) {
          const daysSinceCompletion = (Date.now() - reminder.scheduledTime) / (1000 * 60 * 60 * 24);
          if (daysSinceCompletion > 7) {
            continue; // Skip completed reminders older than 7 days
          }
        }
        this.reminders.set(reminder.id, reminder);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  }

  /**
   * Clean up (call on app shutdown)
   */
  destroy(): void {
    for (const scheduledTask of this.scheduledTasks.values()) {
      scheduledTask.stop();
    }
    this.scheduledTasks.clear();
  }
}

// Singleton instance
export const reminderManager = new ReminderManager();

// Helper functions
export function createReminder(message: string, scheduledTime: Date): Reminder {
  return reminderManager.createReminder(message, scheduledTime);
}

export function createReminderWithDelay(message: string, delayMinutes: number): Reminder {
  return reminderManager.createReminderWithDelay(message, delayMinutes);
}

export function getAllReminders(): Reminder[] {
  return reminderManager.getAllReminders();
}

export function cancelReminder(id: string): boolean {
  return reminderManager.cancelReminder(id);
}
