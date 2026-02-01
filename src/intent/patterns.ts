/**
 * Intent Classification System - Pattern Database
 *
 * This module contains regex patterns for deterministic intent matching (Tier 1).
 * Patterns are organized by tool name and include both query patterns (for simple
 * queries) and action patterns (for parameterized queries).
 */

import { QueryPattern, ActionPattern, PatternMatchResult } from './types';

/**
 * Query patterns for deterministic matching
 * These match queries that don't need parameters
 */
export const QUERY_PATTERNS: Record<string, QueryPattern[]> = {
  // Window Management
  window_list: [
    { pattern: /^(list|show|get|display|what).*(window|windows|open)/i, confidence: 0.96 },
    { pattern: /^what windows (are|r) (open|active|running)/i, confidence: 0.98 },
    { pattern: /^show.*(open|active) (window|windows)/i, confidence: 0.96 },
  ],

  // System Information
  system_info: [
    { pattern: /^(system|computer|pc|machine) (info|information|stats|details|specs)/i, confidence: 0.97 },
    { pattern: /^what.*(system|computer|pc|my computer)/i, confidence: 0.96 },
    { pattern: /^(check|show|get|display) (system|computer|pc) (info|information|specs)/i, confidence: 0.97 },
    { pattern: /^(tell me|show me).*(system|computer) (info|specs|details)/i, confidence: 0.96 },
  ],

  // System Volume (query only)
  system_volume: [
    { pattern: /^(get|what|check|show|tell me).*(volume|audio|sound) ?(level)?$/i, confidence: 0.97 },
    { pattern: /^what.*(volume|audio|sound)$/i, confidence: 0.96 },
  ],

  // Network Information
  network_info: [
    { pattern: /^(network|wifi|internet) (info|information|status|details)/i, confidence: 0.97 },
    { pattern: /^what.*(network|wifi|internet|ip)/i, confidence: 0.96 },
    { pattern: /^(check|show|get|display) (network|wifi|internet) (info|status)/i, confidence: 0.97 },
  ],

  // Application List
  apps_list: [
    { pattern: /^(list|show|get|display).*(apps|applications|programs|running)/i, confidence: 0.96 },
    { pattern: /^what.*(apps|applications|programs).*(running|open|installed)/i, confidence: 0.96 },
  ],

  // Process List
  process_list: [
    { pattern: /^(list|show|get|display).*(process|processes|tasks)/i, confidence: 0.96 },
    { pattern: /^what.*(process|processes|tasks).*(running)/i, confidence: 0.96 },
  ],

  // Clipboard Read
  clipboard_read: [
    { pattern: /^(read|get|show|check|what).*(clipboard|copied)/i, confidence: 0.97 },
    { pattern: /^what.*(clipboard|copied)/i, confidence: 0.96 },
    { pattern: /^(show|tell) me.*(clipboard|copied)/i, confidence: 0.96 },
  ],

  // Clipboard Clear
  clipboard_clear: [
    { pattern: /^(clear|empty|delete|wipe).*(clipboard)/i, confidence: 0.98 },
  ],

  // Service List
  service_list: [
    { pattern: /^(list|show|get|display).*(service|services)/i, confidence: 0.96 },
    { pattern: /^what.*(service|services).*(running|installed|active)/i, confidence: 0.96 },
  ],

  // System Lock
  system_lock: [
    { pattern: /^(lock|secure).*(screen|computer|pc)/i, confidence: 0.98 },
    { pattern: /^lock (it|this|my computer|my pc|screen)/i, confidence: 0.98 },
  ],

  // System Sleep
  system_sleep: [
    { pattern: /^(sleep|suspend|hibernate).*(computer|pc|system)/i, confidence: 0.98 },
    { pattern: /^(put|send).*(computer|pc).*(sleep|suspend)/i, confidence: 0.98 },
  ],

  // List Reminders
  list_reminders: [
    { pattern: /^(list|show|get|display|what).*(reminder|reminders)/i, confidence: 0.97 },
    { pattern: /^what reminders (do i have|are active)/i, confidence: 0.98 },
  ],

  // World Clock
  productivity_worldclock: [
    { pattern: /^(world clock|time.*(world|zones|cities))/i, confidence: 0.97 },
    { pattern: /^what.*(time|clock).*(world|zones)/i, confidence: 0.96 },
  ],
};

/**
 * Action patterns with parameter extraction
 * These match queries that require parameter extraction
 */
export const ACTION_PATTERNS: Record<string, ActionPattern[]> = {
  // System Volume - Set/Mute/Unmute
  system_volume: [
    {
      pattern: /^(set|change|adjust|make).*(volume|audio|sound).*(to )?(\d+)/i,
      extractor: (match) => ({ action: 'set', level: parseInt(match[4]) }),
      confidence: 0.95,
    },
    {
      pattern: /^(volume|audio|sound).*(to )?(\d+)/i,
      extractor: (match) => ({ action: 'set', level: parseInt(match[3]) }),
      confidence: 0.94,
    },
    {
      pattern: /^mute( the)?( volume| audio| sound)?$/i,
      extractor: () => ({ action: 'mute' }),
      confidence: 0.98,
    },
    {
      pattern: /^unmute( the)?( volume| audio| sound)?$/i,
      extractor: () => ({ action: 'unmute' }),
      confidence: 0.98,
    },
    {
      pattern: /^(increase|raise|turn up).*(volume|audio|sound)/i,
      extractor: () => ({ action: 'set', level: 75 }), // Default increase
      confidence: 0.92,
    },
    {
      pattern: /^(decrease|lower|turn down).*(volume|audio|sound)/i,
      extractor: () => ({ action: 'set', level: 25 }), // Default decrease
      confidence: 0.92,
    },
  ],

  // System Brightness
  system_brightness: [
    {
      pattern: /^(set|change|adjust|make).*(brightness|screen).*(to )?(\d+)/i,
      extractor: (match) => ({ action: 'set', level: parseInt(match[4]) }),
      confidence: 0.95,
    },
    {
      pattern: /^brightness.*(to )?(\d+)/i,
      extractor: (match) => ({ action: 'set', level: parseInt(match[2]) }),
      confidence: 0.94,
    },
  ],

  // Focus Window
  window_focus: [
    {
      pattern: /^(focus|switch to|bring up|show|open) (\w+)/i,
      extractor: (match) => ({ appName: match[2] }),
      confidence: 0.94,
    },
  ],

  // Launch Application
  apps_launch: [
    {
      pattern: /^(launch|open|start|run) (\w+)/i,
      extractor: (match) => ({ name: match[2] }),
      confidence: 0.95,
    },
  ],

  // Quit Application
  apps_quit: [
    {
      pattern: /^(quit|close|kill|stop|exit) (\w+)/i,
      extractor: (match) => ({ name: match[2], force: false }),
      confidence: 0.94,
    },
    {
      pattern: /^(force quit|force close|force kill) (\w+)/i,
      extractor: (match) => ({ name: match[2], force: true }),
      confidence: 0.96,
    },
  ],

  // Countdown Timer
  productivity_countdown: [
    {
      pattern: /^(timer|countdown).*(for )?(\d+)\s*(min|minute|minutes|hour|hours|sec|second|seconds)/i,
      extractor: (match) => {
        const value = parseInt(match[3]);
        const unit = match[4].toLowerCase();
        let minutes: number;
        if (unit.startsWith('h')) {
          minutes = value * 60;
        } else if (unit.startsWith('s')) {
          minutes = Math.max(1, Math.round(value / 60));
        } else {
          minutes = value;
        }
        return { action: 'create', duration: minutes, name: `${value} ${unit}` };
      },
      confidence: 0.92,
    },
    {
      pattern: /^(set|start).*(timer|countdown).*(for )?(\d+)\s*(min|minute|minutes|hour|hours)/i,
      extractor: (match) => {
        const value = parseInt(match[4]);
        const unit = match[5].toLowerCase();
        const minutes = unit.startsWith('h') ? value * 60 : value;
        return { action: 'create', duration: minutes, name: `${value} ${unit}` };
      },
      confidence: 0.92,
    },
  ],

  // Pomodoro Timer
  productivity_pomodoro: [
    {
      pattern: /^(start|begin).*(pomodoro)/i,
      extractor: () => ({ action: 'create', workDuration: 25, breakDuration: 5 }),
      confidence: 0.95,
    },
    {
      pattern: /^pomodoro$/i,
      extractor: () => ({ action: 'create', workDuration: 25, breakDuration: 5 }),
      confidence: 0.96,
    },
  ],

  // Set Reminder
  set_reminder: [
    {
      pattern: /^remind me.*(in )?(\d+)\s*(min|minute|minutes|hour|hours)/i,
      extractor: (match) => {
        const value = parseInt(match[2]);
        const unit = match[3].toLowerCase();
        const minutes = unit.startsWith('h') ? value * 60 : value;
        const msgMatch = match.input?.match(/remind me (?:to )?(.*?) in/i);
        const message = msgMatch ? msgMatch[1] : 'Reminder';
        return { message, delay: minutes };
      },
      confidence: 0.93,
    },
    {
      pattern: /^set.*(reminder|alarm).*(in )?(\d+)\s*(min|minute|minutes|hour|hours)/i,
      extractor: (match) => {
        const value = parseInt(match[3]);
        const unit = match[4].toLowerCase();
        const minutes = unit.startsWith('h') ? value * 60 : value;
        return { message: 'Reminder', delay: minutes };
      },
      confidence: 0.92,
    },
  ],

  // Clipboard Write
  clipboard_write: [
    {
      pattern: /^(copy|write|set).*(clipboard|to clipboard).+["'](.+)["']/i,
      extractor: (match) => ({ content: match[3] }),
      confidence: 0.94,
    },
  ],

  // WiFi Control
  system_wifi: [
    {
      pattern: /^(turn on|enable|activate).*(wifi|wi-fi)/i,
      extractor: () => ({ action: 'on' }),
      confidence: 0.97,
    },
    {
      pattern: /^(turn off|disable|deactivate).*(wifi|wi-fi)/i,
      extractor: () => ({ action: 'off' }),
      confidence: 0.97,
    },
    {
      pattern: /^(toggle|switch).*(wifi|wi-fi)/i,
      extractor: () => ({ action: 'toggle' }),
      confidence: 0.96,
    },
    {
      pattern: /^(wifi|wi-fi).*(status|state)/i,
      extractor: () => ({ action: 'status' }),
      confidence: 0.96,
    },
    {
      pattern: /^(list|show).*(wifi|wi-fi).*(network|networks)/i,
      extractor: () => ({ action: 'available' }),
      confidence: 0.96,
    },
  ],

  // Do Not Disturb
  system_dnd: [
    {
      pattern: /^(turn on|enable|activate).*(dnd|do not disturb)/i,
      extractor: () => ({ action: 'on' }),
      confidence: 0.97,
    },
    {
      pattern: /^(turn off|disable|deactivate).*(dnd|do not disturb)/i,
      extractor: () => ({ action: 'off' }),
      confidence: 0.97,
    },
    {
      pattern: /^(dnd|do not disturb).*(status|state)/i,
      extractor: () => ({ action: 'status' }),
      confidence: 0.96,
    },
  ],

  // Unit Conversion
  productivity_convert: [
    {
      pattern: /^(convert|change) (\d+\.?\d*)\s*(\w+)\s*(?:to|into)\s*(\w+)/i,
      extractor: (match) => ({
        value: parseFloat(match[2]),
        fromUnit: match[3],
        toUnit: match[4],
      }),
      confidence: 0.95,
    },
    {
      pattern: /^(\d+\.?\d*)\s*(\w+)\s*(?:to|in|into)\s*(\w+)/i,
      extractor: (match) => ({
        value: parseFloat(match[1]),
        fromUnit: match[2],
        toUnit: match[3],
      }),
      confidence: 0.94,
    },
  ],

  // Screenshot
  system_screenshot: [
    {
      pattern: /^(take|capture|grab).*(screenshot|screen shot|screen)/i,
      extractor: () => ({ region: 'fullscreen' }),
      confidence: 0.96,
    },
    {
      pattern: /^screenshot$/i,
      extractor: () => ({ region: 'fullscreen' }),
      confidence: 0.97,
    },
  ],
};

/**
 * Pattern Matcher Class
 * Matches user queries against predefined patterns
 */
export class PatternMatcher {
  /**
   * Match a query against all patterns
   */
  match(query: string): PatternMatchResult {
    const normalizedQuery = query.trim();

    // First try action patterns (they have parameters)
    for (const [toolName, patterns] of Object.entries(ACTION_PATTERNS)) {
      for (const pattern of patterns) {
        const match = normalizedQuery.match(pattern.pattern);
        if (match) {
          try {
            const params = pattern.extractor(match);
            return {
              toolName,
              confidence: pattern.confidence,
              params,
              matched: true,
            };
          } catch (error) {
            // Extraction failed, try next pattern
            continue;
          }
        }
      }
    }

    // Then try query patterns (no parameters)
    for (const [toolName, patterns] of Object.entries(QUERY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.pattern.test(normalizedQuery)) {
          return {
            toolName,
            confidence: pattern.confidence,
            matched: true,
          };
        }
      }
    }

    // No match found
    return {
      toolName: '',
      confidence: 0,
      matched: false,
    };
  }

  /**
   * Get all tools that have patterns defined
   */
  getSupportedTools(): string[] {
    const queryTools = Object.keys(QUERY_PATTERNS);
    const actionTools = Object.keys(ACTION_PATTERNS);
    return Array.from(new Set([...queryTools, ...actionTools]));
  }
}
