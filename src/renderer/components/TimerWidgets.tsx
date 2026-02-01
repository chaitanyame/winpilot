import { useEffect, useState, memo } from 'react';
import { Timer, TimerType, TimerStatus } from '../../shared/types';

// Format milliseconds to HH:MM:SS or MM:SS
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Get timer icon based on type
function getTimerIcon(type: TimerType): string {
  switch (type) {
    case TimerType.TIMER: return '⏱️';
    case TimerType.COUNTDOWN: return '⏳';
    case TimerType.POMODORO: return '🍅';
  }
}

// Get status icon
function getStatusIcon(status: TimerStatus): string {
  switch (status) {
    case TimerStatus.RUNNING: return '▶️';
    case TimerStatus.PAUSED: return '⏸️';
    case TimerStatus.COMPLETED: return '✅';
    default: return '⏹️';
  }
}

// Individual Timer Widget - memoized to prevent re-renders when other timers update
const TimerWidget = memo(({ timer, onStart, onPause, onReset, onDelete, onSkip }: {
  timer: Timer;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onDelete: (id: string) => void;
  onSkip?: (id: string) => void;
}) => {
  const displayTime = timer.type === TimerType.TIMER
    ? timer.elapsed
    : timer.remaining || 0;

  const progress = timer.type === TimerType.POMODORO && timer.duration
    ? ((timer.duration - (timer.remaining || 0)) / timer.duration) * 100
    : timer.type === TimerType.COUNTDOWN && timer.duration
    ? ((timer.duration - (timer.remaining || 0)) / timer.duration) * 100
    : 0;

  return (
    <div className="timer-widget">
      <div className="timer-header">
        <span className="timer-icon">{getTimerIcon(timer.type)}</span>
        <span className="timer-name">{timer.name}</span>
        <span className="timer-status">{getStatusIcon(timer.status)}</span>
      </div>

      <div className="timer-display">{formatTime(displayTime)}</div>

      {progress > 0 && (
        <div className="timer-progress">
          <div className="timer-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {timer.type === TimerType.POMODORO && (
        <div className="timer-info">
          {timer.isBreak ? '☕ Break' : '💼 Work'} • Cycle {timer.pomodoroCycle || 1}
        </div>
      )}

      <div className="timer-controls">
        {timer.status === TimerStatus.RUNNING ? (
          <button onClick={() => onPause(timer.id)} title="Pause">⏸️</button>
        ) : (
          <button onClick={() => onStart(timer.id)} title="Start">▶️</button>
        )}
        <button onClick={() => onReset(timer.id)} title="Reset">🔄</button>
        {timer.type === TimerType.POMODORO && onSkip && timer.status === TimerStatus.RUNNING && (
          <button onClick={() => onSkip(timer.id)} title="Skip Phase">⏭️</button>
        )}
        <button onClick={() => onDelete(timer.id)} title="Delete">🗑️</button>
      </div>
    </div>
  );
});
TimerWidget.displayName = 'TimerWidget';

// Main Timer Widgets Container
export function TimerWidgets() {
  const [timers, setTimers] = useState<Timer[]>([]);

  // Load timers on mount
  useEffect(() => {
    loadTimers();
    window.electronAPI.subscribeToTimers();

    // Listen for timer updates
    const unsubTick = window.electronAPI.onTimerTick((timer: unknown) => {
      const updatedTimer = timer as Timer;
      setTimers(prev => prev.map(t => t.id === updatedTimer.id ? updatedTimer : t));
    });

    const unsubCreated = window.electronAPI.onTimerCreated((timer: unknown) => {
      const newTimer = timer as Timer;
      setTimers(prev => {
        // Avoid duplicates - only add if timer doesn't already exist
        if (prev.some(t => t.id === newTimer.id)) {
          return prev.map(t => t.id === newTimer.id ? newTimer : t);
        }
        return [...prev, newTimer];
      });
    });

    const unsubCompleted = window.electronAPI.onTimerCompleted((timer: unknown) => {
      const completedTimer = timer as Timer;
      setTimers(prev => prev.map(t => t.id === completedTimer.id ? completedTimer : t));
    });

    const unsubDeleted = window.electronAPI.onTimerDeleted((id: string) => {
      setTimers(prev => prev.filter(t => t.id !== id));
    });

    return () => {
      unsubTick();
      unsubCreated();
      unsubCompleted();
      unsubDeleted();
    };
  }, []);

  const loadTimers = async () => {
    const loadedTimers = await window.electronAPI.timerList();
    setTimers(loadedTimers as Timer[]);
  };

  const handleStart = async (id: string) => {
    await window.electronAPI.timerStart(id);
  };

  const handlePause = async (id: string) => {
    await window.electronAPI.timerPause(id);
  };

  const handleReset = async (id: string) => {
    await window.electronAPI.timerReset(id);
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.timerDelete(id);
  };

  const handleSkip = async (id: string) => {
    await window.electronAPI.timerSkip(id);
  };

  // Only show if there are active (non-idle) timers
  const activeTimers = timers.filter(t => t.status !== TimerStatus.IDLE);

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <div className="timer-widgets-container">
      <div className="timer-widgets">
        {activeTimers.map(timer => (
          <TimerWidget
            key={timer.id}
            timer={timer}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            onDelete={handleDelete}
            onSkip={handleSkip}
          />
        ))}
      </div>
    </div>
  );
}
