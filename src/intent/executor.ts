/**
 * Intent Classification System - Tool Executor
 *
 * This module executes tools locally with the same response format as LLM execution.
 * Handles direct tool invocation, error handling, and permission checks.
 */

import { ToolExecutionResult } from './types';
import { desktopCommanderTools } from '../tools';
import { logger } from '../utils/logger';

/** Telemetry entry for a single tool execution */
export interface ToolTelemetryEntry {
  tool: string;
  latencyMs: number;
  success: boolean;
  tier: number;
  timestamp: number;
}

/** Aggregated stats for a tool */
export interface ToolTelemetryStats {
  tool: string;
  calls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
}

// Ring buffer of recent tool executions (last 500)
const TELEMETRY_BUFFER_SIZE = 500;
const telemetryBuffer: ToolTelemetryEntry[] = [];

/** Record a tool execution for telemetry */
export function recordToolExecution(entry: ToolTelemetryEntry): void {
  if (telemetryBuffer.length >= TELEMETRY_BUFFER_SIZE) {
    telemetryBuffer.shift();
  }
  telemetryBuffer.push(entry);
}

/** Get aggregated telemetry stats per tool */
export function getToolTelemetryStats(): ToolTelemetryStats[] {
  const groups = new Map<string, ToolTelemetryEntry[]>();
  for (let i = 0; i < telemetryBuffer.length; i++) {
    const entry = telemetryBuffer[i];
    let arr = groups.get(entry.tool);
    if (!arr) {
      arr = [];
      groups.set(entry.tool, arr);
    }
    arr.push(entry);
  }

  const stats: ToolTelemetryStats[] = [];
  groups.forEach((entries, tool) => {
    const latencies = entries.map(e => e.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const p95Idx = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
    stats.push({
      tool,
      calls: entries.length,
      avgLatencyMs: Math.round(sum / entries.length),
      p95LatencyMs: latencies[p95Idx],
      successRate: entries.filter(e => e.success).length / entries.length,
    });
  });

  return stats.sort((a, b) => b.calls - a.calls);
}

/** Get raw telemetry buffer (most recent entries) */
export function getRawTelemetry(limit = 50): ToolTelemetryEntry[] {
  return telemetryBuffer.slice(-limit);
}

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
      const response = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      // Detect soft failures: handlers that return error strings instead of throwing
      if (typeof result === 'string' && this.isErrorResponse(result)) {
        logger.copilot(`Tool returned error response: ${toolName}`, { response: result.substring(0, 100), latency: `${latency}ms` });
        recordToolExecution({ tool: toolName, latencyMs: latency, success: false, tier: 0, timestamp: Date.now() });
        return {
          success: false,
          response,
          error: result,
        };
      }

      logger.copilot(`Tool executed: ${toolName}`, { latency: `${latency}ms` });
      recordToolExecution({ tool: toolName, latencyMs: latency, success: true, tier: 0, timestamp: Date.now() });

      return {
        success: true,
        response,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot(`Tool execution failed: ${toolName}`, { error: errorMessage, latency: `${latency}ms` });
      recordToolExecution({ tool: toolName, latencyMs: latency, success: false, tier: 0, timestamp: Date.now() });

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

  /**
   * Detect if a tool handler response indicates failure
   * (handlers that return error strings instead of throwing)
   */
  private isErrorResponse(response: string): boolean {
    const lower = response.toLowerCase();
    const errorPrefixes = [
      'failed to ',
      'error:',
      'error executing',
      'could not ',
      'unable to ',
      'cannot ',
    ];
    return errorPrefixes.some(prefix => lower.startsWith(prefix));
  }
}
