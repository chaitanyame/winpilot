// Slash Commands System

export interface SlashCommand {
  name: string;
  description: string;
  args?: string;
  handler: (args: string, context: SlashCommandContext) => Promise<SlashCommandResult>;
}

export interface SlashCommandContext {
  api: typeof window.electronAPI;
  addSystemMessage: (content: string) => void;
  switchPanel: (panel: string) => void;
  conversationId: string | null;
}

export interface SlashCommandResult {
  handled: boolean;
  message?: string;
}

const commands: SlashCommand[] = [
  {
    name: 'help',
    description: 'Show available commands',
    handler: async () => ({
      handled: true,
      message: formatHelpMessage(),
    }),
  },
  {
    name: 'new',
    description: 'Start a new chat session',
    args: '[title]',
    handler: async (args, ctx) => {
      const title = args.trim() || undefined;
      const id = await ctx.api.chatStart(title);
      return {
        handled: true,
        message: `Started new session${title ? `: "${title}"` : ''} (${id})`,
      };
    },
  },
  {
    name: 'compact',
    description: 'Summarize and reset session context',
    handler: async (_, ctx) => {
      const result = await ctx.api.copilotCompactSession();
      if (result.success) {
        return { handled: true, message: `✅ Session compacted.\n\n**Summary:**\n${result.summary}` };
      }
      return { handled: true, message: `❌ Compaction failed: ${result.error}` };
    },
  },
  {
    name: 'clear',
    description: 'Clear current chat display',
    handler: async () => ({
      handled: true,
      message: '__CLEAR__',
    }),
  },
  {
    name: 'sessions',
    description: 'List recent chat sessions',
    handler: async (_, ctx) => {
      const conversations = await ctx.api.chatGetConversations();
      if (!conversations || conversations.length === 0) {
        return { handled: true, message: 'No chat sessions found.' };
      }
      const list = conversations.slice(0, 10).map((c: any, i: number) =>
        `${i + 1}. **${c.title}** (${c.id}) - ${new Date(c.updated_at).toLocaleDateString()}`
      ).join('\n');
      return { handled: true, message: `**Recent Sessions:**\n${list}\n\nUse \`/switch <id>\` to switch.` };
    },
  },
  {
    name: 'switch',
    description: 'Switch to a different session',
    args: '<id>',
    handler: async (args, ctx) => {
      const id = args.trim();
      if (!id) return { handled: true, message: 'Usage: /switch <session-id>' };
      const result = await ctx.api.chatLoadConversation(id);
      if (result) {
        return { handled: true, message: `Switched to session: ${id}` };
      }
      return { handled: true, message: `Session ${id} not found.` };
    },
  },
  {
    name: 'settings',
    description: 'Open settings panel',
    handler: async (_, ctx) => {
      ctx.switchPanel('settings');
      return { handled: true };
    },
  },
];

function formatHelpMessage(): string {
  const lines = commands.map(cmd => {
    const usage = cmd.args ? ` ${cmd.args}` : '';
    return `\`/${cmd.name}${usage}\` - ${cmd.description}`;
  });
  return `**Available Commands:**\n${lines.join('\n')}\n\nTip: Type \`/\` and press Tab to autocomplete.`;
}

export async function executeSlashCommand(
  input: string,
  context: SlashCommandContext
): Promise<SlashCommandResult | null> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIndex = trimmed.indexOf(' ');
  const commandName = spaceIndex === -1
    ? trimmed.substring(1).toLowerCase()
    : trimmed.substring(1, spaceIndex).toLowerCase();
  const args = spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1);

  const command = commands.find(c => c.name === commandName);
  if (!command) {
    return {
      handled: true,
      message: `Unknown command: /${commandName}. Type /help for available commands.`,
    };
  }

  return command.handler(args, context);
}

export function getSlashCommandSuggestions(input: string): SlashCommand[] {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return [];

  const partial = trimmed.substring(1).toLowerCase();
  if (partial === '') return commands;

  return commands.filter(c => c.name.startsWith(partial));
}

export { commands as slashCommands };
