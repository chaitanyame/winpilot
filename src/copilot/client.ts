// Copilot SDK Client
// Uses the GitHub Copilot SDK for AI-powered desktop control

import { CopilotClient, CopilotSession, type SessionEvent, type MCPServerConfig as SDKMCPServerConfig } from '@github/copilot-sdk';
import { desktopCommanderTools } from '../tools';
import { logger } from '../utils/logger';
import { getEnabledMcpServers } from '../main/store';
import { MCPLocalServerConfig, MCPRemoteServerConfig } from '../shared/mcp-types';
import { setActiveWebContents } from '../main/permission-gate';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Types for streaming events exposed to the UI
export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  result?: unknown;
  error?: string;
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
  toolName: string;
  arguments: Record<string, unknown>;
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

  constructor() {
    const cliPath = findCopilotCliPath();
    logger.copilot('Creating CopilotClient...', { cliPath });
    this.client = new CopilotClient(cliPath ? { cliPath } : undefined);
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

    // Exclude ALL built-in CLI tools so only our custom tools are available
    // This list comes from the CLI's "Disabled tools" message in session.info events
    const excludedBuiltinTools = [
      'create', 'edit', 'fetch_copilot_cli_documentation', 'glob', 'grep',
      'list_powershell', 'powershell', 'read_powershell', 'report_intent',
      'stop_powershell', 'update_todo', 'view', 'web_fetch', 'write_powershell',
      'bash', 'shell', 'terminal', 'execute_command'
    ];

    try {
      // Create session with streaming enabled, custom tools, and MCP servers
      // Tools are defined with defineTool() and already have handlers
      // Use excludedTools to disable built-in CLI tools (availableTools doesn't work for custom tools)
      this.session = await this.client.createSession({
        streaming: true,
        model: 'gpt-4.1',
        tools: desktopCommanderTools,
        excludedTools: excludedBuiltinTools, // Disable built-in CLI tools
        mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
        systemMessage: {
          mode: 'replace',
          content: this.getSystemPrompt(),
        },
      });

      logger.copilot('Session created', { sessionId: this.session.sessionId });
      this.isInitialized = true;
    } catch (error) {
      logger.error('Copilot', 'Failed to create session', error);
      throw error;
    }
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
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.session) {
      await this.session.destroy();
      this.session = null;
    }
    await this.client.stop();
    this.isInitialized = false;
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

## Instructions

When the user asks you to perform an action:
1. Use the appropriate tool(s) listed above to accomplish the task
2. Call the tool with the correct parameters
3. Provide clear, concise feedback about what you did

Be helpful, efficient, and precise. When listing information, format it in a readable way.
If you're unsure about a command, ask for clarification rather than making assumptions.

Important:
- For file operations, be careful and confirm destructive actions
- For window operations, identify windows by their title or application name
- Always report the results of your actions to the user
- Use app names like "powerpoint", "powerpnt", or "Microsoft PowerPoint" for apps_launch`;
  }
}

// Export singleton instance for app-wide usage
export const copilotController = new CopilotController();
