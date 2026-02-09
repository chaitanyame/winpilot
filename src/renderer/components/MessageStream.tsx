import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Loader2, CheckCircle, XCircle, ChevronDown,
  MonitorUp, FolderOpen, AppWindow, Volume2, Clipboard, Cpu, FileText, AlertTriangle } from 'lucide-react';
import { parseReasoning } from '../utils/actionLogMapper';

/**
 * Helper: get date separator label for a message
 */
function getDateLabel(date: Date): string {
  const now = new Date();
  const msgDate = new Date(date);
  const isToday = msgDate.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = msgDate.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return msgDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
import type { ActionLog, Message } from '../../shared/types';

interface Props {
  messages: Message[];
  isLoading: boolean;
  actionLogs?: ActionLog[];
  completedMessageIds?: Set<string>;
}

// Friendly tool names and icons
const toolInfo: Record<string, { name: string; icon: React.ElementType; verb: string }> = {
  // Window management
  window_list: { name: 'Windows', icon: MonitorUp, verb: 'Listing open windows' },
  window_focus: { name: 'Focus Window', icon: MonitorUp, verb: 'Focusing window' },
  window_minimize: { name: 'Minimize', icon: MonitorUp, verb: 'Minimizing window' },
  window_maximize: { name: 'Maximize', icon: MonitorUp, verb: 'Maximizing window' },
  window_close: { name: 'Close Window', icon: MonitorUp, verb: 'Closing window' },
  window_move: { name: 'Move Window', icon: MonitorUp, verb: 'Moving window' },
  window_arrange: { name: 'Arrange', icon: MonitorUp, verb: 'Arranging windows' },
  // Files
  files_list: { name: 'Files', icon: FolderOpen, verb: 'Listing files' },
  files_read: { name: 'Read File', icon: FileText, verb: 'Reading file' },
  files_write: { name: 'Write File', icon: FileText, verb: 'Writing file' },
  files_delete: { name: 'Delete', icon: FolderOpen, verb: 'Deleting file' },
  files_move: { name: 'Move File', icon: FolderOpen, verb: 'Moving file' },
  files_copy: { name: 'Copy File', icon: FolderOpen, verb: 'Copying file' },
  files_search: { name: 'Search', icon: FolderOpen, verb: 'Searching files' },
  // Apps
  apps_launch: { name: 'Launch App', icon: AppWindow, verb: 'Launching application' },
  apps_list: { name: 'Apps', icon: AppWindow, verb: 'Listing applications' },
  // Office
  office_create: { name: 'Create Document', icon: FileText, verb: 'Creating document' },
  powerpoint_create: { name: 'Create Presentation', icon: FileText, verb: 'Creating presentation' },
  // System
  system_info: { name: 'System Info', icon: Cpu, verb: 'Getting system info' },
  system_volume: { name: 'Volume', icon: Volume2, verb: 'Adjusting volume' },
  system_brightness: { name: 'Brightness', icon: MonitorUp, verb: 'Adjusting brightness' },
  // Clipboard
  clipboard_read: { name: 'Read Clipboard', icon: Clipboard, verb: 'Reading clipboard' },
  clipboard_write: { name: 'Write Clipboard', icon: Clipboard, verb: 'Writing to clipboard' },
  // Processes
  processes_list: { name: 'Processes', icon: Cpu, verb: 'Listing processes' },
  processes_kill: { name: 'End Process', icon: Cpu, verb: 'Ending process' },
};

function getToolInfo(toolName: string) {
  return toolInfo[toolName] || { name: toolName.replace(/_/g, ' '), icon: Cpu, verb: `Running ${toolName}` };
}

/**
 * Renders markdown-like content with formatting including tables
 * This function is expensive, so results should be memoized per message
 */
const renderContent = (content: string): React.ReactNode => {
  const elements: React.ReactNode[] = [];

  // Pre-process: collapse completed tool blocks into single-line markers
  // A completed block has both <!--tool:start:NAME--> and <!--tool:end:STATUS-->
  const processed = content.replace(
    /<!--tool:start:(.+?)-->[\s\S]*?<!--tool:end:(.+?)-->/g,
    '<!--tool:done:$1:$2-->'
  );

  const lines = processed.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listType === 'ul' ? 'list-disc ml-5 my-2' : 'list-decimal ml-5 my-2'}>
          {listItems.map((item, i) => (
            <li key={i} className="my-0.5">{renderInline(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="border-b border-dark-300 dark:border-dark-600">
                  {tableHeader.map((cell, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-dark-700 dark:text-dark-200">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-dark-200 dark:border-dark-700 last:border-0">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-dark-600 dark:text-dark-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let keyIndex = 0;

    // Process inline formatting: bold, italic, code, links
    const inlineRegex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      if (match[1]) { // Bold
        parts.push(<strong key={keyIndex++}>{match[2]}</strong>);
      } else if (match[3]) { // Italic
        parts.push(<em key={keyIndex++}>{match[4]}</em>);
      } else if (match[5]) { // Inline code
        parts.push(
          <code key={keyIndex++} className="px-1.5 py-0.5 rounded bg-dark-200 dark:bg-dark-700 text-sm font-mono">
            {match[6]}
          </code>
        );
      } else if (match[7]) { // Link
        parts.push(
          <a key={keyIndex++} href={match[9]} className="text-primary-500 hover:underline" target="_blank" rel="noopener noreferrer">
            {match[8]}
          </a>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const parseTableRow = (line: string): string[] | null => {
    if (!line.includes('|')) return null;
    // Remove leading/trailing pipes and split
    const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
    const cells = trimmed.split('|').map(cell => cell.trim());
    // Filter out empty results from malformed rows
    return cells.length > 0 ? cells : null;
  };

  const isTableSeparator = (line: string): boolean => {
    // Match lines like |---|---| or |:---:|:---:| etc.
    return /^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block handling
    if (line.startsWith('```')) {
      flushList();
      flushTable();
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="my-2 p-3 rounded-lg bg-dark-200 dark:bg-dark-700 overflow-x-auto text-sm font-mono">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Collapsible tool block: completed (collapsed by default)
    const doneMatch = line.match(/^<!--tool:done:(.+?):(.+?)-->$/);
    if (doneMatch) {
      flushList();
      flushTable();
      const toolName = doneMatch[1];
      const status = doneMatch[2];
      const isSuccess = status.includes('✅');
      elements.push(
        <details key={`tool-${i}`} className="my-1.5 rounded-lg bg-dark-100/60 dark:bg-dark-700/40 border border-dark-200/50 dark:border-dark-600/50 overflow-hidden">
          <summary className="cursor-pointer px-3 py-1.5 text-xs flex items-center gap-2 text-dark-500 dark:text-dark-400 select-none hover:bg-dark-200/40 dark:hover:bg-dark-600/30 transition-colors">
            {isSuccess
              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            <span className="capitalize">{toolName}</span>
          </summary>
        </details>
      );
      continue;
    }

    // Collapsible tool block: in-progress (expanded with spinner)
    const startMatch = line.match(/^<!--tool:start:(.+?)-->$/);
    if (startMatch) {
      flushList();
      flushTable();
      const toolName = startMatch[1];
      elements.push(
        <details key={`tool-${i}`} open className="my-1.5 rounded-lg bg-dark-100/60 dark:bg-dark-700/40 border border-blue-300/30 dark:border-blue-500/20 overflow-hidden">
          <summary className="cursor-pointer px-3 py-1.5 text-xs flex items-center gap-2 text-dark-500 dark:text-dark-400 select-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 flex-shrink-0" />
            <span className="capitalize">{toolName}</span>
          </summary>
          <div className="px-3 pb-2 text-xs text-dark-400 dark:text-dark-500">Running...</div>
        </details>
      );
      continue;
    }

    // Skip orphaned end markers (already consumed by pre-processing)
    if (line.match(/^<!--tool:end:.+?-->$/)) {
      continue;
    }

    // Table handling - check if this looks like a table row
    if (line.includes('|') && !line.startsWith('>')) {
      flushList();
      
      // Check if this is a separator row (the line after headers)
      if (isTableSeparator(line)) {
        // This confirms the previous row was a header
        continue;
      }

      const cells = parseTableRow(line);
      if (cells) {
        // If we have no header yet, this is the header row
        // But only if the next line is a separator
        const nextLine = lines[i + 1];
        if (tableHeader.length === 0 && nextLine && isTableSeparator(nextLine)) {
          tableHeader = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      }
    } else {
      // Not a table row, flush any pending table
      flushTable();
    }

    // Check for list items
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    const olMatch = line.match(/^\d+\.\s+(.+)$/);

    if (ulMatch) {
      flushTable();
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    if (olMatch) {
      flushTable();
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    // Flush any pending list before handling other content
    flushList();

    // Empty line
    if (line.trim() === '') {
      flushTable();
      elements.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      flushTable();
      elements.push(<h3 key={`h3-${i}`} className="font-semibold text-base mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushTable();
      elements.push(<h2 key={`h2-${i}`} className="font-semibold text-lg mt-3 mb-1">{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushTable();
      elements.push(<h1 key={`h1-${i}`} className="font-semibold text-xl mt-3 mb-1">{renderInline(line.slice(2))}</h1>);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushTable();
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-dark-300 dark:border-dark-600 pl-3 my-2 italic text-dark-600 dark:text-dark-400">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`} className="my-1">{renderInline(line)}</p>);
  }

  // Flush any remaining content
  flushList();
  flushTable();
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <pre key={`code-final`} className="my-2 p-3 rounded-lg bg-dark-200 dark:bg-dark-700 overflow-x-auto text-sm font-mono">
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    );
  }

  return elements;
};

// Memoize rendered content to avoid re-parsing on every render
const MemoizedMessageContent = memo(({ content }: { content: string }) => {
  const renderedContent = useMemo(() => renderContent(content), [content]);
  return <>{renderedContent}</>;
});
MemoizedMessageContent.displayName = 'MemoizedMessageContent';

// Collapsible tool calls component (memoized to prevent re-renders)
const ToolCallsDisplay = memo(({
  toolCalls,
  isExecutionComplete
}: {
  toolCalls: Message['toolCalls'];
  isExecutionComplete?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [manuallyExpanded, setManuallyExpanded] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const hasRunning = toolCalls.some(t => t.status === 'running');
  const allSuccess = toolCalls.every(t => t.status === 'success');
  const hasError = toolCalls.some(t => t.status === 'error');
  const allComplete = toolCalls.length > 0 && toolCalls.every(
    t => t.status === 'success' || t.status === 'error'
  );
  const errorCount = toolCalls.filter(t => t.status === 'error').length;

  // Auto-expand when tools are running
  useEffect(() => {
    if (hasRunning) {
      setExpanded(true);
    }
  }, [hasRunning]);

  // Auto-collapse when all tools complete, unless user manually expanded
  useEffect(() => {
    if ((allComplete || isExecutionComplete) && !manuallyExpanded) {
      setExpanded(false);
    }
  }, [allComplete, isExecutionComplete, manuallyExpanded]);

  const showExpanded = expanded;

  // Get top tool names for summary (up to 3)
  const topToolNames = toolCalls
    .slice(0, 3)
    .map(t => t.name)
    .join(', ');

  const handleToggleExpand = () => {
    setExpanded(prev => !prev);
    setManuallyExpanded(true);
  };

  return (
    <div className="mb-2 space-y-2">
      {/* Summary button */}
      {toolCalls.length > 0 && (
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 transition-colors group"
        >
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
            hasError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : allSuccess
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-dark-100 dark:bg-dark-700'
          }`}>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
            />
            {hasError ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : allSuccess ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>
              {toolCalls.length === 1 ? 'Action completed' : `${toolCalls.length} actions completed`}
              {errorCount > 0 && ` (${errorCount} failed)`}
            </span>
            {toolCalls.length > 0 && (
              <>
                <span className="text-dark-400 dark:text-dark-500">·</span>
                <span className="font-mono text-[10px] text-dark-400 dark:text-dark-500">{topToolNames}</span>
              </>
            )}
          </div>
        </button>
      )}

      {/* Expanded view - show each tool with its reasoning */}
      <AnimatePresence>
        {showExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {toolCalls.map((tool) => {
              const toolMeta = getToolInfo(tool.name);
              const ToolIcon = toolMeta.icon;
              const { command, reasoning } = parseReasoning(
                typeof tool.result === 'string' ? tool.result : undefined
              );

              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-1"
                >
                  {/* Reasoning - on its own line above tool */}
                  {reasoning && (
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 italic leading-relaxed border-l-2 border-stone-300 dark:border-stone-600 pl-2">
                      {reasoning}
                    </div>
                  )}

                  {/* Tool execution card */}
                  <div className={`flex flex-col gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${
                    tool.status === 'running'
                      ? 'bg-purple-500/10 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 dark:border-purple-500/20'
                      : tool.status === 'success'
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/20'
                        : tool.status === 'error'
                          ? 'bg-rose-500/10 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/20'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}>
                    {/* Tool status line */}
                    <div className="flex items-center gap-2">
                      {tool.status === 'running' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : tool.status === 'success' ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : tool.status === 'error' ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : (
                        <ToolIcon className="w-3.5 h-3.5" />
                      )}
                      <span className="font-medium">{toolMeta.verb}</span>
                    </div>

                    {/* Command details (if available) */}
                    {command && (
                      <div className="text-[10px] font-mono text-stone-500 dark:text-stone-400 bg-stone-950/10 dark:bg-stone-950/40 px-2 py-1 rounded">
                        {command}
                      </div>
                    )}

                    {/* Error message */}
                    {tool.error && (
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-950/20 px-2 py-1 rounded">
                        {tool.error}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ToolCallsDisplay.displayName = 'ToolCallsDisplay';

// Memoized single message component to prevent re-renders
const MessageItem = memo(({
  message,
  isLoading,
  isLastMessage,
  inlineLogs,
  isExecutionComplete
}: {
  message: Message;
  isLoading: boolean;
  isLastMessage: boolean;
  inlineLogs: ActionLog[];
  isExecutionComplete: boolean;
}) => {
  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full gap-3 justify-start"
    >
      {message.role === 'assistant' ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex flex-col flex-1">
        <div
          className={`rounded-2xl border backdrop-blur-sm shadow-lg/10 ${
            message.role === 'user'
              ? 'message-user px-5 py-3 border-purple-500/30 bg-purple-500/15'
              : 'message-assistant p-5 border-stone-700/60 bg-stone-900/40'
          }`}
        >
          {/* Tool calls display - only for assistant messages (future use) */}
          {message.role === 'assistant' && message.toolCalls && (
            <ToolCallsDisplay toolCalls={message.toolCalls} />
          )}

          {/* Message content */}
          {message.content && (
            <div className="break-words leading-relaxed text-[13px] sm:text-sm">
              <MemoizedMessageContent content={message.content} />
              {isLoading && isLastMessage && message.role === 'assistant' && (
                <span className="cursor-blink"></span>
              )}
            </div>
          )}

          {/* Error display */}
          {message.error && (
            <div className="mt-2 text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        {/* Tool calls for user messages - display below bubble */}
        {message.role === 'user' && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full mt-2">
            <ToolCallsDisplay
              toolCalls={message.toolCalls}
              isExecutionComplete={isExecutionComplete}
            />
          </div>
        )}

        {/* InlineLogs - keep for backward compatibility, can be removed later */}
        {message.role === 'user' && inlineLogs.length > 0 && (
          <div className="w-full mt-2">
            <InlineLogs logs={inlineLogs} isExecutionComplete={isExecutionComplete} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
MessageItem.displayName = 'MessageItem';

/**
 * Date separator component
 */
const DateSeparator = memo(({ label }: { label: string }) => (
  <div className="flex items-center gap-3 py-2">
    <div className="flex-1 h-px bg-stone-700/50" />
    <span className="text-xs text-stone-500 font-medium">{label}</span>
    <div className="flex-1 h-px bg-stone-700/50" />
  </div>
));
DateSeparator.displayName = 'DateSeparator';

const MessageStream = memo(function MessageStream({ messages, isLoading, actionLogs = [], completedMessageIds = new Set() }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // === SCROLL STATE MANAGEMENT (R1-R4) ===
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userScrolledAway, setUserScrolledAway] = useState(false); // R2: Manual override flag
  const prevMessageCountRef = useRef(messages.length);
  const prevIsLoadingRef = useRef(isLoading);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  
  // Threshold constants
  const BOTTOM_THRESHOLD_PX = 20; // R1: Within 20px = "at bottom"
  const SCROLL_AWAY_THRESHOLD_PX = 20; // R2: User must scroll 20px+ to detach

  const userMessageTimestamps = useMemo(() =>
    messages
      .filter(message => message.role === 'user')
      .map(message => ({ id: message.id, ts: message.timestamp?.getTime?.() ?? 0 })),
  [messages]);

  // Add date separators between messages (chronological order)
  const messagesWithDates = useMemo(() => {
    const result: Array<{ type: 'date'; label: string } | { type: 'message'; message: Message; index: number }> = [];
    let lastDateLabel = '';

    messages.forEach((message, index) => {
      const dateLabel = message.timestamp ? getDateLabel(message.timestamp) : '';
      if (dateLabel && dateLabel !== lastDateLabel) {
        result.push({ type: 'date', label: dateLabel });
        lastDateLabel = dateLabel;
      }
      result.push({ type: 'message', message, index });
    });

    return result;
  }, [messages]);

  // Find scroll parent
  const findScrollParent = useCallback((node: HTMLElement | null): HTMLElement | null => {
    let current: HTMLElement | null = node;
    while (current) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }, []);

  // Helper: Check if scroll position is at bottom
  const checkIsAtBottom = useCallback((scrollParent: HTMLElement): boolean => {
    const { scrollHeight, scrollTop, clientHeight } = scrollParent;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    return distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  }, [BOTTOM_THRESHOLD_PX]);

  // R1 & R2: Track scroll position and detect user manual scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollParent = findScrollParent(container);
    if (!scrollParent) return;
    scrollParentRef.current = scrollParent;

    let lastScrollTop = scrollParent.scrollTop;
    let lastScrollHeight = scrollParent.scrollHeight;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentScrollTop = scrollParent.scrollTop;
        const currentScrollHeight = scrollParent.scrollHeight;
        const atBottom = checkIsAtBottom(scrollParent);
        
        // Detect if content grew (new tokens) vs user scrolled
        const contentGrew = currentScrollHeight > lastScrollHeight;
        const userScrolledUp = currentScrollTop < lastScrollTop - SCROLL_AWAY_THRESHOLD_PX;
        
        // R2: If user manually scrolls up during loading, detach auto-scroll
        if (isLoading && userScrolledUp && !contentGrew) {
          setUserScrolledAway(true);
        }
        
        // If user scrolls back to bottom, re-attach
        if (atBottom) {
          setUserScrolledAway(false);
        }
        
        setIsAtBottom(prev => (prev === atBottom ? prev : atBottom));
        // R3: Show button when not at bottom
        const showButton = !atBottom && messages.length > 0;
        setShowScrollButton(prev => (prev === showButton ? prev : showButton));
        
        lastScrollTop = currentScrollTop;
        lastScrollHeight = currentScrollHeight;
        ticking = false;
      });
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, [findScrollParent, checkIsAtBottom, messages.length, isLoading, SCROLL_AWAY_THRESHOLD_PX]);

  // R1: Auto-scroll when at bottom and content changes (streaming)
  useEffect(() => {
    const scrollParent = scrollParentRef.current;
    if (!scrollParent) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    const isNewMessage = messages.length > prevMessageCountRef.current;
    const isUserMessage = lastMsg.role === 'user';

    // When user sends a new message, always scroll to bottom (confirms action - R1 table)
    if (isNewMessage && isUserMessage) {
      setUserScrolledAway(false); // Reset detach state
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
    // For assistant messages or streaming updates
    else if (!userScrolledAway) {
      // Only auto-scroll if user hasn't manually scrolled away (R2)
      if (isAtBottom || isNewMessage) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
      }
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, messages.length, isAtBottom, userScrolledAway]);

  // R4: When stream completes, don't force scroll - stay at current position
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      // Stream just finished - reset the detach flag for next interaction
      // but don't scroll (R4)
      setUserScrolledAway(false);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Initial scroll to bottom on mount (R10: land at bottom of history)
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = useCallback(() => {
    setUserScrolledAway(false);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  return (
    <div ref={containerRef} className="p-6 space-y-5 relative">
      {/* Regular message list - chronological order (ChatGPT style) */}
      {messagesWithDates.map((item, idx) => {
        if (item.type === 'date') {
          return <DateSeparator key={`date-${item.label}-${idx}`} label={item.label} />;
        }

        const message = item.message;
        const messageTimestamp = message.timestamp?.getTime?.() ?? 0;
        let nextUserTimestamp = Number.POSITIVE_INFINITY;

        if (message.role === 'user') {
          const currentIndex = userMessageTimestamps.findIndex(m => m.id === message.id);
          if (currentIndex >= 0 && currentIndex < userMessageTimestamps.length - 1) {
            nextUserTimestamp = userMessageTimestamps[currentIndex + 1].ts;
          }
        }

        const inlineLogs = message.role === 'user'
          ? actionLogs.filter(log => log.createdAt >= messageTimestamp && log.createdAt < nextUserTimestamp)
          : [];

        const isExecutionComplete = message.role === 'user' && completedMessageIds.has(message.id);

        return (
          <div key={message.id}>
            <MessageItem
              message={message}
              isLoading={isLoading}
              isLastMessage={item.index === messages.length - 1}
              inlineLogs={inlineLogs}
              isExecutionComplete={isExecutionComplete}
            />
          </div>
        );
      })}

      {/* R5: "Thinking" indicator before first token arrives */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div className="message-assistant px-4 py-3 rounded-2xl border border-stone-700/60 bg-stone-900/40">
            <div className="flex items-center gap-2">
              {/* Pulsing dots indicator */}
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-stone-400 text-sm">Thinking...</span>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />

      {/* R3: "Jump to Latest" button when user scrolled away */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 z-50 flex items-center gap-2 px-4 py-2.5 
                       bg-purple-600 hover:bg-purple-500 text-white rounded-full 
                       shadow-lg shadow-purple-900/30 transition-all hover:scale-105"
          >
            <ChevronDown className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isLoading ? 'Jump to latest' : 'Scroll to bottom'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});
MessageStream.displayName = 'MessageStream';

// LogsSummary component - shows collapsed summary of action logs
interface LogsSummaryProps {
  actionLogs: ActionLog[];
  isExpanded: boolean;
  onToggle: () => void;
}

const LogsSummary: React.FC<LogsSummaryProps> = memo(({ actionLogs, isExpanded, onToggle }) => {
  const totalActions = actionLogs.length;
  const hasError = actionLogs.some(log => log.status === 'error');
  const errorCount = actionLogs.filter(log => log.status === 'error').length;

  // Extract unique top-level tool names
  const toolNames = Array.from(new Set(actionLogs.map(log => log.tool)));
  const displayToolNames = toolNames.slice(0, 3);
  const hasMore = toolNames.length > 3;

  const toolsText = hasMore
    ? `${displayToolNames.join(', ')}, +${toolNames.length - 3} more`
    : displayToolNames.join(', ');

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-200 transition-colors mb-2 px-2 py-1.5 rounded hover:bg-stone-800/30 w-full"
    >
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
      />
      <span className="font-medium">
        {totalActions} action{totalActions !== 1 ? 's' : ''} completed
        {hasError && ` (${errorCount} failed)`}
      </span>
      {toolNames.length > 0 && (
        <>
          <span className="text-stone-500">·</span>
          <span className="font-mono text-[10px] text-stone-500">{toolsText}</span>
        </>
      )}
    </button>
  );
});
LogsSummary.displayName = 'LogsSummary';

const InlineLogs = memo(({ logs, isExecutionComplete }: { logs: ActionLog[]; isExecutionComplete: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(() => logs.some(log => log.status === 'pending'));
  const [manuallyToggled, setManuallyToggled] = useState(false);

  const hasRunning = logs.some(log => log.status === 'pending');
  const allComplete = logs.length > 0 && logs.every(
    log => log.status === 'success' || log.status === 'error'
  );

  // Auto-collapse when execution completes, but only if user hasn't manually expanded
  useEffect(() => {
    if ((isExecutionComplete || allComplete) && !manuallyToggled) {
      setIsExpanded(false);
    }
  }, [isExecutionComplete, allComplete, manuallyToggled]);

  // Keep expanded while execution is running
  useEffect(() => {
    if (hasRunning) {
      setIsExpanded(true);
    }
  }, [hasRunning]);

  const handleToggle = () => {
    setIsExpanded(prev => !prev);
    setManuallyToggled(true);
  };

  if (logs.length === 0) return null;

  return (
    <div className="mt-4">
      <LogsSummary
        actionLogs={logs}
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {logs.map(log => {
                const { reasoning } = parseReasoning(log.details);
                
                return (
                  <div key={log.id} className="space-y-1">
                    {/* Reasoning - on its own line above tool */}
                    {reasoning && (
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 italic leading-relaxed border-l-2 border-stone-300 dark:border-stone-600 pl-2">
                        {reasoning}
                      </div>
                    )}
                    {/* Tool execution card */}
                    <div className="p-2.5 rounded-lg bg-stone-900/50 border border-stone-700/60">
                      <div className="flex items-center gap-2 text-xs">
                        {log.status === 'success' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : log.status === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        ) : log.status === 'pending' ? (
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="text-stone-400 font-mono">{log.timestamp}</span>
                        <span className="text-stone-200 font-medium">{log.tool}</span>
                      </div>
                      <div className="text-[11px] text-stone-300 mt-1">{log.description}</div>
                      {log.error && (
                        <div className="text-[10px] text-rose-400 font-mono break-all mt-1 rounded-md bg-rose-950/30 border border-rose-900/40 p-2">
                          {log.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
InlineLogs.displayName = 'InlineLogs';

export { MessageStream };
