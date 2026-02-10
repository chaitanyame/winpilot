import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { ensureSkillDirectories } from './skills';

export type SkillSource = 'builtin' | 'user';

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  license?: string;
  triggers?: string[];
  path: string;
  skillMdPath: string;
  source: SkillSource;
}

type SkillFrontmatter = Record<string, string | string[]>;

let cachedSkills: SkillMetadata[] = [];
let cachedById = new Map<string, SkillMetadata>();
let watchers: fs.FSWatcher[] = [];
let refreshTimer: NodeJS.Timeout | null = null;

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function parseFrontmatter(frontmatter: string): SkillFrontmatter {
  const data: SkillFrontmatter = {};
  let currentKey: string | null = null;

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed);
    if (keyMatch) {
      const key = keyMatch[1];
      const rawValue = keyMatch[2];
      if (rawValue === '') {
        data[key] = [];
        currentKey = key;
        continue;
      }
      data[key] = stripQuotes(rawValue);
      currentKey = null;
      continue;
    }

    if (currentKey && trimmed.startsWith('-')) {
      const entry = stripQuotes(trimmed.slice(1).trim());
      const list = data[currentKey];
      if (Array.isArray(list)) {
        list.push(entry);
      }
    }
  }

  return data;
}

function parseSkillFile(contents: string): { frontmatter: SkillFrontmatter; body: string } | null {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/m.exec(contents);
  if (!match) {
    return null;
  }

  const frontmatter = parseFrontmatter(match[1]);
  return { frontmatter, body: match[2] };
}

function loadSkillMetadata(skillDir: string, source: SkillSource): SkillMetadata | null {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  const contents = fs.readFileSync(skillMdPath, 'utf8');
  const parsed = parseSkillFile(contents);
  if (!parsed) {
    logger.warn('Skills', 'SKILL.md missing YAML frontmatter', { skillMdPath });
    return null;
  }

  const name = typeof parsed.frontmatter.name === 'string' ? parsed.frontmatter.name.trim() : '';
  const description = typeof parsed.frontmatter.description === 'string' ? parsed.frontmatter.description.trim() : '';
  if (!name || !description) {
    logger.warn('Skills', 'SKILL.md missing required fields', { skillMdPath });
    return null;
  }

  const license = typeof parsed.frontmatter.license === 'string'
    ? parsed.frontmatter.license.trim()
    : undefined;

  const triggers = Array.isArray(parsed.frontmatter.triggers)
    ? parsed.frontmatter.triggers.filter(value => Boolean(value)).map(value => value.trim())
    : undefined;

  return {
    id: name,
    name,
    description,
    license,
    triggers,
    path: skillDir,
    skillMdPath,
    source,
  };
}

function scanSkillDirectory(root: string, source: SkillSource): SkillMetadata[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const skills: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(root, entry.name);
    const metadata = loadSkillMetadata(skillDir, source);
    if (metadata) {
      skills.push(metadata);
    }
  }

  return skills;
}

export function refreshSkillIndex(): SkillMetadata[] {
  const { builtIn, userPaths } = ensureSkillDirectories();

  const builtInSkills = scanSkillDirectory(builtIn, 'builtin');
  const userSkills = userPaths.flatMap(userPath => scanSkillDirectory(userPath, 'user'));

  const merged = new Map<string, SkillMetadata>();
  for (const skill of builtInSkills) {
    merged.set(skill.id, skill);
  }
  for (const skill of userSkills) {
    merged.set(skill.id, skill);
  }

  cachedSkills = Array.from(merged.values());
  cachedById = merged;
  logger.copilot('Skill index refreshed', { count: cachedSkills.length });

  return cachedSkills;
}

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(() => {
    refreshSkillIndex();
  }, 500);
}

export function startSkillWatcher(): void {
  if (watchers.length > 0) return;
  const { userPaths } = ensureSkillDirectories();

  try {
    watchers = userPaths.map(userPath => fs.watch(userPath, { recursive: true }, () => {
      scheduleRefresh();
    }));
    logger.copilot('Skill watcher started', { userPaths });
  } catch (error) {
    logger.error('Skills', 'Failed to start skill watcher', error);
  }
}

export function stopSkillWatcher(): void {
  if (watchers.length > 0) {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export function getSkillIndex(): SkillMetadata[] {
  return cachedSkills;
}

export function getSkillById(id: string): SkillMetadata | null {
  return cachedById.get(id) || null;
}

export function getSkillInstructions(id: string): string | null {
  const skill = getSkillById(id);
  if (!skill) {
    return null;
  }
  const contents = fs.readFileSync(skill.skillMdPath, 'utf8');
  const parsed = parseSkillFile(contents);
  if (!parsed) {
    logger.warn('Skills', 'SKILL.md missing YAML frontmatter', { skillMdPath: skill.skillMdPath });
    return null;
  }
  return parsed.body.trim();
}
