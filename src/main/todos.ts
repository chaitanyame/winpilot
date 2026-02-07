// Todos Manager
// CRUD operations for persistent todos

import { getDatabase } from './database';
import { randomBytes } from 'crypto';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Generate a unique todo ID
 */
function generateTodoId(): string {
  return `todo-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Create a new todo
 */
export function createTodo(text: string): Todo {
  const db = getDatabase();
  const id = generateTodoId();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO todos (id, text, completed, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?)
  `);

  stmt.run(id, text, now, now);

  return {
    id,
    text,
    completed: false,
    created_at: now,
    updated_at: now,
  };
}

/**
 * List todos, optionally filtered by status
 */
export function listTodos(filter?: 'all' | 'active' | 'completed'): Todo[] {
  const db = getDatabase();

  let whereClause = '';
  if (filter === 'active') {
    whereClause = 'WHERE completed = 0';
  } else if (filter === 'completed') {
    whereClause = 'WHERE completed = 1';
  }

  const stmt = db.prepare(`
    SELECT * FROM todos
    ${whereClause}
    ORDER BY created_at DESC
  `);

  const rows = stmt.all() as Array<{
    id: string;
    text: string;
    completed: number;
    created_at: number;
    updated_at: number;
  }>;

  return rows.map(row => ({
    ...row,
    completed: row.completed === 1,
  }));
}

/**
 * Mark a todo as completed
 */
export function completeTodo(id: string): Todo | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE todos
    SET completed = 1, updated_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(now, id);
  if (result.changes === 0) return null;

  const selectStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
  const row = selectStmt.get(id) as {
    id: string;
    text: string;
    completed: number;
    created_at: number;
    updated_at: number;
  } | undefined;

  if (!row) return null;

  return {
    ...row,
    completed: row.completed === 1,
  };
}

/**
 * Mark a todo as not completed
 */
export function uncompleteTodo(id: string): Todo | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE todos
    SET completed = 0, updated_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(now, id);
  if (result.changes === 0) return null;

  const selectStmt = db.prepare('SELECT * FROM todos WHERE id = ?');
  const row = selectStmt.get(id) as {
    id: string;
    text: string;
    completed: number;
    created_at: number;
    updated_at: number;
  } | undefined;

  if (!row) return null;

  return {
    ...row,
    completed: row.completed === 1,
  };
}

/**
 * Delete a todo by ID
 */
export function deleteTodo(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Delete all completed todos
 */
export function deleteCompletedTodos(): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM todos WHERE completed = 1');
  const result = stmt.run();
  return result.changes;
}
