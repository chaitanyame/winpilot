// Todos data access layer - backed by SQLite

import { getDatabase } from './database';
import type { Todo } from '../shared/types';

function generateId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createTodo(text: string): Todo {
  const db = getDatabase();
  const id = generateId();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO todos (id, text, completed, created_at, updated_at)
    VALUES (?, ?, 0, ?, ?)
  `);
  stmt.run(id, text, now, now);

  return { id, text, completed: false, created_at: now, updated_at: now };
}

export function listTodos(filter?: 'all' | 'active' | 'completed'): Todo[] {
  const db = getDatabase();
  let query = 'SELECT * FROM todos';

  if (filter === 'active') {
    query += ' WHERE completed = 0';
  } else if (filter === 'completed') {
    query += ' WHERE completed = 1';
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all() as Array<{ id: string; text: string; completed: number; created_at: number; updated_at: number }>;

  return rows.map(row => ({
    ...row,
    completed: row.completed === 1,
  }));
}

export function completeTodo(id: string): Todo | null {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare('UPDATE todos SET completed = 1, updated_at = ? WHERE id = ?');
  const result = stmt.run(now, id);
  if (result.changes === 0) return null;

  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as { id: string; text: string; completed: number; created_at: number; updated_at: number } | undefined;
  if (!row) return null;

  return { ...row, completed: row.completed === 1 };
}

export function uncompleteTodo(id: string): Todo | null {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare('UPDATE todos SET completed = 0, updated_at = ? WHERE id = ?');
  const result = stmt.run(now, id);
  if (result.changes === 0) return null;

  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as { id: string; text: string; completed: number; created_at: number; updated_at: number } | undefined;
  if (!row) return null;

  return { ...row, completed: row.completed === 1 };
}

export function deleteTodo(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function deleteCompletedTodos(): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM todos WHERE completed = 1');
  const result = stmt.run();
  return result.changes;
}
