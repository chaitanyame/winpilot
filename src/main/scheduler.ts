// Task Scheduler - Manages scheduled tasks with cron-based execution

import cron from 'node-cron';
import { getScheduledTasks, updateScheduledTask, addTaskLog, getSettings } from './store';
import { ScheduledTask } from '../shared/types';
import { showNotification } from './notifications';
import { copilotController } from '../copilot/client';

class TaskScheduler {
  private jobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
  private runningTasks: Set<string> = new Set();

  /**
   * Initialize scheduler - load and schedule all enabled tasks
   */
  async init(): Promise<void> {
    const tasks = getScheduledTasks();
    console.log(`Initializing scheduler with ${tasks.length} tasks`);

    for (const task of tasks) {
      if (task.enabled) {
        try {
          this.scheduleTask(task);
        } catch (error) {
          console.error(`Failed to schedule task ${task.name}:`, error);
        }
      }
    }
  }

  /**
   * Schedule a task with cron
   */
  scheduleTask(task: ScheduledTask): void {
    // Validate cron expression
    if (!cron.validate(task.cronExpression)) {
      throw new Error(`Invalid cron expression: ${task.cronExpression}`);
    }

    // Remove existing job if any
    this.unscheduleTask(task.id);

    // Create new cron job
    const job = cron.schedule(task.cronExpression, async () => {
      await this.executeTask(task.id);
    });

    this.jobs.set(task.id, job);
    console.log(`Scheduled task: ${task.name} (${task.cronExpression})`);
  }

  /**
   * Execute a scheduled task
   */
  async executeTask(taskId: string): Promise<void> {
    const settings = getSettings();
    const tasks = getScheduledTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return;
    }

    // Check if already running
    if (this.runningTasks.has(taskId)) {
      console.log(`Task already running: ${task.name}`);
      return;
    }

    // Check max concurrent tasks limit (with default fallback)
    const maxConcurrent = settings.scheduledTasks?.maxConcurrent ?? 3;
    if (this.runningTasks.size >= maxConcurrent) {
      console.log(`Max concurrent tasks reached, skipping: ${task.name}`);
      return;
    }

    this.runningTasks.add(taskId);
    console.log(`Executing scheduled task: ${task.name}`);

    const startTime = Date.now();

    try {
      let lastMessage = '';
      let hasResponse = false;

      // Run agentic loop
      for await (const event of copilotController.sendMessageWithLoop(task.prompt)) {
        if (event.type === 'text' && event.content) {
          lastMessage = event.content;
          hasResponse = true;
        } else if (event.type === 'done') {
          // Success!
          const duration = Date.now() - startTime;

          updateScheduledTask(taskId, {
            lastRun: {
              timestamp: Date.now(),
              status: 'success',
              result: lastMessage,
            },
          });

          addTaskLog({
            taskId: task.id,
            taskName: task.name,
            timestamp: Date.now(),
            status: 'success',
            result: lastMessage,
            duration,
          });

          showNotification({
            title: `✅ ${task.name}`,
            message: 'Task completed successfully',
            type: 'success',
            sound: false,
          });

          this.runningTasks.delete(taskId);
          return;
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }

      // If we get here without a done event, something went wrong
      if (!hasResponse) {
        throw new Error('No response from AI');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Task failed: ${task.name}`, error);

      updateScheduledTask(taskId, {
        lastRun: {
          timestamp: Date.now(),
          status: 'error',
          error: errorMessage,
        },
      });

      addTaskLog({
        taskId: task.id,
        taskName: task.name,
        timestamp: Date.now(),
        status: 'error',
        error: errorMessage,
        duration,
      });

      showNotification({
        title: `❌ ${task.name}`,
        message: `Task failed: ${errorMessage}`,
        type: 'error',
        sound: false,
      });
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * Unschedule a task
   */
  unscheduleTask(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
      console.log(`Unscheduled task: ${taskId}`);
    }
  }

  /**
   * Check if a task is currently running
   */
  isTaskRunning(taskId: string): boolean {
    return this.runningTasks.has(taskId);
  }

  /**
   * Get list of currently running task IDs
   */
  getRunningTasks(): string[] {
    return Array.from(this.runningTasks);
  }

  /**
   * Cleanup - stop all scheduled jobs
   */
  destroy(): void {
    console.log('Destroying task scheduler');
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
    this.runningTasks.clear();
  }
}

// Singleton instance
export const taskScheduler = new TaskScheduler();
