import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, ToolCall } from '../../shared/types';
import { generateId } from '../../shared/utils';

interface UseCopilotReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  cancelMessage: () => void;
  clearMessages: () => Promise<void>;
}

export function useCopilot(): UseCopilotReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentAssistantMessageRef = useRef<string>('');

  // Setup stream listeners
  useEffect(() => {
    const unsubscribeChunk = window.electronAPI.onStreamChunk((chunk: string) => {
      currentAssistantMessageRef.current += chunk;
      
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: currentAssistantMessageRef.current },
          ];
        } else {
          // Create new assistant message
          return [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: currentAssistantMessageRef.current,
              timestamp: new Date(),
            },
          ];
        }
      });
    });

    const unsubscribeEnd = window.electronAPI.onStreamEnd((data) => {
      setIsLoading(false);
      currentAssistantMessageRef.current = '';
      
      if (data?.error) {
        setError(data.error);
      }
    });

    return () => {
      unsubscribeChunk();
      unsubscribeEnd();
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    currentAssistantMessageRef.current = '';

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      await window.electronAPI.sendMessage(content);
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [isLoading]);

  const cancelMessage = useCallback(() => {
    window.electronAPI.cancelMessage();
    setIsLoading(false);
    currentAssistantMessageRef.current = '';
  }, []);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setError(null);
    // Also clear the server-side Copilot session to start fresh
    try {
      await window.electronAPI.clearSession();
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
  };
}
