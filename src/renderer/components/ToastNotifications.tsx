import { useEffect, useState } from 'react';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (options: unknown) => {
      const opts = options as Omit<Toast, 'id' | 'duration'>;
      const toast: Toast = {
        ...opts,
        id: `toast-${Date.now()}-${Math.random()}`,
        duration: 5000,
      };

      setToasts(prev => [...prev, toast]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    };

    const cleanup = window.electronAPI.onNotification(handler);
    return cleanup;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };

  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div
      className={`${bgColors[toast.type]} text-white p-4 rounded-lg shadow-lg min-w-[300px] max-w-[400px] pointer-events-auto animate-slide-in`}
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-xl font-bold">{icons[toast.type]}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{toast.title}</h4>
            <p className="text-sm mt-1 opacity-90 break-words">{toast.message}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="ml-2 text-white hover:text-gray-200 opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Add keyframes for slide-in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
