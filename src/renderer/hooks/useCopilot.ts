import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message } from '../../shared/types';
import { generateId } from '../../shared/utils';

interface UseCopilotReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  cancelMessage: () => void;
  clearMessages: () => Promise<void>;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
}

export function useCopilot(): UseCopilotReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentAssistantMessageRef = useRef<string>('');
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RESPONSE_TIMEOUT_MS = 90000;

  const clearResponseTimeout = useCallback(() => {
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }, []);

  const armResponseTimeout = useCallback(() => {
    clearResponseTimeout();
    responseTimeoutRef.current = setTimeout(() => {
      window.electronAPI.cancelMessage();
      setIsLoading(false);
      setError('Request timed out. Please try again.');
    }, RESPONSE_TIMEOUT_MS);
  }, [clearResponseTimeout]);

  // Setup stream listeners
  useEffect(() => {
    const unsubscribeChunk = window.electronAPI.onStreamChunk((chunk: string) => {
      currentAssistantMessageRef.current += chunk;
      armResponseTimeout();
      
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'assistant') {
          // Update existing assistant message
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: currentAssistantMessageRef.current },
          ];
        } else {
          // Create new assistant message
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: currentAssistantMessageRef.current,
            timestamp: new Date(),
          };
          const newMessages = [
            ...prev,
            assistantMessage,
          ];
          // Keep only last 50 messages
          return newMessages.length > 50 ? newMessages.slice(-50) : newMessages;
        }
      });
    });

    const unsubscribeEnd = window.electronAPI.onStreamEnd((data) => {
      clearResponseTimeout();
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
  }, [armResponseTimeout, clearResponseTimeout]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    currentAssistantMessageRef.current = '';
    armResponseTimeout();

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => {
      // Keep only last 50 messages to prevent performance degradation
      const updated = [...prev, userMessage];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });

    window.electronAPI.sendMessage(content).catch((err) => {
      clearResponseTimeout();
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    });
  }, [armResponseTimeout, clearResponseTimeout, isLoading]);

  const cancelMessage = useCallback(() => {
    clearResponseTimeout();
    window.electronAPI.cancelMessage();
    setIsLoading(false);
    currentAssistantMessageRef.current = '';
  }, [clearResponseTimeout]);

  const clearMessages = useCallback(async () => {
    clearResponseTimeout();
    setMessages([]);
    setError(null);
    // Also clear the server-side Copilot session to start fresh
    try {
      await window.electronAPI.clearSession();
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, [clearResponseTimeout]);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const fullMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    setMessages((prev) => {
      const updated = [...prev, fullMessage];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
    addMessage,
  };
}
