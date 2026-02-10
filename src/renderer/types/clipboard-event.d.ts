declare module 'clipboard-event' {
  import { EventEmitter } from 'events';

  class ClipboardEventListener extends EventEmitter {
    startListening(): void;
    stopListening(): boolean;
  }

  const clipboardEventListener: ClipboardEventListener;
  export default clipboardEventListener;
}
