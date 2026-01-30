// SQLite Database for Desktop Commander
// Stores chat history and conversation data

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';

// Database file path
function getDatabasePath(): string {
  if (app) {
    return path.join(app.getPath('userData'), 'desktop-commander.db');
  }
  // Fallback for tests
  return path.join(os.homedir(), '.desktop-commander', 'desktop-commander.db');
}

// Database instance
let db: Database.Database | null = null;

/**
 * Initialize the database
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  createTables();

  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Create database tables
 */
function createTables(): void {
  const database = getDatabase();

  // Conversations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  // Tool executions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      parameters TEXT,
      result TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_tool_executions_message ON tool_executions(message_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
  `);

  // Settings table for storing app state
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

// ============================================================================
// Conversation Operations
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: string;
  created_at: number;
}

export interface ToolExecution {
  id: string;
  message_id: string;
  tool_name: string;
  parameters?: string;
  result?: string;
  success: boolean;
  error?: string;
  created_at: number;
}

/**
 * Create a new conversation
 */
export function createConversation(title?: string): Conversation {
  const database = getDatabase();

  const conversation: Conversation = {
    id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: title || 'New Conversation',
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const stmt = database.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(conversation.id, conversation.title, conversation.created_at, conversation.updated_at);

  return conversation;
}

/**
 * Get all conversations
 */
export function getConversations(limit?: number): Conversation[] {
  const database = getDatabase();

  let query = 'SELECT * FROM conversations ORDER BY updated_at DESC';
  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const stmt = database.prepare(query);
  return stmt.all() as Conversation[];
}

/**
 * Get a conversation by ID
 */
export function getConversation(id: string): Conversation | null {
  const database = getDatabase();

  const stmt = database.prepare('SELECT * FROM conversations WHERE id = ?');
  const result = stmt.get(id) as Conversation | undefined;

  return result || null;
}

/**
 * Update conversation title
 */
export function updateConversationTitle(id: string, title: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE conversations
    SET title = ?, updated_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(title, Date.now(), id);
  return result.changes > 0;
}

/**
 * Delete a conversation
 */
export function deleteConversation(id: string): boolean {
  const database = getDatabase();

  const stmt = database.prepare('DELETE FROM conversations WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

/**
 * Add a message to a conversation
 */
export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  toolCalls?: string
): Message {
  const database = getDatabase();

  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls,
    created_at: Date.now(),
  };

  const stmt = database.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(message.id, message.conversation_id, message.role, message.content, message.tool_calls || null, message.created_at);

  // Update conversation timestamp
  updateConversationTimestamp(conversationId);

  return message;
}

/**
 * Get messages for a conversation
 */
export function getMessages(conversationId: string, limit?: number): Message[] {
  const database = getDatabase();

  let query = 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC';
  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  const stmt = database.prepare(query);
  return stmt.all(conversationId) as Message[];
}

/**
 * Update conversation timestamp
 */
function updateConversationTimestamp(conversationId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    UPDATE conversations
    SET updated_at = ?
    WHERE id = ?
  `);

  stmt.run(Date.now(), conversationId);
}

/**
 * Record a tool execution
 */
export function addToolExecution(
  messageId: string,
  toolName: string,
  parameters?: Record<string, unknown>,
  result?: unknown,
  success?: boolean,
  error?: string
): ToolExecution {
  const database = getDatabase();

  const toolExecution: ToolExecution = {
    id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    message_id: messageId,
    tool_name: toolName,
    parameters: parameters ? JSON.stringify(parameters) : undefined,
    result: result !== undefined ? JSON.stringify(result) : undefined,
    success: success ?? false,
    error,
    created_at: Date.now(),
  };

  const stmt = database.prepare(`
    INSERT INTO tool_executions (id, message_id, tool_name, parameters, result, success, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    toolExecution.id,
    toolExecution.message_id,
    toolExecution.tool_name,
    toolExecution.parameters || null,
    toolExecution.result || null,
    toolExecution.success ? 1 : 0,
    toolExecution.error || null,
    toolExecution.created_at
  );

  return toolExecution;
}

/**
 * Get tool executions for a message
 */
export function getToolExecutions(messageId: string): ToolExecution[] {
  const database = getDatabase();

  const stmt = database.prepare('SELECT * FROM tool_executions WHERE message_id = ? ORDER BY created_at ASC');
  return stmt.all(messageId) as ToolExecution[];
}

/**
 * Search conversations
 */
export function searchConversations(query: string): Conversation[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT DISTINCT c.*
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.title LIKE ?
       OR m.content LIKE ?
    ORDER BY c.updated_at DESC
  `);

  const searchQuery = `%${query}%`;
  return stmt.all(searchQuery, searchQuery) as Conversation[];
}

/**
 * Get conversation statistics
 */
export function getConversationStats(): {
  totalConversations: number;
  totalMessages: number;
  totalToolExecutions: number;
} {
  const database = getDatabase();

  const convStmt = database.prepare('SELECT COUNT(*) as count FROM conversations');
  const msgStmt = database.prepare('SELECT COUNT(*) as count FROM messages');
  const toolStmt = database.prepare('SELECT COUNT(*) as count FROM tool_executions');

  const convResult = convStmt.get() as { count: number };
  const msgResult = msgStmt.get() as { count: number };
  const toolResult = toolStmt.get() as { count: number };

  return {
    totalConversations: convResult.count,
    totalMessages: msgResult.count,
    totalToolExecutions: toolResult.count,
  };
}

/**
 * Clean up old data
 */
export function cleanupOldData(daysToKeep: number = 30): void {
  const database = getDatabase();
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

  // Delete old conversations
  const stmt = database.prepare('DELETE FROM conversations WHERE created_at < ? AND updated_at < ?');
  stmt.run(cutoffTime, cutoffTime);

  // Vacuum to reclaim space
  database.exec('VACUUM');
}

/**
 * Close the database
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
