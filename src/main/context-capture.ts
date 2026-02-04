import { ActiveWindowContext } from '../shared/types';
import { getPlatformAdapter } from '../platform/index';
import { getSettings } from './store';

class ContextCaptureService {
  private currentContext: ActiveWindowContext | null = null;

  /**
   * Captures the current active window context
   * @returns Promise<ActiveWindowContext | null>
   */
  async captureContext(): Promise<ActiveWindowContext | null> {
    try {
      const settings = getSettings();

      // Check if context awareness is enabled
      if (!settings.contextAwareness?.enabled) {
        this.clearContext();
        return null;
      }

      const platform = getPlatformAdapter();
      const windowInfo = await platform.system.getActiveWindowInfo();

      if (!windowInfo) {
        this.clearContext();
        return null;
      }

      // Capture selected text if enabled
      let selectedText: string | undefined = undefined;
      if (settings.contextAwareness?.captureSelectedText && platform.system.captureSelectedText) {
        selectedText = await platform.system.captureSelectedText() || undefined;
      }

      // Build context object
      this.currentContext = {
        appName: windowInfo.appName,
        windowTitle: windowInfo.windowTitle,
        processId: windowInfo.processId,
        selectedText,
        capturedAt: Date.now(),
      };

      console.log('Context captured:', {
        appName: this.currentContext.appName,
        windowTitle: this.currentContext.windowTitle,
        hasSelectedText: !!this.currentContext.selectedText,
      });

      return this.currentContext;
    } catch (error) {
      console.error('Error capturing context:', error);
      this.clearContext();
      return null;
    }
  }

  /**
   * Returns the current context without capturing
   */
  getContext(): ActiveWindowContext | null {
    return this.currentContext;
  }

  /**
   * Clears the current context
   */
  clearContext(): void {
    this.currentContext = null;
    console.log('Context cleared');
  }

  /**
   * Returns a formatted context string for message injection
   */
  getContextString(): string | null {
    if (!this.currentContext) return null;

    const parts: string[] = [
      `[Context: Working in "${this.currentContext.appName}"`,
    ];

    if (this.currentContext.windowTitle) {
      parts.push(`- "${this.currentContext.windowTitle}"`);
    }

    parts.push(']');

    if (this.currentContext.selectedText) {
      parts.push(`\nSelected text:\n${this.currentContext.selectedText}`);
    }

    return parts.join(' ');
  }
}

// Export singleton instance
export const contextCaptureService = new ContextCaptureService();
