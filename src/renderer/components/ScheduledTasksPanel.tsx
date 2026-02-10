import React, { useState, useEffect } from 'react';
import { ScheduledTask } from '../../shared/types';

interface ScheduledTasksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

export function ScheduledTasksPanel({ isOpen, onClose, variant = 'modal' }: ScheduledTasksPanelProps) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.taskList();
      setTasks(data as ScheduledTask[]);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this scheduled task?')) {
      try {
        await window.electronAPI.taskDelete(id);
        await loadTasks();
      } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task');
      }
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await window.electronAPI.taskToggle(id);
      await loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
      alert('Failed to toggle task');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await window.electronAPI.taskExecute(id);
      alert('Task execution started');
    } catch (error) {
      console.error('Failed to execute task:', error);
      alert('Failed to execute task');
    }
  };

  if (!isOpen) return null;

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--app-border)]">
          <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Scheduled Tasks</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isEditing ? (
            <TaskForm
              onSave={async (task) => {
                try {
                  await window.electronAPI.taskAdd(task);
                  await loadTasks();
                  setIsEditing(false);
                } catch (error) {
                  console.error('Failed to add task:', error);
                  alert('Failed to add task: ' + (error as Error).message);
                }
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                + Add Scheduled Task
              </button>

              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No scheduled tasks. Click "Add Scheduled Task" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task.id)}
                      onDelete={() => handleDelete(task.id)}
                      onExecute={() => handleExecute(task.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scheduled Tasks</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isEditing ? (
            <TaskForm
              onSave={async (task) => {
                try {
                  await window.electronAPI.taskAdd(task);
                  await loadTasks();
                  setIsEditing(false);
                } catch (error) {
                  console.error('Failed to add task:', error);
                  alert('Failed to add task: ' + (error as Error).message);
                }
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                + Add Scheduled Task
              </button>

              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No scheduled tasks. Click "Add Scheduled Task" to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task.id)}
                      onDelete={() => handleDelete(task.id)}
                      onExecute={() => handleExecute(task.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: ScheduledTask;
  onToggle: () => void;
  onDelete: () => void;
  onExecute: () => void;
}

function TaskCard({ task, onToggle, onDelete, onExecute }: TaskCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        task.enabled
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white">{task.name}</h3>
            {task.enabled && (
              <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded">Active</span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{task.prompt}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Schedule: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded font-mono">{task.cronExpression}</code>
          </p>
          {task.lastRun && (
            <div className="text-xs mt-2 text-gray-600 dark:text-gray-400">
              Last run: {new Date(task.lastRun.timestamp).toLocaleString()}{' '}
              <span className={task.lastRun.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                {task.lastRun.status === 'success' ? '✓ Success' : '✗ Failed'}
              </span>
              {task.lastRun.error && (
                <div className="mt-1 text-red-600 dark:text-red-400">Error: {task.lastRun.error}</div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={onExecute}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Run now"
          >
            ▶️
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={task.enabled ? 'Pause' : 'Resume'}
          >
            {task.enabled ? '⏸' : '▶'}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-colors"
            title="Delete"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaskFormProps {
  onSave: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function TaskForm({ onSave, onCancel }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    cronExpression: '*/5 * * * *',
    enabled: true,
  });

  const cronPresets = [
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.prompt.trim() || !formData.cronExpression.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          Task Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Cricket Score Updates"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          AI Prompt *
        </label>
        <textarea
          value={formData.prompt}
          onChange={e => setFormData({ ...formData, prompt: e.target.value })}
          required
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Get the latest cricket score for IND vs AUS match and show me the scorecard"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          Schedule
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          onChange={e => {
            const value = e.target.value;
            if (value) {
              setFormData({ ...formData, cronExpression: value });
            }
          }}
          value={formData.cronExpression}
        >
          {cronPresets.map(preset => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={formData.cronExpression}
          onChange={e => setFormData({ ...formData, cronExpression: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="*/5 * * * *"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Cron format: minute hour day month weekday
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
          Enable this task immediately
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Add Task
        </button>
      </div>
    </form>
  );
}
