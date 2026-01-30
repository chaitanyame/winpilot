// Notification Manager - Handles both native OS and in-app toast notifications

import { Notification, BrowserWindow } from 'electron';
import { getSettings } from './store';

export interface NotificationOptions {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  sound?: boolean;
}

/**
 * Show a notification - tries in-app toast first, falls back to native
 */
export function showNotification(options: NotificationOptions): void {
  const settings = getSettings();

  // Check if notifications are enabled (with fallback to default)
  const toastEnabled = settings.ui?.toastNotifications ?? true;
  const notificationsEnabled = settings.notifications?.enabled ?? true;

  if (!toastEnabled || !notificationsEnabled) {
    return;
  }

  // Try to show in-app toast first if app is visible
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const allWindows = BrowserWindow.getAllWindows();
  const visibleWindow = focusedWindow || allWindows.find(w => w.isVisible());

  if (visibleWindow) {
    visibleWindow.webContents.send('notification:show', options);
    return;
  }

  // Fall back to native notification if app not focused/visible
  showNativeNotification(options);
}

/**
 * Show a native OS notification
 */
function showNativeNotification(options: NotificationOptions): void {
  try {
    const notification = new Notification({
      title: options.title,
      body: options.message,
      silent: !options.sound,
      urgency: options.type === 'error' ? 'critical' : 'normal',
    });

    notification.show();

    notification.on('click', () => {
      // Focus the app when notification is clicked
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].show();
        windows[0].focus();
      }
    });
  } catch (error) {
    console.error('Failed to show native notification:', error);
  }
}
