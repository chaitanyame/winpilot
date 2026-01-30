# Scheduled Tasks & Notifications System

## Overview

This implementation adds a complete scheduled tasks and notifications system to Desktop Commander, allowing users to:

- Schedule recurring AI tasks using cron expressions
- Run background automation without manual triggering
- Receive notifications when scheduled tasks complete
- Persist scheduled tasks across app restarts

## Features Implemented

### 1. Task Scheduler (`src/main/scheduler.ts`)

The core scheduler manages task execution with:

- **Cron-based scheduling** using `node-cron` library
- **Concurrent task limiting** (max 3 tasks by default)
- **Task execution tracking** with success/failure status
- **Automatic retry** - Tasks run on schedule until disabled
- **Integration with Copilot AI** - Uses agentic loop for task execution

Key methods:
- `init()` - Load and schedule all enabled tasks on app start
- `scheduleTask(task)` - Schedule a task with cron expression
- `executeTask(taskId)` - Execute a task immediately
- `unscheduleTask(taskId)` - Remove a task from scheduler
- `destroy()` - Clean up all scheduled jobs on app quit

### 2. Notification Manager (`src/main/notifications.ts`)

Dual notification system:

- **In-app toast notifications** - When app is visible/focused
- **Native OS notifications** - When app is minimized/background
- **Smart routing** - Automatically chooses best notification method
- **Click-to-focus** - Clicking native notification brings app to front

Notification types:
- Success (green) - Task completed successfully
- Error (red) - Task failed
- Info (blue) - Informational messages
- Warning (yellow) - Warning messages

### 3. Data Storage (`src/main/store.ts`)

Extended the Electron store with:

**Scheduled Tasks:**
```typescript
{
  id: string;
  name: string;
  prompt: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRun?: {
    timestamp: number;
    status: 'success' | 'error';
    result?: string;
    error?: string;
  };
}
```

**Task Logs:**
- Keeps last 100 execution logs
- Tracks task duration, status, results
- Useful for debugging and monitoring

### 4. UI Components

#### Toast Notifications (`src/renderer/components/ToastNotifications.tsx`)

- Auto-dismiss after 5 seconds
- Slide-in animation from right
- Stacked notifications
- Manual dismiss button
- Color-coded by type

#### Scheduled Tasks Panel (`src/renderer/components/ScheduledTasksPanel.tsx`)

Comprehensive task management UI:

**Features:**
- List all scheduled tasks
- Add new tasks with form
- Edit/delete existing tasks
- Toggle task enabled state
- Manual task execution (Run Now button)
- View last execution status
- Cron expression presets

**Cron Presets:**
- Every 5 minutes: `*/5 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Every hour: `0 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at 9 AM: `0 9 * * *`
- Weekdays at 9 AM: `0 9 * * 1-5`
- Custom expressions supported

## Integration Points

### Main Process (`src/main/index.ts`)

```typescript
import { taskScheduler } from './scheduler';

async function initApp() {
  // ... existing initialization ...

  // Initialize task scheduler
  await taskScheduler.init();
}

app.on('before-quit', () => {
  taskScheduler.destroy();
  // ... other cleanup ...
});
```

### IPC Handlers (`src/main/ipc.ts`)

New IPC channels:
- `task:list` - Get all scheduled tasks
- `task:add` - Create new task
- `task:update` - Update existing task
- `task:delete` - Delete task
- `task:toggle` - Toggle enabled state
- `task:execute` - Manually execute task
- `task:logs` - Get execution logs

### Renderer API (`src/preload/index.ts`)

Exposed to renderer:
```typescript
window.electronAPI.taskList()
window.electronAPI.taskAdd(task)
window.electronAPI.taskUpdate(id, updates)
window.electronAPI.taskDelete(id)
window.electronAPI.taskToggle(id)
window.electronAPI.taskExecute(id)
window.electronAPI.taskLogs()
window.electronAPI.onNotification(callback)
```

## Usage Examples

### Example 1: Cricket Score Updates

```javascript
// Add a task to get cricket scores every 5 minutes
await window.electronAPI.taskAdd({
  name: "Cricket Score Updates",
  prompt: "Get the latest IND vs AUS cricket score and show me the scorecard",
  cronExpression: "*/5 * * * *",  // Every 5 minutes
  enabled: true
});
```

### Example 2: Daily Weather Report

```javascript
// Daily weather at 9 AM
await window.electronAPI.taskAdd({
  name: "Morning Weather",
  prompt: "What's the weather forecast for San Francisco today?",
  cronExpression: "0 9 * * *",  // 9 AM daily
  enabled: true
});
```

### Example 3: Weekday Stock Updates

```javascript
// Stock prices on weekdays at market open
await window.electronAPI.taskAdd({
  name: "Stock Prices",
  prompt: "Get the current prices for AAPL, GOOGL, and MSFT",
  cronExpression: "30 9 * * 1-5",  // 9:30 AM weekdays
  enabled: true
});
```

## Configuration

Default settings in `src/shared/constants.ts`:

```typescript
notifications: {
  enabled: true,
  useNative: true,
  useToast: true,
  toastDuration: 5000,  // 5 seconds
  sound: true,
},
scheduledTasks: {
  enabled: true,
  maxConcurrent: 3,  // Max tasks running at once
}
```

## Cron Expression Format

```
 ┌────────────── minute (0 - 59)
 │ ┌──────────── hour (0 - 23)
 │ │ ┌────────── day of month (1 - 31)
 │ │ │ ┌──────── month (1 - 12)
 │ │ │ │ ┌────── day of week (0 - 6) (0 = Sunday)
 │ │ │ │ │
 * * * * *
```

**Common patterns:**
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1-5` - Weekdays at 9 AM
- `0 0 * * 0` - Sundays at midnight

## Task Execution Flow

1. **Cron triggers** → Scheduler calls `executeTask()`
2. **Check running** → Skip if already running
3. **Check limit** → Skip if max concurrent reached
4. **Execute task** → Run AI agentic loop with task prompt
5. **Collect result** → Gather final message from loop
6. **Update state** → Save lastRun status to store
7. **Add log** → Append to execution logs
8. **Notify user** → Show toast or native notification

## Error Handling

- **Invalid cron** → Validation error shown in UI
- **Task fails** → Error logged, notification shown
- **AI timeout** → Respects agenticLoop.iterationTimeoutSeconds
- **Max iterations** → Respects agenticLoop.maxIterations
- **Concurrent limit** → Tasks queued until slot available

## Testing

### Manual Testing Steps

1. **Start app** → Scheduled tasks should load from storage
2. **Open Tasks panel** → Click Clock icon in header
3. **Add test task:**
   - Name: "Test Task"
   - Prompt: "What time is it?"
   - Schedule: Every 1 minute (`*/1 * * * *`)
   - Enable: ✓
4. **Wait 1 minute** → Notification should appear
5. **Check last run** → Should show success status
6. **Run manually** → Click ▶️ button
7. **Disable task** → Click pause button
8. **Delete task** → Click 🗑 button

### Verification Checklist

- [ ] Tasks persist across app restarts
- [ ] Cron expression validation works
- [ ] Toast notifications appear when app visible
- [ ] Native notifications appear when app minimized
- [ ] Clicking notification focuses app
- [ ] Max concurrent limit enforced
- [ ] Task enable/disable works
- [ ] Manual execution works
- [ ] Task deletion works
- [ ] Last run status updated
- [ ] Error handling works

## Dependencies

- `node-cron` (^3.0.3) - Cron job scheduler
- `@types/node-cron` (^3.0.11) - TypeScript types

## Files Modified/Created

### New Files (5)
1. `src/main/scheduler.ts` - Task scheduler implementation
2. `src/main/notifications.ts` - Notification manager
3. `src/renderer/components/ScheduledTasksPanel.tsx` - Tasks UI
4. `src/renderer/components/ToastNotifications.tsx` - Toast component
5. `SCHEDULED_TASKS.md` - This documentation

### Modified Files (7)
1. `src/main/index.ts` - Initialize scheduler
2. `src/main/store.ts` - Add task storage
3. `src/main/ipc.ts` - Add task IPC handlers
4. `src/preload/index.ts` - Expose task API
5. `src/shared/types.ts` - Add task types
6. `src/shared/constants.ts` - Add default settings
7. `src/renderer/App.tsx` - Add ToastContainer
8. `src/renderer/components/CommandPalette.tsx` - Add Tasks button

## Future Enhancements

Possible improvements for future versions:

1. **Task Templates** - Pre-built tasks (weather, stocks, news)
2. **Conditional Execution** - Run task only if condition met
3. **Task Chaining** - Run task B after task A completes
4. **Rich Notifications** - Inline actions (snooze, dismiss, view)
5. **Task Groups** - Organize related tasks
6. **Execution Limits** - Pause after N failures
7. **Export/Import** - Share task configurations
8. **Webhooks** - Trigger external services
9. **Task History View** - Browse past executions
10. **Custom intervals** - UI for "every N hours/days"

## Security Notes

- Task prompts are stored unencrypted (consider encryption for sensitive data)
- No rate limiting on manual execution (could add cooldown)
- Tasks respect tool permission system
- Protected paths enforced for file operations
- Max concurrent tasks prevents resource exhaustion

## Performance Considerations

- Scheduler uses minimal CPU when idle
- Tasks run in separate async operations
- No performance impact when tasks disabled
- Logs capped at 100 entries to prevent unbounded growth
- Notification queue prevents UI blocking

## Troubleshooting

**Task not executing:**
- Check enabled state in UI
- Verify cron expression is valid
- Check console for errors
- Ensure app is running (not quit)

**Notifications not showing:**
- Check settings.ui.toastNotifications
- Verify notification permissions (OS level)
- Check console for errors

**Task fails immediately:**
- Check AI model is configured
- Verify GitHub Copilot access
- Check task prompt is valid
- Review error in lastRun

**Tasks lost after restart:**
- Check store initialization
- Verify no errors in console
- Check .electron-dev directory permissions
