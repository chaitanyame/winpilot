import { useEffect } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme } = useTheme();

  useEffect(() => {
    // Listen for window shown/hidden events
    const unsubscribeShown = window.electronAPI.onWindowShown(() => {
      // Window is now visible
    });

    const unsubscribeHidden = window.electronAPI.onWindowHidden(() => {
      // Window is now hidden
    });

    return () => {
      unsubscribeShown();
      unsubscribeHidden();
    };
  }, []);

  return (
    <div className={`app ${theme}`}>
      <CommandPalette />
    </div>
  );
}

export default App;
