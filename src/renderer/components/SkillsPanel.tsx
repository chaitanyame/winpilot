import { useState, useEffect, useCallback } from 'react';
import type { SkillSummary } from '../../shared/types';

interface SkillsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'sidebar';
}

export function SkillsPanel({ isOpen, onClose, variant = 'modal' }: SkillsPanelProps) {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async (forceRefresh: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = forceRefresh
        ? await window.electronAPI.skillsRefresh()
        : await window.electronAPI.skillsList();
      setSkills(data as SkillSummary[]);
    } catch (err) {
      setError('Failed to load skills');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSkills(false);
    }
  }, [isOpen, loadSkills]);

  if (!isOpen) return null;

  const userSkills = skills.filter(skill => skill.source === 'user');
  const builtinSkills = skills.filter(skill => skill.source === 'builtin');

  const renderSkillCard = (skill: SkillSummary) => (
    <div
      key={`${skill.source}-${skill.id}`}
      className="rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[color:var(--app-text)]">{skill.name}</div>
        <span className="text-[10px] uppercase tracking-wider text-[color:var(--app-text-muted)]">
          {skill.source === 'user' ? 'User' : 'Built-in'}
        </span>
      </div>
      <p className="mt-1 text-sm text-[color:var(--app-text-muted)]">{skill.description}</p>
      {skill.triggers && skill.triggers.length > 0 && (
        <div className="mt-2 text-xs text-[color:var(--app-text-muted)]">
          Triggers: {skill.triggers.join(', ')}
        </div>
      )}
      {skill.license && (
        <div className="mt-1 text-xs text-[color:var(--app-text-muted)]">
          License: {skill.license}
        </div>
      )}
      <div className="mt-1 text-xs text-[color:var(--app-text-muted)] break-all">
        Location: {skill.path}
      </div>
    </div>
  );

  const content = (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isLoading ? (
        <div className="text-center py-8 text-[color:var(--app-text-muted)]">Loading skills...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : skills.length === 0 ? (
        <div className="text-center py-8 text-[color:var(--app-text-muted)]">
          No skills found. Add SKILL.md files under ~/.claude/skills, ~/.agents/skills, ./.agents/skills, or resources/skills.
        </div>
      ) : (
        <>
          {userSkills.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)]">
                User Skills
              </div>
              {userSkills.map(renderSkillCard)}
            </div>
          )}
          {builtinSkills.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)]">
                Built-in Skills
              </div>
              {builtinSkills.map(renderSkillCard)}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (variant === 'sidebar') {
    return (
      <div className="h-full w-[420px] bg-[color:var(--app-surface)] border-l border-[color:var(--app-border)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--app-border)]">
          <h2 className="text-lg font-semibold text-[color:var(--app-text)]">Skills</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSkills(true)}
              className="px-3 py-1 text-xs rounded bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-3)]"
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-[color:var(--app-text-muted)] hover:text-[color:var(--app-text)] text-xl"
            >
              ✕
            </button>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Skills</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSkills(true)}
              className="px-3 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
            >
              ✕
            </button>
          </div>
        </div>
        {content}
      </div>
    </div>
  );
}
