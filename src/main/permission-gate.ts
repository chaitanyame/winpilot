import type { WebContents } from 'electron';
import { IPC_CHANNELS, PermissionLevel, type PermissionRequest, type PermissionResponse, type Settings } from '../shared/types';
import { getSavedPermission, getSettings, savePermission } from './store';

export interface PermissionDecision {
  allowed: boolean;
  options?: Record<string, unknown>;
}

const pending = new Map<string, (decision: PermissionDecision) => void>();

let activeWebContents: WebContents | null = null;

export function setActiveWebContents(contents: WebContents | null): void {
  activeWebContents = contents;
}

export function cancelAllPendingPermissions(): void {
  for (const [id, resolve] of pending.entries()) {
    pending.delete(id);
    resolve({ allowed: false });
  }
}

export function handlePermissionResponse(response: PermissionResponse): void {
  const resolve = pending.get(response.id);
  if (!resolve) return;
  pending.delete(response.id);
  resolve({ allowed: response.allowed, options: response.options });
}

function generateId(): string {
  return `perm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeToolNameForPermissions(toolName: string): string {
  // Convert snake_case tool names to dot.case used by settings.
  // Example: files_delete -> files.delete
  return toolName.replace(/_/g, '.');
}

export function getPermissionLevelForTool(toolName: string): PermissionLevel {
  const normalized = normalizeToolNameForPermissions(toolName);

  // Hard-coded conservative mapping for alpha.
  if (normalized === 'files.delete' || normalized === 'process.kill' || normalized === 'system.sleep' || normalized === 'system.lock') {
    return PermissionLevel.DANGEROUS;
  }

  if (
    normalized === 'files.move' ||
    normalized === 'files.copy' ||
    normalized === 'files.rename' ||
    normalized === 'files.write' ||
    normalized === 'files.create.folder' ||
    normalized === 'apps.quit' ||
    normalized === 'window.close'
  ) {
    return PermissionLevel.SENSITIVE;
  }

  if (
    normalized.startsWith('window.') && normalized !== 'window.list'
  ) {
    return PermissionLevel.STANDARD;
  }

  if (
    normalized.startsWith('apps.') && (normalized === 'apps.launch' || normalized === 'apps.switch')
  ) {
    return PermissionLevel.STANDARD;
  }

  if (normalized.startsWith('system.') || normalized.startsWith('process.') || normalized.startsWith('clipboard.')) {
    // Most of these are non-destructive, but treat as STANDARD by default.
    return PermissionLevel.STANDARD;
  }

  return PermissionLevel.READ_ONLY;
}

function buildDescription(normalizedToolName: string, params: Record<string, unknown>): string {
  switch (normalizedToolName) {
    case 'files.delete': {
      const paths = Array.isArray(params.paths) ? (params.paths as unknown[]) : [];
      return `Delete ${paths.length || ''} file(s)`;
    }
    case 'files.move':
      return 'Move file(s)';
    case 'files.copy':
      return 'Copy file(s)';
    case 'files.rename':
      return 'Rename file/folder';
    case 'files.write':
      return 'Write file';
    case 'files.create.folder':
      return 'Create folder';
    case 'process.kill':
      return 'Kill a process';
    case 'system.sleep':
      return 'Put computer to sleep';
    case 'system.lock':
      return 'Lock the screen';
    case 'apps.quit':
      return 'Quit application';
    case 'window.close':
      return 'Close window';
    default:
      return `Allow ${normalizedToolName}?`;
  }
}

function shouldAlwaysConfirm(settings: Settings, normalizedToolName: string, level: PermissionLevel, params: Record<string, unknown>): boolean {
  if (settings.permissions.requireConfirmFor.includes(normalizedToolName)) {
    return true;
  }

  // Additional alpha guardrail: confirm bulk deletes/moves/copies.
  if (normalizedToolName === 'files.delete') {
    const paths = Array.isArray(params.paths) ? (params.paths as unknown[]) : [];
    if (paths.length >= settings.safety.requireConfirmAbove) return true;
  }

  return level === PermissionLevel.SENSITIVE || level === PermissionLevel.DANGEROUS;
}

export async function requestPermissionForTool(
  toolName: string,
  params: Record<string, unknown>,
  details?: string[],
): Promise<PermissionDecision> {
  const settings = getSettings();
  const normalizedToolName = normalizeToolNameForPermissions(toolName);
  const level = getPermissionLevelForTool(toolName);

  // If we have no UI connected, default-deny dangerous/sensitive.
  if (!activeWebContents || activeWebContents.isDestroyed()) {
    if (level === PermissionLevel.SENSITIVE || level === PermissionLevel.DANGEROUS) {
      return { allowed: false };
    }
    return { allowed: true };
  }

  // If confirmation isn't required, allow.
  const mustConfirm = shouldAlwaysConfirm(settings, normalizedToolName, level, params);
  if (!mustConfirm) {
    return { allowed: true };
  }

  // Reuse remembered decisions when allowed.
  if (settings.permissions.rememberChoices && !settings.permissions.requireConfirmFor.includes(normalizedToolName)) {
    const saved = getSavedPermission(normalizedToolName);
    if (saved !== null) {
      return { allowed: saved };
    }
  }

  const requestId = generateId();
  const request: PermissionRequest = {
    id: requestId,
    tool: normalizedToolName,
    description: buildDescription(normalizedToolName, params),
    level,
    params,
    details,
  };

  const decision = await new Promise<PermissionDecision>((resolve) => {
    pending.set(requestId, resolve);
    activeWebContents!.send(IPC_CHANNELS.APP_PERMISSION_REQUEST, request);

    // Timeout -> deny.
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      resolve({ allowed: false });
    }, 60_000);
  });

  if (settings.permissions.rememberChoices && !settings.permissions.requireConfirmFor.includes(normalizedToolName)) {
    savePermission(normalizedToolName, decision.allowed);
  }

  return decision;
}
