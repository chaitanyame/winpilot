import { EventEmitter } from 'events';
import clipboardListener from 'clipboard-event';

class WindowsClipboardWatcher extends EventEmitter {
  private isListening = false;
  private readonly handleChange = () => {
    this.emit('change');
  };

  start(): boolean {
    if (this.isListening) return true;
    if (process.platform !== 'win32') return false;

    try {
      clipboardListener.on('change', this.handleChange);
      clipboardListener.startListening();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('[Clipboard] Failed to start event listener:', error);
      this.stop();
      return false;
    }
  }

  stop(): void {
    if (!this.isListening) return;
    clipboardListener.removeListener('change', this.handleChange);
    try {
      clipboardListener.stopListening();
    } catch (error) {
      console.error('[Clipboard] Failed to stop event listener:', error);
    } finally {
      this.isListening = false;
    }
  }
}

export const clipboardWatcher = new WindowsClipboardWatcher();
