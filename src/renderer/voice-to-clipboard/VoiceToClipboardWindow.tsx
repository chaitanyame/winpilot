import React, { useEffect, useState, useRef } from 'react';
import { Mic, Loader2, CheckCircle, XCircle } from 'lucide-react';

type WindowState = 'listening' | 'transcribing' | 'done' | 'error';

interface VoiceToClipboardWindowProps {}

const AudioWaves: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1 bg-blue-500 rounded-full transition-all duration-300 ${
            isActive ? 'wave-animate' : 'h-2'
          }`}
          style={{
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
};

const VoiceToClipboardWindow: React.FC<VoiceToClipboardWindowProps> = () => {
  const [state, setState] = useState<WindowState>('listening');
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Start recording on mount
  useEffect(() => {
    startRecording();

    // Listen for stop command from main process
    const unsubscribe = window.electronAPI?.onVoiceToClipboardStop?.(() => {
      stopRecording();
    });

    return () => {
      unsubscribe?.();
      cleanupMediaStream();
    };
  }, []);

  // Keyboard handlers - separate effect so it updates with state changes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close();
      } else if (e.key === 'Enter' && state === 'done' && transcribedText) {
        handlePaste();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state, transcribedText]);

  const startRecording = async () => {
    try {
      console.log('[VoiceToClipboard] Starting recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      // Request data every 1000ms instead of 100ms for better chunk sizes
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      
      setState('listening');
      console.log('[VoiceToClipboard] Recording started');
    } catch (err) {
      console.error('[VoiceToClipboard] Failed to start recording:', err);
      setError('Failed to access microphone');
      setState('error');
    }
  };

  const stopRecording = async () => {
    try {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        return;
      }
      
      console.log('[VoiceToClipboard] Stopping recording...');
      setState('transcribing');
      
      await new Promise<void>((resolve) => {
        mediaRecorderRef.current!.onstop = () => resolve();
        mediaRecorderRef.current!.stop();
      });
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      console.log('[VoiceToClipboard] Audio chunks:', audioChunksRef.current.length);
      console.log('[VoiceToClipboard] Audio blob size:', audioBlob.size, 'bytes');
      console.log('[VoiceToClipboard] Sending for transcription...');
      
      const result = await window.electronAPI.voiceToClipboardTranscribe({
        audio: arrayBuffer,
        mimeType: 'audio/webm',
        language: 'en',
      });
      
      cleanupMediaStream();
      
      if (result.success && result.transcript) {
        setTranscribedText(result.transcript);
        setState('done');
      } else {
        setError(result.error || 'Transcription failed');
        setState('error');
      }
    } catch (err) {
      console.error('[VoiceToClipboard] Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setState('error');
      cleanupMediaStream();
    }
  };

  const cleanupMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
  };

  const handlePaste = async () => {
    if (!transcribedText) {
      console.log('[VoiceToClipboard] No text to paste');
      return;
    }

    try {
      console.log('[VoiceToClipboard] Pasting text:', transcribedText);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(transcribedText);
      console.log('[VoiceToClipboard] Text copied to clipboard');
      
      // Notify main process to paste
      const result = await window.electronAPI.voiceToClipboardPaste();
      console.log('[VoiceToClipboard] Paste result:', result);
      
      // Close window
      setTimeout(() => window.close(), 300);
    } catch (err) {
      console.error('[VoiceToClipboard] Failed to paste:', err);
      setError('Failed to paste text');
      setState('error');
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="w-full max-w-lg">
        {/* Listening State */}
        {state === 'listening' && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="flex justify-center">
              <div className="relative">
                <Mic className="w-16 h-16 text-blue-500" />
                <div className="absolute inset-0 animate-ping">
                  <Mic className="w-16 h-16 text-blue-500 opacity-75" />
                </div>
              </div>
            </div>
            
            <h2 className="text-2xl font-semibold text-white">
              Listening...
            </h2>
            
            <AudioWaves isActive={true} />
            
            <p className="text-sm text-gray-400">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+Shift+W</kbd> to stop
            </p>
          </div>
        )}

        {/* Transcribing State */}
        {state === 'transcribing' && (
          <div className="text-center space-y-6 animate-fade-in">
            <Loader2 className="w-16 h-16 text-yellow-500 animate-spin mx-auto" />
            <h2 className="text-2xl font-semibold text-white">
              Transcribing...
            </h2>
            <p className="text-sm text-gray-400">
              Please wait while we process your voice
            </p>
          </div>
        )}

        {/* Done State */}
        {state === 'done' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-center gap-2 text-green-500">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Transcription Complete</h2>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 min-h-[100px]">
              <p className="text-white whitespace-pre-wrap">{transcribedText}</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePaste}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                Press <kbd className="px-2 py-1 bg-blue-700 rounded text-xs">Enter</kbd> to Paste
              </button>
              
              <p className="text-xs text-center text-gray-400">
                Press <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Esc</kbd> to cancel
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="text-center space-y-6 animate-fade-in">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-semibold text-white">
              Error
            </h2>
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceToClipboardWindow;