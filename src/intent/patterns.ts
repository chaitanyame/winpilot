/**
 * Intent Classification System - Pattern Database
 *
 * This module contains regex patterns for deterministic intent matching (Tier 1).
 * Patterns are organized by tool name and include both query patterns (for simple
 * queries) and action patterns (for parameterized queries).
 *
 * Includes NLP-flexible prefix stripping so conversational queries like
 * "can you list windows" or "please show me what's open" are handled.
 */

import { QueryPattern, ActionPattern, PatternMatchResult } from './types';

/**
 * Strip common conversational prefixes before pattern matching.
 * Allows natural language like "can you...", "please...", "I want to..." etc.
 */
const CONVERSATIONAL_PREFIXES = /^(?:can you |could you |please |i want to |i need to |i'd like to |i would like to |would you |hey |just |go ahead and |let's |help me |yo |ok |okay )+/i;

function stripPrefix(query: string): string {
  return query.replace(CONVERSATIONAL_PREFIXES, '').trim();
}

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
    { pattern: /^what('s| is) open/i, confidence: 0.95 },
    { pattern: /^(show|list) (me )?everything.*(open|running)/i, confidence: 0.94 },
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

  // Clipboard History
  clipboard_history: [
    { pattern: /^(show|list|view|get).*(clipboard|copy).*(history|previous|past)/i, confidence: 0.98 },
    { pattern: /^what.*(copied|clipboard)/i, confidence: 0.95 },
    { pattern: /^(clipboard|copy) history/i, confidence: 0.97 },
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

  // Media Control
  media_play: [
    { pattern: /^play$/i, confidence: 0.95 },
    { pattern: /^(play|start|resume).*(music|media|song|track|audio)/i, confidence: 0.97 },
    { pattern: /^(play|start|resume) (it|playback)$/i, confidence: 0.96 },
  ],
  media_pause: [
    { pattern: /^pause$/i, confidence: 0.95 },
    { pattern: /^(pause|stop).*(music|media|song|track|audio)/i, confidence: 0.97 },
    { pattern: /^pause (it|playback)$/i, confidence: 0.96 },
  ],
  media_play_pause: [
    { pattern: /^toggle.*(play|music|media|playback)/i, confidence: 0.96 },
    { pattern: /^(play|pause) toggle$/i, confidence: 0.95 },
  ],
  media_next: [
    { pattern: /^(next|skip)$/i, confidence: 0.94 },
    { pattern: /^(next|skip).*(track|song)/i, confidence: 0.97 },
    { pattern: /^skip$/i, confidence: 0.95 },
  ],
  media_previous: [
    { pattern: /^(previous|prev|back)$/i, confidence: 0.94 },
    { pattern: /^(previous|prev|back).*(track|song)/i, confidence: 0.97 },
    { pattern: /^go back$/i, confidence: 0.93 },
  ],
  media_stop: [
    { pattern: /^stop.*(music|media|playback|playing)/i, confidence: 0.97 },
    { pattern: /^stop$/i, confidence: 0.93 },
  ],

  // Browser - Query patterns
  browser_refresh: [
    { pattern: /^refresh$/i, confidence: 0.95 },
    { pattern: /^reload$/i, confidence: 0.95 },
    { pattern: /^refresh.*(page|tab|browser)/i, confidence: 0.97 },
  ],
  browser_new_tab: [
    { pattern: /^new tab$/i, confidence: 0.97 },
    { pattern: /^open.*(new|blank) tab$/i, confidence: 0.96 },
  ],
  browser_close_tab: [
    { pattern: /^close tab$/i, confidence: 0.97 },
    { pattern: /^close.*(current|this) tab$/i, confidence: 0.96 },
  ],
  browser_next_tab: [
    { pattern: /^next tab$/i, confidence: 0.97 },
    { pattern: /^switch.*(next|right) tab$/i, confidence: 0.96 },
  ],
  browser_prev_tab: [
    { pattern: /^(previous|prev) tab$/i, confidence: 0.97 },
    { pattern: /^switch.*(previous|prev|left) tab$/i, confidence: 0.96 },
  ],
  browser_bookmark: [
    { pattern: /^bookmark$/i, confidence: 0.95 },
    { pattern: /^bookmark.*(page|this|current)/i, confidence: 0.96 },
    { pattern: /^save.*(bookmark|favorite)/i, confidence: 0.95 },
  ],

  // Email - Query patterns
  email_open: [
    { pattern: /^open.*(email|mail|inbox)/i, confidence: 0.97 },
    { pattern: /^check.*(email|mail|inbox)/i, confidence: 0.96 },
    { pattern: /^(email|mail|inbox)$/i, confidence: 0.94 },
  ],

  // OCR - Query patterns
  ocr_clipboard: [
    { pattern: /^(extract|read|get|copy) text.*(clipboard|screen)/i, confidence: 0.97 },
    { pattern: /^ocr.*(clipboard)/i, confidence: 0.96 },
    { pattern: /^what.*(text|say).*(clipboard|image)/i, confidence: 0.95 },
  ],
  ocr_region: [
    { pattern: /^(ocr|extract text).*(region|area|selection)/i, confidence: 0.97 },
    { pattern: /^(select|capture).*(region|area).*text/i, confidence: 0.96 },
  ],

  // Screen Recording
  screen_record_start: [
    { pattern: /^(start|begin) (screen )?recording/i, confidence: 0.97 },
    { pattern: /^record (my )?(screen|desktop)/i, confidence: 0.96 },
    { pattern: /^capture (my )?(screen|desktop)/i, confidence: 0.95 },
    { pattern: /^screen record/i, confidence: 0.97 },
  ],
  screen_record_stop: [
    { pattern: /^stop (screen )?recording/i, confidence: 0.98 },
    { pattern: /^end (screen )?recording/i, confidence: 0.97 },
    { pattern: /^finish recording/i, confidence: 0.96 },
  ],
  screen_record_status: [
    { pattern: /^(recording|screen recording) status/i, confidence: 0.97 },
    { pattern: /^(is|am i) recording/i, confidence: 0.96 },
    { pattern: /^check recording/i, confidence: 0.95 },
  ],

  // Audio Recording
  audio_record_start: [
    { pattern: /^(start|begin) (audio|voice|sound) recording/i, confidence: 0.97 },
    { pattern: /^record (audio|my voice|sound)/i, confidence: 0.96 },
    { pattern: /^(start|begin) recording audio/i, confidence: 0.96 },
  ],
  audio_record_stop: [
    { pattern: /^stop (audio|voice|sound) recording/i, confidence: 0.98 },
    { pattern: /^end audio recording/i, confidence: 0.97 },
  ],

  // Media Status
  media_status: [
    { pattern: /^(media|music|playback) status/i, confidence: 0.97 },
    { pattern: /^what('s| is) (playing|the current (song|track))/i, confidence: 0.96 },
    { pattern: /^(currently|now) playing/i, confidence: 0.95 },
  ],

  // Weather
  weather_get: [
    { pattern: /^(weather|forecast|temperature)/i, confidence: 0.95 },
    { pattern: /^what('s| is) the (weather|forecast|temperature)/i, confidence: 0.96 },
    { pattern: /^(how|what).*(hot|cold|warm) (is it|outside)/i, confidence: 0.94 },
  ],

  // Speak / TTS
  stop_speaking: [
    { pattern: /^stop (speaking|talking|reading)/i, confidence: 0.97 },
    { pattern: /^(shut up|be quiet|silence)/i, confidence: 0.94 },
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
    // Pronoun-based volume control ("turn it up", "make it quieter")
    {
      pattern: /^(turn|make) it (up|louder)/i,
      extractor: () => ({ action: 'set', level: 75 }),
      confidence: 0.93,
    },
    {
      pattern: /^(turn|make) it (down|quieter|softer|lower)/i,
      extractor: () => ({ action: 'set', level: 25 }),
      confidence: 0.93,
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

  // Launch Application (fixed: .+ for multi-word app names, strip articles)
  apps_launch: [
    {
      pattern: /^(launch|open|start|run|bring up) (.+)/i,
      extractor: (match) => ({ name: match[2].replace(/^(the|a|an) /i, '').trim() }),
      confidence: 0.95,
    },
  ],

  // Quit Application (fixed: .+ for multi-word app names)
  apps_quit: [
    {
      pattern: /^(quit|close|kill|stop|exit) (.+)/i,
      extractor: (match) => ({ name: match[2].replace(/^(the|a|an) /i, '').trim(), force: false }),
      confidence: 0.94,
    },
    {
      pattern: /^(force quit|force close|force kill) (.+)/i,
      extractor: (match) => ({ name: match[2].replace(/^(the|a|an) /i, '').trim(), force: true }),
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

  // Clipboard Restore
  clipboard_restore: [
    {
      pattern: /^(paste|restore|get).*(clipboard|copied).*(from|ago|minutes|hours)/i,
      extractor: (match) => ({ query: match[0] }),
      confidence: 0.96,
    },
    {
      pattern: /^paste.*(URL|link|code|text).*(copied|clipboard)/i,
      extractor: (match) => ({ query: match[1].toLowerCase() }),
      confidence: 0.95,
    },
    {
      pattern: /^(find|search).*(clipboard|copied).+paste/i,
      extractor: (match) => ({ query: match[0] }),
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

  // Browser - Open URL
  browser_open: [
    {
      pattern: /^open (https?:\/\/\S+)/i,
      extractor: (match) => ({ url: match[1] }),
      confidence: 0.97,
    },
    {
      pattern: /^open (\S+\.\S+)/i,
      extractor: (match) => ({ url: match[1] }),
      confidence: 0.95,
    },
    {
      pattern: /^(go to|navigate to|visit) (https?:\/\/\S+)/i,
      extractor: (match) => ({ url: match[2] }),
      confidence: 0.96,
    },
    {
      pattern: /^(go to|navigate to|visit) (\S+\.\S+)/i,
      extractor: (match) => ({ url: match[2] }),
      confidence: 0.94,
    },
  ],

  // Browser - Search
  browser_search: [
    {
      pattern: /^(search|google|look up) (.+)/i,
      extractor: (match) => ({ query: match[2], engine: 'google' }),
      confidence: 0.96,
    },
    {
      pattern: /^(bing|duckduckgo|youtube) search (.+)/i,
      extractor: (match) => ({ query: match[2], engine: match[1].toLowerCase() }),
      confidence: 0.97,
    },
    {
      pattern: /^search (.+) on (google|bing|duckduckgo|youtube)/i,
      extractor: (match) => ({ query: match[1], engine: match[2].toLowerCase() }),
      confidence: 0.97,
    },
  ],

  // Email - Compose
  email_compose: [
    {
      pattern: /^(email|mail|send email to) (\S+@\S+)/i,
      extractor: (match) => ({ to: match[2] }),
      confidence: 0.97,
    },
    {
      pattern: /^(compose|write|new) email$/i,
      extractor: () => ({}),
      confidence: 0.96,
    },
    {
      pattern: /^email .+ about (.+)/i,
      extractor: (match) => ({ subject: match[1] }),
      confidence: 0.94,
    },
    {
      pattern: /^(email|mail) (\S+@\S+) about (.+)/i,
      extractor: (match) => ({ to: match[2], subject: match[3] }),
      confidence: 0.96,
    },
  ],

  // OCR - Extract from file
  ocr_extract: [
    {
      pattern: /^(ocr|extract text from|read text from) (.+\.(png|jpg|jpeg|bmp|gif))/i,
      extractor: (match) => ({ imagePath: match[2] }),
      confidence: 0.97,
    },
    {
      pattern: /^(read|get) text from (.+\.(png|jpg|jpeg|bmp|gif))/i,
      extractor: (match) => ({ imagePath: match[2] }),
      confidence: 0.95,
    },
  ],

  // Screen Recording with parameters
  screen_record_start: [
    {
      pattern: /^(start|begin|record).*(screen|desktop).*(with|using) (microphone|mic|system audio|no audio)/i,
      extractor: (match) => {
        const audioStr = match[4].toLowerCase();
        let audioSource = 'system';
        if (audioStr.includes('mic')) audioSource = 'microphone';
        else if (audioStr.includes('no')) audioSource = 'none';
        return { audioSource };
      },
      confidence: 0.96,
    },
    {
      pattern: /^(start|begin|record).*(screen|desktop).*(\d+)\s*fps/i,
      extractor: (match) => ({ fps: parseInt(match[3]) }),
      confidence: 0.95,
    },
    {
      pattern: /^record.*(region|area|selection)/i,
      extractor: () => ({ region: 'selection' }),
      confidence: 0.94,
    },
  ],

  // Audio Recording with parameters
  audio_record_start: [
    {
      pattern: /^(start|begin|record).*(audio|voice|sound).*(mp3|wav|aac)/i,
      extractor: (match) => ({ format: match[3].toLowerCase() }),
      confidence: 0.96,
    },
    {
      pattern: /^record.*(microphone|mic|system audio)/i,
      extractor: (match) => {
        const sourceStr = match[1].toLowerCase();
        const source = sourceStr.includes('system') ? 'system' : 'microphone';
        return { source };
      },
      confidence: 0.95,
    },
  ],

  // Window Close
  window_close: [
    {
      pattern: /^close (the )?(.+?) window$/i,
      extractor: (match) => ({ appName: match[2].trim() }),
      confidence: 0.95,
    },
    {
      pattern: /^close (the )?(window|this window)$/i,
      extractor: () => ({}),
      confidence: 0.96,
    },
  ],

  // Window Minimize
  window_minimize: [
    {
      pattern: /^minimize (the )?(.+)/i,
      extractor: (match) => ({ appName: match[2].replace(/ window$/i, '').trim() }),
      confidence: 0.95,
    },
  ],

  // Window Maximize
  window_maximize: [
    {
      pattern: /^maximize (the )?(.+)/i,
      extractor: (match) => ({ appName: match[2].replace(/ window$/i, '').trim() }),
      confidence: 0.95,
    },
  ],

  // Process Kill
  process_kill: [
    {
      pattern: /^(kill|end|terminate) (the )?(process|task) (.+)/i,
      extractor: (match) => ({ name: match[4].trim() }),
      confidence: 0.95,
    },
    {
      pattern: /^(kill|end|terminate) (.+)/i,
      extractor: (match) => ({ name: match[2].replace(/^(the|a) /i, '').trim() }),
      confidence: 0.92,
    },
  ],

  // Speak Text (TTS)
  speak_text: [
    {
      pattern: /^(say|speak|read aloud|read out) (.+)/i,
      extractor: (match) => ({ text: match[2] }),
      confidence: 0.95,
    },
  ],

  // Cancel Reminder
  cancel_reminder: [
    {
      pattern: /^(cancel|delete|remove|clear) (the )?(reminder|alarm)/i,
      extractor: () => ({}),
      confidence: 0.96,
    },
  ],
};

/**
 * Pattern Matcher Class
 * Matches user queries against predefined patterns
 */
export class PatternMatcher {
  /**
   * Match a query against all patterns.
   * Tries the raw query first, then strips conversational prefixes and retries.
   */
  match(query: string): PatternMatchResult {
    const normalizedQuery = query.trim();

    // Try raw query first
    const rawResult = this.matchAgainstPatterns(normalizedQuery);
    if (rawResult.matched) return rawResult;

    // Strip conversational prefixes and retry
    const strippedQuery = stripPrefix(normalizedQuery);
    if (strippedQuery !== normalizedQuery && strippedQuery.length > 0) {
      return this.matchAgainstPatterns(strippedQuery);
    }

    // No match found
    return {
      toolName: '',
      confidence: 0,
      matched: false,
    };
  }

  /**
   * Internal: match a query against all action and query patterns
   */
  private matchAgainstPatterns(query: string): PatternMatchResult {
    // First try action patterns (they have parameters)
    for (const [toolName, patterns] of Object.entries(ACTION_PATTERNS)) {
      for (const pattern of patterns) {
        const match = query.match(pattern.pattern);
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
        if (pattern.pattern.test(query)) {
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
