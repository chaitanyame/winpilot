import { useEffect } from 'react';

interface UseHotkeyOptions {
  enabled?: boolean;
}

export function useHotkey(
  hotkey: string,
  callback: () => void,
  options: UseHotkeyOptions = {}
): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const keys = hotkey.toLowerCase().split('+').map(k => k.trim());
    
    const handler = (e: KeyboardEvent) => {
      const ctrl = keys.includes('ctrl') || keys.includes('control');
      const alt = keys.includes('alt');
      const shift = keys.includes('shift');
      
      // Get the main key (not a modifier)
      const mainKey = keys.find(k => 
        !['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'command'].includes(k)
      );

      if (!mainKey) return;

      const ctrlMatch = ctrl === (e.ctrlKey || e.metaKey);
      const altMatch = alt === e.altKey;
      const shiftMatch = shift === e.shiftKey;
      const keyMatch = e.key.toLowerCase() === mainKey;

      if (ctrlMatch && altMatch && shiftMatch && keyMatch) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hotkey, callback, enabled]);
}
