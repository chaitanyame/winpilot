import React from 'react';
import ReactDOM from 'react-dom/client';
import VoiceToClipboardWindow from './VoiceToClipboardWindow';
import '../styles/globals.css'; // Reuse main app styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VoiceToClipboardWindow />
  </React.StrictMode>,
);
