import { getDatabase } from './database';
import type { HiddenWindow } from '../shared/types';
import { logger } from '../utils/logger';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hidden_windows (
    hwnd TEXT PRIMARY KEY,
    pid INTEGER NOT NULL,
    title TEXT,
    app_name TEXT,
    hidden_at INTEGER NOT NULL
  );
`;

export class ScreenSharePrivacyService {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    const db = getDatabase();
    db.exec(CREATE_TABLE_SQL);
    this.initialized = true;
  }

  addHiddenWindow(entry: HiddenWindow): void {
    this.init();
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO hidden_windows (hwnd, pid, title, app_name, hidden_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(hwnd) DO UPDATE SET
        pid = excluded.pid,
        title = excluded.title,
        app_name = excluded.app_name,
        hidden_at = excluded.hidden_at
    `);
    stmt.run(entry.hwnd, entry.pid, entry.title, entry.appName, entry.hiddenAt);
  }

  removeHiddenWindow(hwnd: string): void {
    this.init();
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM hidden_windows WHERE hwnd = ?');
    stmt.run(hwnd);
  }

  removeHiddenWindowsByPid(pid: number): void {
    this.init();
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM hidden_windows WHERE pid = ?');
    stmt.run(pid);
  }

  listHiddenWindows(): HiddenWindow[] {
    this.init();
    const db = getDatabase();
    const stmt = db.prepare('SELECT hwnd, pid, title, app_name, hidden_at FROM hidden_windows ORDER BY hidden_at DESC');
    const rows = stmt.all() as Array<{ hwnd: string; pid: number; title: string; app_name: string; hidden_at: number }>;
    return rows.map(row => ({
      hwnd: row.hwnd,
      pid: row.pid,
      title: row.title || '',
      appName: row.app_name || '',
      hiddenAt: row.hidden_at,
    }));
  }

  clear(): void {
    this.init();
    const db = getDatabase();
    db.exec('DELETE FROM hidden_windows');
  }

  cleanupStaleEntries(activeHwnds: Set<string>): void {
    this.init();
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT hwnd FROM hidden_windows').all() as Array<{ hwnd: string }>;
      const deleteStmt = db.prepare('DELETE FROM hidden_windows WHERE hwnd = ?');
      for (const row of rows) {
        if (!activeHwnds.has(row.hwnd)) {
          deleteStmt.run(row.hwnd);
        }
      }
    } catch (error) {
      logger.error('ScreenSharePrivacy', 'Failed to cleanup stale entries', error);
    }
  }
}

export const screenSharePrivacyService = new ScreenSharePrivacyService();
