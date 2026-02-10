export const SKILL_INTENT_MAP: Record<string, string> = {
  'document-creation-pptx': 'pptx',
  'document-creation-docx': 'docx',
  'document-creation-pdf': 'pdf',
  'document-creation-xlsx': 'xlsx',
};

const SKILL_KEYWORDS: Record<string, string[]> = {
  pptx: ['pptx', 'presentation', 'slide deck', 'slides', 'deck', 'pitch deck'],
  docx: ['docx', 'word document', 'word doc', 'document'],
  pdf: ['pdf', 'pdf report'],
  xlsx: ['xlsx', 'spreadsheet', 'excel sheet', 'excel spreadsheet', 'excel file'],
};

const SKILL_EXTENSIONS: Record<string, string[]> = {
  pptx: ['.pptx'],
  docx: ['.docx'],
  pdf: ['.pdf'],
  xlsx: ['.xlsx'],
};

export function getSkillIdForIntent(intent: string): string | null {
  return SKILL_INTENT_MAP[intent] || null;
}

export function isSkillIntent(intent: string): boolean {
  return Boolean(SKILL_INTENT_MAP[intent]);
}

export function detectSkillIdFromMessage(message: string): string | null {
  const normalized = message.toLowerCase();

  for (const [skillId, extensions] of Object.entries(SKILL_EXTENSIONS)) {
    if (extensions.some(ext => normalized.includes(ext))) {
      return skillId;
    }
  }

  for (const [skillId, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return skillId;
    }
  }

  return null;
}
