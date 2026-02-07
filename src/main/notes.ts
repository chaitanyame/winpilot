// Notes Manager
// CRUD operations for persistent notes

import { getDatabase } from './database';
import { randomBytes } from 'crypto';

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

/**
 * Generate a unique note ID
 */
function generateNoteId(): string {
  return `note-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Create a new note
 */
export function createNote(title: string, content?: string): Note {
  const db = getDatabase();
  const id = generateNoteId();
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, title, content || '', now, now);

  return {
    id,
    title,
    content: content || '',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a note by ID
 */
export function getNote(id: string): Note | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  const row = stmt.get(id) as Note | undefined;
  return row || null;
}

/**
 * List all notes, ordered by updated_at DESC
 */
export function listNotes(limit?: number): Note[] {
  const db = getDatabase();
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const stmt = db.prepare(`
    SELECT * FROM notes
    ORDER BY updated_at DESC
    ${limitClause}
  `);
  return stmt.all() as Note[];
}

/**
 * Update a note's title and/or content
 */
export function updateNote(id: string, title?: string, content?: string): Note | null {
  const db = getDatabase();
  const existing = getNote(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title : existing.title;
  const newContent = content !== undefined ? content : existing.content;
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    UPDATE notes
    SET title = ?, content = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(newTitle, newContent, now, id);

  return {
    id,
    title: newTitle,
    content: newContent,
    created_at: existing.created_at,
    updated_at: now,
  };
}

/**
 * Delete a note by ID
 */
export function deleteNote(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Delete all notes
 */
export function deleteAllNotes(): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM notes');
  const result = stmt.run();
  return result.changes;
}

/**
 * Search notes by title or content
 */
export function searchNotes(query: string, limit?: number): Note[] {
  const db = getDatabase();
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const searchPattern = `%${query}%`;

  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE title LIKE ? OR content LIKE ?
    ORDER BY updated_at DESC
    ${limitClause}
  `);

  return stmt.all(searchPattern, searchPattern) as Note[];
}
