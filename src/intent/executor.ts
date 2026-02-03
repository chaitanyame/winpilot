/**
 * Intent Classification System - Tool Executor
 *
 * This module executes tools locally with the same response format as LLM execution.
 * Handles direct tool invocation, error handling, and permission checks.
 */

import { ToolExecutionResult } from './types';
import { desktopCommanderTools } from '../tools';
import { logger } from '../utils/logger';

/**
 * Tool Executor Class
 * Executes tools directly without going through the LLM
 */
export class ToolExecutor {
  private toolMap: Map<string, any>;

  constructor() {
    // Build a map of tool name to tool definition
    this.toolMap = new Map();
    for (const tool of desktopCommanderTools) {
      // Tools from @github/copilot-sdk have a 'name' property
      const toolName = (tool as any).name;
      if (toolName) {
        this.toolMap.set(toolName, tool);
      }
    }
    logger.copilot(`ToolExecutor initialized with ${this.toolMap.size} tools`);
  }

  /**
   * Execute a tool with parameters
   */
  async execute(toolName: string, params: Record<string, any> = {}): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Find the tool
      const tool = this.toolMap.get(toolName);
      if (!tool) {
        logger.copilot(`Tool not found: ${toolName}`, 'error');
        return {
          success: false,
          response: `Error: Tool '${toolName}' not found`,
          error: 'Tool not found',
        };
      }

      logger.copilot(`Executing tool: ${toolName}`, { params });

      // Execute the tool handler
      // Tools from @github/copilot-sdk have a handler function
      const handler = (tool as any).handler;
      if (typeof handler !== 'function') {
        logger.copilot(`Tool ${toolName} has no handler`, 'error');
        return {
          success: false,
          response: `Error: Tool '${toolName}' has no handler`,
          error: 'No handler',
        };
      }

      // Call the handler with parameters
      const result = await handler(params);

      const latency = Date.now() - startTime;
      logger.copilot(`Tool executed: ${toolName}`, { latency: `${latency}ms` });

      // Return the result in the expected format
      return {
        success: true,
        response: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot(`Tool execution failed: ${toolName}`, { error: errorMessage, latency: `${latency}ms` });

      return {
        success: false,
        response: `Error executing ${toolName}: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a tool exists
   */
  hasToolAvailable(toolName: string): boolean {
    return this.toolMap.has(toolName);
  }

  /**
   * Get all available tool names
   */
  getAvailableTools(): string[] {
    return Array.from(this.toolMap.keys());
  }

  /**
   * Format execution result for streaming
   * Matches the format expected by the IPC handler
   */
  formatForStreaming(result: ToolExecutionResult): string {
    if (result.success) {
      // Format similar to LLM responses
      return `${result.response}`;
    } else {
      return `Error: ${result.error || 'Unknown error'}`;
    }
  }
}
