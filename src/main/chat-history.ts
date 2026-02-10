// Chat History Manager using SQLite
// Stores conversations and messages for Desktop Commander

import * as Database from './database';

// Active conversation ID for the current session
let activeConversationId: string | null = null;

/**
 * Initialize a new chat session
 */
export function startChatSession(title?: string): string {
  const conversation = Database.createConversation(title);
  activeConversationId = conversation.id;
  return conversation.id;
}

/**
 * Get the active conversation ID
 */
export function getActiveConversationId(): string | null {
  return activeConversationId;
}

/**
 * Set the active conversation ID
 */
export function setActiveConversationId(id: string): void {
  activeConversationId = id;
}

/**
 * Save a user message
 */
export function saveUserMessage(content: string): string {
  if (!activeConversationId) {
    startChatSession();
  }

  const message = Database.addMessage(
    activeConversationId!,
    'user',
    content
  );

  return message.id;
}

/**
 * Save an assistant message
 */
export function saveAssistantMessage(content: string, toolCalls?: string): string {
  if (!activeConversationId) {
    startChatSession();
  }

  const message = Database.addMessage(
    activeConversationId!,
    'assistant',
    content,
    toolCalls
  );

  return message.id;
}

/**
 * Record a tool execution
 */
export function recordToolExecution(
  messageId: string,
  toolName: string,
  parameters?: Record<string, unknown>,
  result?: unknown,
  success?: boolean,
  error?: string
): void {
  Database.addToolExecution(messageId, toolName, parameters, result, success, error);
}

/**
 * Get conversation history
 */
export function getConversationHistory(conversationId?: string): Database.Message[] {
  const targetId = conversationId || activeConversationId;
  if (!targetId) return [];

  return Database.getMessages(targetId);
}

/**
 * Get all conversations
 */
export function getAllConversations(): Database.Conversation[] {
  return Database.getConversations();
}

/**
 * Search conversations
 */
export function searchConversations(query: string): Database.Conversation[] {
  return Database.searchConversations(query);
}

/**
 * Load a conversation
 */
export function loadConversation(id: string): Database.Conversation | null {
  const conversation = Database.getConversation(id);
  if (conversation) {
    activeConversationId = id;
  }
  return conversation;
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): boolean {
  if (activeConversationId === id) {
    activeConversationId = null;
  }
  return Database.deleteConversation(id);
}

/**
 * Get chat statistics
 */
export function getChatStatistics() {
  return Database.getConversationStats();
}
