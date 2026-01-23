import React, { useEffect, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme, setTheme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Listen for window shown/hidden events
    const unsubscribeShown = window.electronAPI.onWindowShown(() => {
      setIsVisible(true);
    });

    const unsubscribeHidden = window.electronAPI.onWindowHidden(() => {
      setIsVisible(false);
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
