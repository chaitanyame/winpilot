// Notes data access layer - backed by SQLite

import { getDatabase } from './database';
import type { Note } from '../shared/types';

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createNote(title: string, content?: string): Note {
  const db = getDatabase();
  const id = generateId();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, content || '', now, now);

  return { id, title, content: content || '', created_at: now, updated_at: now };
}

export function getNote(id: string): Note | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  const row = stmt.get(id) as Note | undefined;
  return row || null;
}

export function listNotes(limit?: number): Note[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC LIMIT ?');
  return stmt.all(limit || 50) as Note[];
}

export function updateNote(id: string, title?: string, content?: string): Note | null {
  const db = getDatabase();
  const existing = getNote(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title : existing.title;
  const newContent = content !== undefined ? content : existing.content;
  const now = Date.now();

  const stmt = db.prepare(`
    UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(newTitle, newContent, now, id);

  return { id, title: newTitle, content: newContent, created_at: existing.created_at, updated_at: now };
}

export function deleteNote(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function deleteAllNotes(): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM notes');
  const result = stmt.run();
  return result.changes;
}

export function searchNotes(query: string, limit?: number): Note[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);
  const searchQuery = `%${query}%`;
  return stmt.all(searchQuery, searchQuery, limit || 10) as Note[];
}
