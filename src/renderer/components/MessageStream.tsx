import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight,
  MonitorUp, FolderOpen, AppWindow, Volume2, Clipboard, Cpu, FileText, AlertTriangle } from 'lucide-react';
import type { ActionLog, Message } from '../../shared/types';

interface Props {
  messages: Message[];
  isLoading: boolean;
  actionLogs?: ActionLog[];
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
 */
function renderContent(content: string): React.ReactNode {
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');
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
}

// Collapsible tool calls component
function ToolCallsDisplay({ toolCalls }: { toolCalls: Message['toolCalls'] }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!toolCalls || toolCalls.length === 0) return null;

  const hasRunning = toolCalls.some(t => t.status === 'running');
  const allSuccess = toolCalls.every(t => t.status === 'success');
  const hasError = toolCalls.some(t => t.status === 'error');

  // Show expanded if any are running
  const showExpanded = expanded || hasRunning;

  // Get the current/last tool for the summary
  const currentTool = toolCalls.find(t => t.status === 'running') || toolCalls[toolCalls.length - 1];
  const info = getToolInfo(currentTool.name);
  const Icon = info.icon;

  return (
    <div className="mb-2">
      {/* Collapsed summary */}
      {!showExpanded && toolCalls.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 transition-colors group"
        >
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
            hasError 
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : allSuccess 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-dark-100 dark:bg-dark-700'
          }`}>
            {hasError ? (
              <XCircle className="w-3.5 h-3.5" />
            ) : allSuccess ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            <span>{toolCalls.length === 1 ? 'Action completed' : `${toolCalls.length} actions completed`}</span>
            <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100" />
          </div>
        </button>
      )}

      {/* Expanded view */}
      <AnimatePresence>
        {showExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            {!hasRunning && toolCalls.length > 1 && (
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 text-xs text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 mb-1"
              >
                <ChevronDown className="w-3 h-3" />
                <span>Collapse</span>
              </button>
            )}
            {toolCalls.map((tool) => {
              const toolMeta = getToolInfo(tool.name);
              const ToolIcon = toolMeta.icon;
              
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                    tool.status === 'running'
                      ? 'bg-purple-500/10 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 dark:border-purple-500/20'
                      : tool.status === 'success'
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/20'
                        : tool.status === 'error'
                          ? 'bg-rose-500/10 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/20'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
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
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MessageStream({ messages, isLoading, actionLogs = [] }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const userMessageTimestamps = useMemo(() =>
    messages
      .filter(message => message.role === 'user')
      .map(message => ({ id: message.id, ts: message.timestamp?.getTime?.() ?? 0 })),
  [messages]);

  // Auto-scroll to bottom to show latest message
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  return (
    <div className="p-6 space-y-5">
      {messages.map((message, index) => {
        const messageTimestamp = message.timestamp?.getTime?.() ?? 0;
        let nextUserTimestamp = Number.POSITIVE_INFINITY;

        if (message.role === 'user') {
          const currentIndex = userMessageTimestamps.findIndex(item => item.id === message.id);
          if (currentIndex >= 0 && currentIndex < userMessageTimestamps.length - 1) {
            nextUserTimestamp = userMessageTimestamps[currentIndex + 1].ts;
          }
        }

        const inlineLogs = message.role === 'user'
          ? actionLogs.filter(log => log.createdAt >= messageTimestamp && log.createdAt < nextUserTimestamp)
          : [];

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
                {/* Tool calls display */}
                <ToolCallsDisplay toolCalls={message.toolCalls} />

                {/* Message content */}
                {message.content && (
                  <div className="break-words leading-relaxed text-[13px] sm:text-sm">
                    {renderContent(message.content)}
                    {isLoading && index === messages.length - 1 && message.role === 'assistant' && (
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

              {message.role === 'user' && inlineLogs.length > 0 && (
                <div className="w-full mt-2">
                  <InlineLogs logs={inlineLogs} />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Loading indicator at bottom */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="message-assistant px-4 py-3">
            <div className="flex items-center gap-2 text-dark-500 dark:text-dark-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function InlineLogs({ logs }: { logs: ActionLog[] }) {
  const [expanded, setExpanded] = useState(true);

  const hasRunning = logs.some(log => log.status === 'pending');
  const hasError = logs.some(log => log.status === 'error');
  const allSuccess = logs.length > 0 && logs.every(log => log.status === 'success');

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-400 hover:text-stone-200 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <span className="flex items-center gap-1.5">
          Logs & Actions
          {hasError ? (
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          ) : hasRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          ) : allSuccess ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {logs.map(log => (
            <div key={log.id} className="p-2.5 rounded-lg bg-stone-900/50 border border-stone-700/60">
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
              {log.details && (
                <div className="text-[10px] text-stone-400 font-mono whitespace-pre-wrap mt-1 rounded-md bg-stone-950/40 border border-stone-800/60 p-2">
                  {log.details}
                </div>
              )}
              {log.error && (
                <div className="text-[10px] text-rose-400 font-mono break-all mt-1 rounded-md bg-rose-950/30 border border-rose-900/40 p-2">
                  {log.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
