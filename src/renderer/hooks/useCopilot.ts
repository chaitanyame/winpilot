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
  loadConversation: (conversationId: string | null) => Promise<void>;
}

export function useCopilot(): UseCopilotReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentAssistantMessageRef = useRef<string>('');
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RESPONSE_TIMEOUT_MS = 180000;

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

  // Batched stream rendering: accumulate chunks and flush at ~60fps via RAF
  const rafIdRef = useRef<number | null>(null);
  const pendingFlushRef = useRef(false);

  const flushStreamToState = useCallback(() => {
    pendingFlushRef.current = false;
    rafIdRef.current = null;
    const content = currentAssistantMessageRef.current;
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === 'assistant') {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content },
        ];
      } else {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content,
          timestamp: new Date(),
        };
        const newMessages = [...prev, assistantMessage];
        return newMessages.length > 50 ? newMessages.slice(-50) : newMessages;
      }
    });
  }, []);

  // Setup stream listeners
  useEffect(() => {
    const unsubscribeChunk = window.electronAPI.onStreamChunk((chunk: string) => {
      currentAssistantMessageRef.current += chunk;
      armResponseTimeout();

      // Schedule a state flush on next animation frame (batches rapid chunks)
      if (!pendingFlushRef.current) {
        pendingFlushRef.current = true;
        rafIdRef.current = requestAnimationFrame(flushStreamToState);
      }
    });

    const unsubscribeEnd = window.electronAPI.onStreamEnd((data) => {
      // Flush any remaining batched content before ending
      if (pendingFlushRef.current && rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        flushStreamToState();
      }
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [armResponseTimeout, clearResponseTimeout, flushStreamToState]);

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

  const loadConversation = useCallback(async (conversationId: string | null) => {
    clearResponseTimeout();
    setIsLoading(false);
    setError(null);
    currentAssistantMessageRef.current = '';
    try {
      const data = await window.electronAPI.chatGetHistory(conversationId ?? undefined) as Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        tool_calls?: string | null;
        created_at: number;
      }>;
      const mapped = (data || [])
        .sort((a, b) => a.created_at - b.created_at)
        .map((item) => {
          let toolCalls: Message['toolCalls'] | undefined;
          if (item.tool_calls) {
            try {
              const parsed = JSON.parse(item.tool_calls);
              if (Array.isArray(parsed)) {
                toolCalls = parsed;
              }
            } catch {
              toolCalls = undefined;
            }
          }
          return {
            id: item.id,
            role: item.role,
            content: item.content,
            timestamp: new Date(item.created_at),
            toolCalls,
          } satisfies Message;
        });
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load conversation history:', err);
      setError('Failed to load conversation history');
    }
  }, [clearResponseTimeout]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelMessage,
    clearMessages,
    loadConversation,
  };
}
