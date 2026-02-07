import { useEffect } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { ChatPanel } from './components/ChatPanel';
import { ClipboardHistoryPanel } from './components/ClipboardHistoryPanel';
import { ToastContainer } from './components/ToastNotifications';
import { TimerWidgets } from './components/TimerWidgets';
import { OSDOverlay } from './components/OSDOverlay';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();

  // Detect which window this is based on hash
  const hash = window.location.hash.replace('#', '');
  const isClipboardHistory = hash === 'clipboard-history';
  const isChatPanel = hash === 'chat-panel';
  const isOSD = hash === 'osd';
  const isVoiceRecording = hash.startsWith('voice-recording');
  const isAudioRecording = hash === 'audio-recording';
  const isVideoRecording = hash === 'video-recording';

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

  // Render different content based on window type
  if (isClipboardHistory) {
    return (
      <div className="app">
        <ClipboardHistoryPanel 
          isOpen={true} 
          onClose={() => window.electronAPI.hide()} 
          variant="window"
        />
      </div>
    );
  }

  if (isVoiceRecording) {
    return (
      <div className="app">
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Voice Recording Window (Coming Soon)
          </p>
        </div>
      </div>
    );
  }

  if (isAudioRecording) {
    return (
      <div className="app">
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Audio Recording Window (Coming Soon)
          </p>
        </div>
      </div>
    );
  }

  if (isVideoRecording) {
    return (
      <div className="app">
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg">
          <p className="text-sm text-dark-600 dark:text-dark-400">
            Video Recording Window (Coming Soon)
          </p>
        </div>
      </div>
    );
  }

  if (isChatPanel) {
    return (
      <div className="app">
        <ChatPanel
          isOpen={true}
          onClose={() => window.electronAPI.hide()}
          variant="window"
        />
      </div>
    );
  }

  if (isOSD) {
    return <OSDOverlay />;
  }

  // Default: Main command palette
  return (
    <div className="app">
      <CommandPalette />
      <TimerWidgets />
      <ToastContainer />
    </div>
  );
}

export default App;
