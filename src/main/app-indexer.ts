import { getUnifiedAdapter } from '../platform/unified-adapter';
import { getInstalledAppsCache, getAppIndexMeta, replaceInstalledAppsCache, setAppIndexMeta } from './database';
import { logger } from '../utils/logger';

const INDEX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LAST_INDEXED_KEY = 'last_indexed_at';

function normalizeAppName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function uniqueApps(apps: Array<{ name: string; path?: string }>): Array<{ name: string; path?: string }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; path?: string }> = [];
  for (const app of apps) {
    const normalized = normalizeAppName(app.name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(app);
  }
  return result;
}

export async function ensureInstalledAppsCache(): Promise<void> {
  const lastIndexedRaw = getAppIndexMeta(LAST_INDEXED_KEY);
  const lastIndexed = lastIndexedRaw ? Number(lastIndexedRaw) : 0;
  const now = Date.now();

  if (lastIndexed && now - lastIndexed < INDEX_INTERVAL_MS) {
    return;
  }

  const adapter = getUnifiedAdapter();
  const apps = await adapter.listApps({ filter: 'installed' });
  if (!apps.success) {
    logger.warn('Apps', 'Failed to index installed apps', apps.error);
    return;
  }

  const normalizedApps = uniqueApps((apps.data || []).map(app => ({
    name: app.name,
    path: app.path,
  }))).map(app => ({
    name: app.name,
    normalizedName: normalizeAppName(app.name),
    path: app.path || '',
    source: 'registry',
  }));

  replaceInstalledAppsCache(normalizedApps);
  setAppIndexMeta(LAST_INDEXED_KEY, String(now));
  logger.platform('Installed apps cache updated', { count: normalizedApps.length });
}

export function getCachedInstalledApps(): Array<{ name: string; normalizedName: string; path: string; source: string }> {
  const cached = getInstalledAppsCache();
  return cached.map(app => ({
    name: app.name,
    normalizedName: app.normalizedName,
    path: app.path,
    source: app.source,
  }));
}

export function findInstalledAppByName(query: string): { name: string; normalizedName: string; path: string } | null {
  const normalizedQuery = normalizeAppName(query);
  if (!normalizedQuery) return null;

  const cached = getCachedInstalledApps();
  const exact = cached.find(app => app.normalizedName === normalizedQuery);
  if (exact) return exact;

  const contains = cached.find(app => app.normalizedName.includes(normalizedQuery));
  return contains || null;
}
