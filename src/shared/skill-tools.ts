export const SKILL_TOOL_PREFIX = 'skill';

function normalizeSegment(value: string, separator: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
}

export function namespaceSkillToolName(skillId: string, toolName: string): string {
  const skillSegment = normalizeSegment(skillId, '-');
  const toolSegment = normalizeSegment(toolName, '_');
  return `${SKILL_TOOL_PREFIX}_${skillSegment}_${toolSegment}`;
}
