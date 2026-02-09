// Copilot SDK Client
// Uses the GitHub Copilot SDK for AI-powered desktop control

import { CopilotClient, CopilotSession, type SessionEvent, type MCPServerConfig as SDKMCPServerConfig } from '@github/copilot-sdk';
import { desktopCommanderTools } from '../tools';
import { logger } from '../utils/logger';
import { getEnabledMcpServers } from '../main/store';
import { MCPLocalServerConfig, MCPRemoteServerConfig } from '../shared/mcp-types';
import { setActiveWebContents, getActiveWebContents } from '../main/permission-gate';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Types for streaming events exposed to the UI
export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'iteration_start' | 'iteration_complete' | 'loop_complete';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  iterationNumber?: number;
  totalIterations?: number;
  turnSummary?: import('../shared/types').TurnSummary;
}

// Types for session event data to avoid unsafe 'as any' casts
interface MessageDeltaData {
  deltaContent?: string;
}

interface AssistantMessageData {
  content?: string;
  toolRequests?: unknown[];
}

interface ToolExecutionStartData {
  toolCallId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
}

interface ToolExecutionCompleteData {
  toolCallId: string;
  success: boolean;
  result?: { content: unknown };
  error?: { message: string };
}

interface SessionErrorData {
  message: string;
}

/**
 * Find the Copilot CLI path installed by VS Code's Copilot extension
 */
function findCopilotCliPath(): string | null {
  if (process.platform !== 'win32') {
    // On macOS/Linux, just use 'copilot' and let it resolve from PATH
    return null;
  }

  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  
  // Check both VS Code and VS Code Insiders locations
  const vsCodePaths = [
    path.join(appData, 'Code - Insiders', 'User', 'globalStorage', 'github.copilot-chat', 'copilotCli', 'copilot.bat'),
    path.join(appData, 'Code', 'User', 'globalStorage', 'github.copilot-chat', 'copilotCli', 'copilot.bat'),
  ];

  for (const cliPath of vsCodePaths) {
    if (fs.existsSync(cliPath)) {
      logger.copilot(`Found CLI at: ${cliPath}`);
      return cliPath;
    }
  }

  logger.copilot('CLI not found in VS Code locations. Falling back to PATH lookup.');
  return null;
}

/**
 * Desktop Commander Copilot Controller
 * Manages the Copilot SDK client and session for AI-powered desktop control
 */
export class CopilotController {
  private client: CopilotClient;
  private session: CopilotSession | null = null;
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;
  private eventQueue: StreamEvent[] = [];
  private eventResolve: (() => void) | null = null;
  private isComplete = false;
  private isStreaming = false;
  private mcpServersChanged = false;
  private isSending = false;
  // Session compaction
  private compactionSummary: string | null = null;
  // Agentic loop state
  private currentTurnResults: import('../shared/types').ToolExecutionRecord[] = [];
  private currentAssistantResponse = '';
  private loopStartTime = 0;
  private currentIteration = 0;
  private toolExecutionMap = new Map<string, { toolName: string; startTime: number; details?: string }>();
  // Track user message timestamp for action log grouping
  private currentUserMessageTimestamp = 0;
  // Cleanup interval for stale tool executions
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    // Check Node.js version for Copilot CLI compatibility
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 22) {
      logger.warn('Copilot', `Node.js v${majorVersion} detected. Copilot CLI requires v22+. Some features may not work correctly.`);
    }

    const cliPath = findCopilotCliPath();
    logger.copilot('Creating CopilotClient...', { cliPath, nodeVersion });
    this.client = new CopilotClient(cliPath ? { cliPath } : undefined);

    // Start cleanup interval for stale tool executions (every 30 seconds)
    this.cleanupIntervalId = setInterval(() => this.cleanupStaleToolExecutions(), 30000);
  }

  /**
   * Clean up stale tool executions from the map (older than 60 seconds)
   */
  private cleanupStaleToolExecutions(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 60 seconds

    for (const [id, exec] of this.toolExecutionMap) {
      if (now - exec.startTime > staleThreshold) {
        this.toolExecutionMap.delete(id);
        logger.copilot(`Cleaned up stale tool execution: ${id} (${exec.toolName})`);
      }
    }
  }

  /**
   * Set the active renderer WebContents for permission prompts.
   * This is set per user message invocation.
   */
  setActiveWebContents(contents: import('electron').WebContents | null): void {
    setActiveWebContents(contents);
  }

  /**
   * Build MCP servers config from stored servers
   */
  private buildMcpServersConfig(): Record<string, SDKMCPServerConfig> {
    const enabledServers = getEnabledMcpServers();
    const mcpServers: Record<string, SDKMCPServerConfig> = {};

    for (const server of enabledServers) {
      const config = server.config;
      
      // SDK requires tools as string[]. The SDK comment says "[] means none, \"*\" means all"
      // So when config.tools is "*" string, convert to ["*"] array
      const toolsArray: string[] = Array.isArray(config.tools) ? config.tools : ['*'];

      if (config.type === 'local' || config.type === 'stdio') {
        const localConfig = config as MCPLocalServerConfig;
        
        // Parse command - if it contains spaces and args is empty, split it
        let command = localConfig.command.trim();
        let args = localConfig.args || [];
        
        if (command.includes(' ') && args.length === 0) {
          const parts = command.split(' ');
          command = parts[0];
          args = parts.slice(1);
          logger.copilot('Parsed command with embedded args', { 
            original: localConfig.command, 
            command, 
            args 
          });
        }
        
        mcpServers[server.id] = {
          type: localConfig.type,
          command,
          args,
          tools: toolsArray,
          env: localConfig.env,
          cwd: localConfig.cwd,
          timeout: localConfig.timeout,
        };
      } else if (config.type === 'http' || config.type === 'sse') {
        const remoteConfig = config as MCPRemoteServerConfig;
        mcpServers[server.id] = {
          type: remoteConfig.type,
          url: remoteConfig.url,
          tools: toolsArray,
          headers: remoteConfig.headers,
          timeout: remoteConfig.timeout,
        };
      }
    }

    logger.copilot('Built MCP servers config', { 
      count: Object.keys(mcpServers).length, 
      servers: Object.keys(mcpServers),
      fullConfig: JSON.stringify(mcpServers, null, 2)
    });
    return mcpServers;
  }

  /**
   * Notify that MCP servers have changed - will reinitialize on next message
   */
  notifyMcpServersChanged(): void {
    logger.copilot('MCP servers changed, will reinitialize on next message');
    this.mcpServersChanged = true;
  }

  /**
   * Initialize the Copilot session with streaming and custom tools
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.session && !this.mcpServersChanged) {
      logger.copilot('Already initialized');
      return;
    }

    // If MCP servers changed, destroy existing session first
    if (this.mcpServersChanged && this.session) {
      logger.copilot('Reinitializing due to MCP servers change...');
      await this.session.destroy();
      this.session = null;
      this.isInitialized = false;
      this.mcpServersChanged = false;
    }

    const toolNames = desktopCommanderTools.map(t => t.name);
    const mcpServers = this.buildMcpServersConfig();
    logger.copilot('Initializing session...', { 
      toolCount: desktopCommanderTools.length, 
      toolNames,
      mcpServerCount: Object.keys(mcpServers).length,
      mcpServerNames: Object.keys(mcpServers)
    });

    // Exclude most built-in CLI tools, but keep web_fetch for internet access
    // This list comes from the CLI's "Disabled tools" message in session.info events
    const excludedBuiltinTools = [
      'create', 'edit', 'fetch_copilot_cli_documentation', 'glob', 'grep',
      'list_powershell', 'powershell', 'read_powershell', 'report_intent',
      'stop_powershell', 'update_todo', 'view', 'write_powershell',
      'bash', 'shell', 'terminal', 'execute_command'
      // Note: 'web_fetch' is now enabled for web search/fetch capabilities
    ];

    // Get model from settings (defaults to gpt-4o)
    const { getSettings } = await import('../main/store');
    const settings = getSettings();
    const model = settings.agenticLoop?.model || 'gpt-4o';

    try {
      // Create session with streaming enabled, custom tools, and MCP servers
      // Tools are defined with defineTool() and already have handlers
      // Use excludedTools to disable built-in CLI tools (availableTools doesn't work for custom tools)
      this.session = await this.client.createSession({
        streaming: true,
        model, // Configurable model from settings (gpt-4o, gpt-4.1, gpt-4o-mini, etc.)
        tools: desktopCommanderTools,
        excludedTools: excludedBuiltinTools, // Disable built-in CLI tools
        mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
        systemMessage: {
          mode: 'replace',
          content: this.getSystemPrompt(),
        },
      });

      logger.copilot('Session created', { sessionId: this.session.sessionId });
      
      // Debug: Log available tools
      if (this.session && 'listTools' in this.session && typeof this.session.listTools === 'function') {
        try {
          const availableTools = await (this.session as any).listTools();
          logger.copilot('Available tools in session:', {
            count: availableTools.length,
            tools: availableTools.map((t: any) => t.name || t)
          });
        } catch (e) {
          logger.copilot('Could not list tools:', e);
        }
      }
      
      this.isInitialized = true;
    } catch (error) {
      // Check if error is related to MCP server connection
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Copilot', 'Session creation failed', error);
      
      if (errorMessage.includes('MCP') || errorMessage.includes('chrome') || errorMessage.includes('reconnect')) {
        const mcpServerNames = Object.keys(mcpServers).length > 0
          ? Object.keys(mcpServers).join(', ')
          : 'none';
        logger.warn('Copilot', `MCP server connection failed. Configured servers: ${mcpServerNames}. Retrying without MCP servers.`, error);

        // Retry without MCP servers
        this.session = await this.client.createSession({
          streaming: true,
          model,
          tools: desktopCommanderTools,
          excludedTools: excludedBuiltinTools,
          mcpServers: undefined, // Disable MCP servers on retry
          systemMessage: {
            mode: 'replace',
            content: this.getSystemPrompt(),
          },
        });

        logger.copilot('Session created (without MCP)', { sessionId: this.session.sessionId });
        this.isInitialized = true;
      } else {
        logger.error('Copilot', 'Failed to create session', error);
        throw error;
      }
    }
  }

  /**
   * Send a message with agentic loop - iterates until task completion
   * This is the primary entry point that wraps sendMessage in a loop
   */
  async *sendMessageWithLoop(
    message: string,
    config?: Partial<import('../shared/types').AgenticLoopConfig>
  ): AsyncGenerator<StreamEvent> {
    const { getSettings } = await import('../main/store');
    const settings = getSettings();
    const loopConfig = { ...settings.agenticLoop, ...config };

    // Capture user message timestamp for action log grouping
    this.currentUserMessageTimestamp = Date.now();
    
    // Reset assistant response from previous message to avoid stale reasoning in logs
    this.currentAssistantResponse = '';
    this.currentTurnResults = [];

    if (!loopConfig.enabled) {
      // If loop disabled, fall back to single-turn
      yield* this.sendMessage(message);
      return;
    }

    // Check if auto-compact is needed (before sending)
    if (loopConfig.autoCompactThreshold && loopConfig.autoCompactThreshold > 0) {
      try {
        const { getActiveConversationId } = await import('../main/chat-history');
        const { getMessages } = await import('../main/database');
        const convId = getActiveConversationId();
        if (convId) {
          const msgCount = getMessages(convId).length;
          if (msgCount >= loopConfig.autoCompactThreshold) {
            logger.copilot('Auto-compact threshold reached', { msgCount, threshold: loopConfig.autoCompactThreshold });
            yield { type: 'text' as const, content: '🔄 Auto-compacting long conversation...\n' };
            await this.compactSession();
            yield { type: 'text' as const, content: '✅ Context refreshed.\n\n' };
          }
        }
      } catch (e) {
        logger.copilot('Auto-compact check failed, continuing normally', e);
      }
    }

    logger.copilot('Starting agentic loop', { config: loopConfig });

    this.loopStartTime = Date.now();
    this.currentIteration = 0;
    const maxTotalTimeMs = loopConfig.maxTotalTimeMinutes * 60 * 1000;
    const toolFailureCount = new Map<string, number>();
    let consecutiveNoToolTurns = 0;

    try {
      while (this.currentIteration < loopConfig.maxIterations) {
        // Check total time limit
        const elapsed = Date.now() - this.loopStartTime;
        if (elapsed > maxTotalTimeMs) {
          logger.copilot('Max total time exceeded', { elapsed, maxTotalTimeMs });
          yield {
            type: 'text',
            content: '\n\n⏱️ Time limit reached. Task may be incomplete.',
          };
          break;
        }

        this.currentIteration++;
        this.currentTurnResults = [];
        this.currentAssistantResponse = '';
        this.isStreaming = false;

        logger.copilot('Starting iteration', { iteration: this.currentIteration });

        yield {
          type: 'iteration_start',
          iterationNumber: this.currentIteration,
          totalIterations: loopConfig.maxIterations,
          content: this.currentIteration === 1
            ? undefined
            : `\n\n🔄 **Iteration ${this.currentIteration}/${loopConfig.maxIterations}**\n`,
        };

        // Execute one turn
        const turnMessage = this.currentIteration === 1
          ? message
          : this.generateFollowUpMessage(this.currentTurnResults);

        logger.copilot('Sending turn message', {
          iteration: this.currentIteration,
          messagePreview: turnMessage.substring(0, 200)
        });

        // Stream events from this turn
        for await (const event of this.sendMessage(turnMessage)) {
          yield event;
        }

        // Analyze turn results
        const turnSummary = this.analyzeTurn(
          this.currentIteration,
          this.currentTurnResults,
          this.currentAssistantResponse
        );

        logger.copilot('Turn complete', {
          hasToolCalls: turnSummary.hasToolCalls,
          signalsCompletion: turnSummary.signalsCompletion,
          toolCount: turnSummary.toolsExecuted.length,
        });

        yield {
          type: 'iteration_complete',
          iterationNumber: this.currentIteration,
          turnSummary,
        };

        // Check completion criteria
        if (turnSummary.signalsCompletion) {
          logger.copilot('Agent signaled completion');
          yield {
            type: 'loop_complete',
            content: '\n\n✅ Task complete.',
          };
          break;
        }

        // Track consecutive turns without tools
        if (!turnSummary.hasToolCalls) {
          consecutiveNoToolTurns++;
          if (consecutiveNoToolTurns >= 2) {
            logger.copilot('No tool calls in 2 consecutive turns, ending loop');
            yield {
              type: 'loop_complete',
              content: '\n\n✅ No further actions needed.',
            };
            break;
          }
        } else {
          consecutiveNoToolTurns = 0;
        }

        // Circuit breaker: check for repeated tool failures
        for (const toolResult of turnSummary.toolsExecuted) {
          if (!toolResult.success) {
            const count = (toolFailureCount.get(toolResult.toolName) || 0) + 1;
            toolFailureCount.set(toolResult.toolName, count);

            if (count >= 3) {
              logger.copilot('Circuit breaker triggered', {
                tool: toolResult.toolName,
                failures: count
              });
              yield {
                type: 'error',
                error: `Tool ${toolResult.toolName} failed ${count} times consecutively. Stopping to prevent infinite loop.`,
              };
              return;
            }
          } else {
            // Reset failure count on success
            toolFailureCount.set(toolResult.toolName, 0);
          }
        }

        // Check if we've reached max iterations
        if (this.currentIteration >= loopConfig.maxIterations) {
          logger.copilot('Max iterations reached');
          yield {
            type: 'text',
            content: '\n\n⚠️ Maximum iterations reached. Task may be incomplete.',
          };
          break;
        }
      }

      logger.copilot('Agentic loop complete', {
        iterations: this.currentIteration,
        totalTime: Date.now() - this.loopStartTime,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Auto-compact on context overflow
      if (errorMsg.includes('context_length') ||
          errorMsg.includes('maximum context') ||
          errorMsg.includes('token limit') ||
          errorMsg.includes('too long')) {
        logger.copilot('Context overflow detected, auto-compacting...');
        yield { type: 'text' as const, content: '\n\n🔄 Session context full. Compacting...\n' };

        try {
          await this.compactSession();
          yield { type: 'text' as const, content: '✅ Session compacted. Retrying your request...\n\n' };

          // Retry the original message in the fresh session
          yield* this.sendMessage(message);
          return;
        } catch {
          yield { type: 'error' as const, error: 'Failed to compact session. Please start a new conversation.' };
          return;
        }
      }

      logger.error('Copilot', 'Error in agentic loop', error);
      yield {
        type: 'error',
        error: errorMsg,
        content: `❌ Error: ${errorMsg}`,
      };
    }
  }

  /**
   * Analyze a turn to determine if task is complete and what tools were executed
   */
  private analyzeTurn(
    iterationNumber: number,
    toolResults: import('../shared/types').ToolExecutionRecord[],
    assistantResponse: string
  ): import('../shared/types').TurnSummary {
    // Check if agent signals completion
    const completionSignals = [
      'task complete',
      'task is complete',
      'finished',
      'all done',
      'completed successfully',
      'done!',
    ];

    const lowerResponse = assistantResponse.toLowerCase();
    const signalsCompletion = completionSignals.some(signal => lowerResponse.includes(signal));

    return {
      iterationNumber,
      toolsExecuted: toolResults,
      assistantResponse,
      hasToolCalls: toolResults.length > 0,
      signalsCompletion,
      timestamp: new Date(),
    };
  }

  /**
   * Generate a follow-up message with tool execution results
   */
  private generateFollowUpMessage(
    toolResults: import('../shared/types').ToolExecutionRecord[]
  ): string {
    if (toolResults.length === 0) {
      return `No tools were executed in the previous turn.

If the task is complete, respond with "Task complete" and summarize what was accomplished.
If more actions are needed, explain what should happen next.`;
    }

    const resultsText = toolResults.map((result, index) => {
      const status = result.success ? '✅ Success' : '❌ Failed';
      const resultPreview = result.success
        ? this.formatToolResult(result.result)
        : `Error: ${result.error}`;

      return `${index + 1}. **${result.toolName}** → ${status}${resultPreview ? `\n   ${resultPreview}` : ''}`;
    }).join('\n\n');

    return `The following actions were executed:

${resultsText}

Based on these results:
- If the task is complete, respond with "Task complete" and summarize what was accomplished.
- If errors occurred, decide whether to retry with different parameters, try an alternative approach, or report the issue.
- If more actions are needed, decide what to do next and execute the necessary tools.

What should we do next?`;
  }

  /**
   * Format tool result for display in follow-up message
   */
  private formatToolResult(result: unknown): string {
    if (result === null || result === undefined) {
      return '';
    }

    if (typeof result === 'string') {
      return result.length > 200 ? result.substring(0, 200) + '...' : result;
    }

    if (typeof result === 'object') {
      // Handle arrays
      if (Array.isArray(result)) {
        if (result.length === 0) return 'Empty list';
        return `Found ${result.length} items`;
      }

      // Handle objects with common properties
      const obj = result as Record<string, unknown>;
      if ('success' in obj) return obj.success ? 'Success' : 'Failed';
      if ('message' in obj) return String(obj.message);
      if ('count' in obj) return `Count: ${obj.count}`;

      // Fallback to JSON
      const json = JSON.stringify(result);
      return json.length > 200 ? json.substring(0, 200) + '...' : json;
    }

    return String(result);
  }

  /**
   * Send a message and stream the response
   * Uses an AsyncGenerator to yield streaming events
   */
  async *sendMessage(message: string): AsyncGenerator<StreamEvent> {
    logger.copilot('sendMessage called', { message });

    // Prevent concurrent sendMessage calls
    if (this.isSending) {
      logger.copilot('Already sending a message, rejecting concurrent call');
      yield {
        type: 'error',
        error: 'A message is already being processed. Please wait.',
      };
      return;
    }

    this.isSending = true;
    
    // Ensure session is initialized
    if (!this.session) {
      logger.copilot('No session, initializing...');
      await this.initialize();
    }

    if (!this.session) {
      logger.copilot('ERROR: Session still null after initialize');
      yield {
        type: 'error',
        error: 'Failed to initialize Copilot session',
      };
      return;
    }

    // Reset state for new message
    this.eventQueue = [];
    this.isComplete = false;
    this.isStreaming = false;
    this.eventResolve = null;
    // Note: Don't reset currentTurnResults or currentAssistantResponse here
    // They're managed by sendMessageWithLoop for agentic iterations

    logger.copilot('Subscribing to session events...');
    // Subscribe to session events BEFORE sending
    this.unsubscribe = this.session.on((event: SessionEvent) => {
      logger.copilot(`Event: ${event.type}`, event.data);
      this.handleSessionEvent(event);
    });

    try {
      logger.copilot('Sending prompt to session...');
      // Send the message (fire and forget - events come through handler)
      const messageId = await this.session.send({ prompt: message });
      logger.copilot('Message sent', { messageId });

      // Yield events as they arrive
      logger.copilot('Starting event loop...');
      while (!this.isComplete) {
        // If we have events in the queue, yield them
        while (this.eventQueue.length > 0) {
          const event = this.eventQueue.shift()!;
          logger.copilot('Yielding event', { type: event.type, content: event.content?.substring(0, 100) });
          yield event;
          if (event.type === 'done' || event.type === 'error') {
            this.isComplete = true;
            break;
          }
        }

        // Wait for more events if not complete
        if (!this.isComplete && this.eventQueue.length === 0) {
          logger.copilot('Waiting for events...');
          await new Promise<void>((resolve) => {
            this.eventResolve = resolve;
          });
          logger.copilot('Woke up', { queueLength: this.eventQueue.length });
        }
      }
      logger.copilot('Event loop complete');
    } catch (error) {
      logger.error('Copilot', 'Error in sendMessage', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield {
        type: 'error',
        error: errorMessage,
        content: `❌ Error: ${errorMessage}`,
      };
    } finally {
      // Cleanup subscription
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
      this.isSending = false;
    }
  }

  /**
   * Handle incoming session events and convert to StreamEvents
   */
  private handleSessionEvent(event: SessionEvent): void {
    let streamEvent: StreamEvent | null = null;

    switch (event.type) {
      case 'assistant.message_delta': {
        // Streaming text content
        this.isStreaming = true;
        const deltaData = event.data as MessageDeltaData;
        logger.copilot('Message delta', { content: deltaData.deltaContent?.substring(0, 50) });

        // Accumulate assistant response for analysis
        if (deltaData.deltaContent) {
          this.currentAssistantResponse += deltaData.deltaContent;
        }

        streamEvent = {
          type: 'text',
          content: deltaData.deltaContent,
        };
        break;
      }

      case 'assistant.message': {
        // Final message - may contain toolRequests, so don't mark done yet
        // Wait for session.idle to know when all work is complete
        const messageData = event.data as AssistantMessageData;
        logger.copilot('Assistant message', { toolRequestCount: messageData.toolRequests?.length || 0, toolRequests: messageData.toolRequests });

        // Store full assistant response if not streaming
        if (messageData.content && !this.isStreaming) {
          this.currentAssistantResponse = messageData.content;
        }

        // If there are tool requests, the SDK will execute them and we'll get
        // tool.execution_start/complete events. Don't mark done yet.
        // If there are no tool requests and we have content, this is a final response.
        if (!messageData.toolRequests || messageData.toolRequests.length === 0) {
          // No tool requests - if there's content we haven't seen via deltas, show it
          if (messageData.content && !this.isStreaming) {
            streamEvent = {
              type: 'text',
              content: messageData.content,
            };
          }
          // Note: we'll wait for session.idle to mark done
        }
        // If there are toolRequests, SDK will execute them automatically
        break;
      }

      case 'tool.execution_start': {
        // Tool is being called
        const toolStartData = event.data as ToolExecutionStartData;
        logger.copilot('Tool execution start', { toolName: toolStartData.toolName, arguments: toolStartData.arguments });

        const toolArgs = toolStartData.arguments || {};
        const commandDetail = toolStartData.toolName === 'run_shell_command' && typeof toolArgs.command === 'string'
          ? `Command: ${toolArgs.command}`
          : Object.keys(toolArgs).length > 0
            ? `Args: ${JSON.stringify(toolArgs, null, 2)}`
            : undefined;
        const reasoningDetail = this.currentAssistantResponse?.trim()
          ? `Reasoning: ${this.currentAssistantResponse.trim()}`
          : undefined;
        const details = [commandDetail, reasoningDetail].filter(Boolean).join('\n\n') || undefined;

        if (toolStartData.toolCallId) {
          this.toolExecutionMap.set(toolStartData.toolCallId, {
            toolName: toolStartData.toolName,
            startTime: Date.now(),
            details,
          });
        }

        // Emit action log event
        const webContents = getActiveWebContents();
        if (webContents) {
          webContents.send('copilot:actionLog', {
            id: `log-${toolStartData.toolCallId}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            createdAt: this.currentUserMessageTimestamp,
            tool: toolStartData.toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `Executing ${toolStartData.toolName.replace(/_/g, ' ')}...`,
            status: 'pending' as const,
            details,
          });
        }

        streamEvent = {
          type: 'tool_call',
          toolName: toolStartData.toolName,
          toolArgs: toolStartData.arguments,
          content: `🔧 Executing: ${toolStartData.toolName}...`,
        };
        break;
      }

      case 'tool.execution_complete': {
        // Tool execution completed
        const toolCompleteData = event.data as ToolExecutionCompleteData;
        logger.copilot('Tool execution complete', { success: toolCompleteData.success, result: toolCompleteData.result, error: toolCompleteData.error });

        const toolExecution = this.toolExecutionMap.get(toolCompleteData.toolCallId);
        const toolName = toolExecution?.toolName ?? toolCompleteData.toolCallId;
        const duration = toolExecution ? Date.now() - toolExecution.startTime : undefined;
        const details = toolExecution?.details;
        if (toolExecution) {
          this.toolExecutionMap.delete(toolCompleteData.toolCallId);
        }

        // Track tool execution for agentic loop
        this.currentTurnResults.push({
          toolName,
          success: toolCompleteData.success,
          result: toolCompleteData.result?.content,
          error: toolCompleteData.error?.message,
        });

        // Emit action log event for completion
        const webContents = getActiveWebContents();
        if (webContents) {
          webContents.send('copilot:actionLog', {
            id: `log-${toolCompleteData.toolCallId}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            createdAt: this.currentUserMessageTimestamp,
            tool: toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `Completed ${toolName.replace(/_/g, ' ')}`,
            status: toolCompleteData.success ? ('success' as const) : ('error' as const),
            error: toolCompleteData.error?.message,
            duration,
            details,
          });
        }

        streamEvent = {
          type: 'tool_result',
          toolName: toolCompleteData.toolCallId,
          result: toolCompleteData.result?.content,
          content: toolCompleteData.success ? '✅ Done' : `❌ Failed: ${toolCompleteData.error?.message}`,
        };
        break;
      }

      case 'session.error': {
        // Error occurred
        const errorData = event.data as SessionErrorData;
        logger.copilot('Session error event', errorData);
        streamEvent = {
          type: 'error',
          error: errorData.message,
          content: `❌ Error: ${errorData.message}`,
        };
        break;
      }

      case 'session.idle':
        // Session is idle - ready for next message
        logger.copilot('Session idle');
        streamEvent = {
          type: 'done',
        };
        break;

      default:
        logger.copilot('Unhandled event type', { type: event.type });
    }

    if (streamEvent) {
      logger.copilot('Queuing event', { type: streamEvent.type });
      this.eventQueue.push(streamEvent);
      // Wake up the generator if it's waiting
      if (this.eventResolve) {
        logger.copilot('Waking up generator');
        this.eventResolve();
        this.eventResolve = null;
      }
    }
  }

  /**
   * Compact the current session by summarizing history and starting fresh.
   */
  async compactSession(): Promise<string> {
    if (!this.session) {
      throw new Error('No active session to compact');
    }

    logger.copilot('Compacting session...');

    // Get recent messages for context
    let contextMessages: Array<{ role: string; content: string }> = [];
    try {
      const { getActiveConversationId } = await import('../main/chat-history');
      const { getMessages } = await import('../main/database');
      const convId = getActiveConversationId();

      if (convId) {
        const msgs = getMessages(convId);
        const recentMsgs = msgs.slice(-20);
        contextMessages = recentMsgs.map(m => ({ role: m.role, content: m.content }));
      }
    } catch {
      // Chat history may not be available
    }

    // Build compaction prompt
    const compactionPrompt = `Please provide a concise summary of our conversation so far. Include:
- Key topics discussed
- Decisions made
- Important context or preferences mentioned
- Any pending tasks or follow-ups

Conversation to summarize:
${contextMessages.map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\n')}

Provide ONLY the summary, no preamble.`;

    // Get summary from current session
    let summary = '';
    try {
      const response = await this.session.sendAndWait({ prompt: compactionPrompt });
      summary = typeof response === 'string' ? response :
                (response as { content?: string })?.content || 'Previous conversation context unavailable.';
    } catch {
      summary = contextMessages
        .filter(m => m.role === 'user')
        .map(m => m.content.substring(0, 200))
        .join('; ');
      summary = `Previous topics: ${summary}`;
    }

    // Destroy old session
    await this.session.destroy();
    this.session = null;
    this.isInitialized = false;

    // Reinitialize with summary context
    this.compactionSummary = summary;
    await this.initialize();
    this.compactionSummary = null;

    logger.copilot('Session compacted', { summaryLength: summary.length });
    return summary;
  }

  /**
   * Cancel the current streaming operation
   */
  async cancel(): Promise<void> {
    if (this.session) {
      await this.session.abort();
    }
  }

  /**
   * Clear conversation history by creating a new session
   */
  async clearHistory(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.session) {
      await this.session.destroy();
      this.session = null;
      this.isInitialized = false;
    }
    // Next sendMessage call will reinitialize
  }

  /**
   * Get the system prompt for Desktop Commander
   */
  private getSystemPrompt(): string {
    // Build tool list from registered tools
    const toolList = desktopCommanderTools.map(t => {
      const desc = (t as any).description || '';
      return `- ${t.name}: ${desc}`;
    }).join('\n');

    return `You are Desktop Commander, an AI assistant that helps users control their desktop through natural language commands.

## Available Tools

You MUST use these exact tool names when calling tools:

${toolList}

## Web Access

You also have access to the web_fetch tool for internet searches and fetching web content:
- web_fetch: Fetch and read content from any web URL. Use this to search for current information, news, documentation, or any online content.

Examples:
- "What's the latest news?" → Use web_fetch to fetch news sites
- "Search for Python documentation" → Use web_fetch to fetch docs
- "What's the weather in Seattle?" → Use web_fetch to fetch weather sites

## Iterative Task Execution

You operate in an **iterative agentic loop**:
1. Analyze the user's request and current state
2. Execute appropriate tools to make progress
3. Observe the results of tool executions
4. Determine what to do next based on outcomes
5. Continue iterating until the task is complete

### After Each Tool Execution

You will receive feedback about what happened:
- Which tools succeeded or failed
- The results or errors from each tool
- Context about what has been accomplished so far

Use this information to:
- Adjust your approach if tools failed
- Continue with the next logical step if successful
- Decide if the task is complete

### Signaling Completion

When you have accomplished the user's goal, **explicitly state "Task complete"** in your response and provide a brief summary of what was done.

Examples:
- "Task complete. I closed 3 Chrome windows and took a screenshot, which was saved to your Desktop."
- "Task complete. All PDF files have been moved from Downloads to the PDFs folder in Documents."
- "Task complete. Firefox has been launched successfully."

### Handling Errors

If a tool fails:
- Analyze the error message
- Try an alternative approach if possible
- If the task cannot be completed, explain why clearly

Do not repeat the same failing action more than 2 times. Try a different strategy or report the limitation.

## Instructions

When the user asks you to perform an action:
1. Use the appropriate tool(s) listed above to accomplish the task
2. Call the tool with the correct parameters
3. Observe results and continue iterating until done
4. Explicitly say "Task complete" when finished

Be helpful, efficient, and precise. When listing information, format it in a readable way.
If you're unsure about a command, ask for clarification rather than making assumptions.

Important:
- For file operations, be careful and confirm destructive actions
- For window operations, identify windows by their title or application name
- Always report the results of your actions to the user
- Use app names like "powerpoint", "powerpnt", or "Microsoft PowerPoint" for apps_launch
- Signal completion explicitly with "Task complete" when done

## Troubleshooting Mode

When user describes a problem (e.g., "WiFi disconnects", "computer is slow"):

1. Use troubleshoot_start to initialize session and get diagnostic plan
2. Run suggested diagnostic tools (system_info, network_info, etc.)
3. Analyze results and identify issues
4. Use troubleshoot_propose_fix to structure solutions by risk:
   - [SAFE]: No permanent changes (restart service, clear cache)
   - [MODERATE]: Reversible changes (change settings, update drivers)
   - [RISKY]: Significant changes (registry edits, reinstalls)
5. Present fixes to user with clear explanations
6. Execute only approved fixes, requesting permission for each sensitive operation
7. Verify if issue is resolved, iterate if needed

Always explain findings in plain language. Never execute risky fixes without explicit approval.${this.compactionSummary ? `\n\n## Previous Conversation Context\n${this.compactionSummary}` : ''}`;
  }

  /**
   * Clean up resources when controller is destroyed
   */
  async destroy(): Promise<void> {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.session) {
      await this.session.destroy();
      this.session = null;
    }
    await this.client.stop();
    this.toolExecutionMap.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance for app-wide usage
export const copilotController = new CopilotController();
