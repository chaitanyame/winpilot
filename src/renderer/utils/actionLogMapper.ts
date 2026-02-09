import type { ActionLog, ToolCall } from '../../shared/types';

/**
 * Converts ActionLog to ToolCall format for ToolCallsDisplay component
 */
export function actionLogToToolCall(log: ActionLog): ToolCall {
  return {
    id: log.id,
    name: log.tool,
    params: {}, // ActionLog doesn't expose raw params
    status: log.status === 'pending' ? 'running'
          : log.status === 'success' ? 'success'
          : log.status === 'error' ? 'error'
          : 'pending',
    error: log.error,
    result: log.details, // Store details for reasoning extraction
  };
}

/**
 * Parses reasoning and command from ActionLog details field
 * Format: "Command: xyz\n\nReasoning: explanation"
 */
export function parseReasoning(details?: string): {
  command?: string;
  reasoning?: string;
} {
  if (!details) return {};

  const commandMatch = details.match(/Command:\s*(.+?)(?=\n\nReasoning:|$)/s);
  const reasoningMatch = details.match(/Reasoning:\s*(.+)/s);

  return {
    command: commandMatch?.[1]?.trim(),
    reasoning: reasoningMatch?.[1]?.trim(),
  };
}
