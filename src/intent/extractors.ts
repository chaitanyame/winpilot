/**
 * Intent Classification System - Parameter Extractors
 *
 * This module extracts parameters from user queries for tool execution.
 * Handles numbers, time/dates, target names, and other parameter types.
 */

import { ExtractedParams } from './types';

/**
 * Parameter Extractor Class
 * Extracts parameters from queries based on intent
 */
export class ParameterExtractor {
  /**
   * Extract parameters for a given intent
   */
  async extract(query: string, intent: string): Promise<ExtractedParams> {
    const normalizedQuery = query.toLowerCase().trim();

    // Tool-specific extraction logic
    switch (intent) {
      case 'system_volume':
        return this.extractVolumeParams(normalizedQuery);

      case 'system_brightness':
        return this.extractBrightnessParams(normalizedQuery);

      case 'window_focus':
      case 'apps_launch':
      case 'apps_quit':
      case 'apps_switch':
        return this.extractAppParams(normalizedQuery);

      case 'productivity_countdown':
        return this.extractCountdownParams(normalizedQuery);

      case 'productivity_pomodoro':
        return this.extractPomodoroParams(normalizedQuery);

      case 'set_reminder':
        return this.extractReminderParams(normalizedQuery);

      case 'productivity_convert':
        return this.extractConversionParams(normalizedQuery);

      case 'system_wifi':
        return this.extractWifiParams(normalizedQuery);

      case 'system_dnd':
        return this.extractDndParams(normalizedQuery);

      case 'clipboard_write':
        return this.extractClipboardParams(normalizedQuery);

      case 'clipboard_history':
        return this.extractClipboardHistoryParams(normalizedQuery);

      case 'clipboard_restore':
        return this.extractClipboardRestoreParams(normalizedQuery);

      case 'system_screenshot':
        return this.extractScreenshotParams(normalizedQuery);

      // Media Control - no parameters needed
      case 'media_play':
      case 'media_pause':
      case 'media_play_pause':
      case 'media_next':
      case 'media_previous':
      case 'media_stop':
        return {};

      // Browser Actions
      case 'browser_open':
        return this.extractBrowserOpenParams(normalizedQuery);

      case 'browser_search':
        return this.extractBrowserSearchParams(normalizedQuery);

      case 'browser_new_tab':
      case 'browser_close_tab':
      case 'browser_next_tab':
      case 'browser_prev_tab':
      case 'browser_refresh':
      case 'browser_bookmark':
        return {};

      // Email Actions
      case 'email_compose':
        return this.extractEmailComposeParams(normalizedQuery);

      case 'email_open':
        return {};

      // OCR Actions
      case 'ocr_extract':
        return this.extractOcrParams(normalizedQuery);

      case 'ocr_clipboard':
      case 'ocr_region':
        return {};

      // Recording
      case 'screen_record_start':
        return this.extractScreenRecordParams(normalizedQuery);

      case 'screen_record_stop':
      case 'screen_record_status':
        return {};

      case 'audio_record_start':
        return this.extractAudioRecordParams(normalizedQuery);

      case 'audio_record_stop':
        return {};

      default:
        return {};
    }
  }

  /**
   * Extract volume parameters
   */
  private extractVolumeParams(query: string): ExtractedParams {
    // Check for mute/unmute
    if (/mute/.test(query) && !/unmute/.test(query)) {
      return { action: 'mute' };
    }
    if (/unmute/.test(query)) {
      return { action: 'unmute' };
    }

    // Extract volume level
    const levelMatch = query.match(/(\d+)/);
    if (levelMatch) {
      const level = parseInt(levelMatch[1]);
      if (level >= 0 && level <= 100) {
        return { action: 'set', level };
      }
    }

    // Check for increase/decrease
    if (/(increase|raise|turn up|up)/i.test(query)) {
      return { action: 'set', level: 75 };
    }
    if (/(decrease|lower|turn down|down)/i.test(query)) {
      return { action: 'set', level: 25 };
    }

    // Default to get
    return { action: 'get' };
  }

  /**
   * Extract brightness parameters
   */
  private extractBrightnessParams(query: string): ExtractedParams {
    const levelMatch = query.match(/(\d+)/);
    if (levelMatch) {
      const level = parseInt(levelMatch[1]);
      if (level >= 0 && level <= 100) {
        return { action: 'set', level };
      }
    }
    return { action: 'get' };
  }

  /**
   * Extract app/window name parameters
   */
  private extractAppParams(query: string): ExtractedParams {
    // Remove action words to get the app name
    const cleanQuery = query
      .replace(/^(focus|switch to|bring up|show|open|launch|start|run|quit|close|kill|stop|exit|force quit|force close)\s+/i, '')
      .trim();

    if (cleanQuery) {
      return { name: cleanQuery, appName: cleanQuery };
    }
    return {};
  }

  /**
   * Extract countdown timer parameters
   */
  private extractCountdownParams(query: string): ExtractedParams {
    const match = query.match(/(\d+)\s*(min|minute|minutes|hour|hours|sec|second|seconds)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();

      let minutes: number;
      if (unit.startsWith('h')) {
        minutes = value * 60;
      } else if (unit.startsWith('s')) {
        minutes = Math.max(1, Math.round(value / 60));
      } else {
        minutes = value;
      }

      return {
        action: 'create',
        duration: minutes,
        name: `${value} ${unit} timer`,
      };
    }
    return { action: 'create', duration: 25, name: 'Timer' };
  }

  /**
   * Extract pomodoro parameters
   */
  private extractPomodoroParams(query: string): ExtractedParams {
    // Check for custom durations
    const workMatch = query.match(/(\d+)\s*min(?:ute)?s?\s*work/i);
    const breakMatch = query.match(/(\d+)\s*min(?:ute)?s?\s*break/i);

    return {
      action: 'create',
      workDuration: workMatch ? parseInt(workMatch[1]) : 25,
      breakDuration: breakMatch ? parseInt(breakMatch[1]) : 5,
      name: 'Pomodoro',
    };
  }

  /**
   * Extract reminder parameters
   */
  private extractReminderParams(query: string): ExtractedParams {
    // Extract delay
    const delayMatch = query.match(/in (\d+)\s*(min|minute|minutes|hour|hours)/i);
    if (delayMatch) {
      const value = parseInt(delayMatch[1]);
      const unit = delayMatch[2].toLowerCase();
      const minutes = unit.startsWith('h') ? value * 60 : value;

      // Extract message
      const msgMatch = query.match(/remind me (?:to )?(.*?)\s+in/i);
      const message = msgMatch ? msgMatch[1].trim() : 'Reminder';

      return { message, delay: minutes };
    }

    // Extract time (e.g., "at 3pm", "at 15:30")
    const timeMatch = query.match(/at (\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      const msgMatch = query.match(/remind me (?:to )?(.*?)\s+at/i);
      const message = msgMatch ? msgMatch[1].trim() : 'Reminder';
      return { message, time: timeMatch[0].replace('at ', '') };
    }

    return { message: 'Reminder', delay: 60 };
  }

  /**
   * Extract unit conversion parameters
   */
  private extractConversionParams(query: string): ExtractedParams {
    const match = query.match(/(\d+\.?\d*)\s*(\w+)\s*(?:to|in|into)\s*(\w+)/i);
    if (match) {
      return {
        value: parseFloat(match[1]),
        fromUnit: match[2],
        toUnit: match[3],
      };
    }
    return {};
  }

  /**
   * Extract WiFi control parameters
   */
  private extractWifiParams(query: string): ExtractedParams {
    if (/(turn on|enable|activate)/i.test(query)) {
      return { action: 'on' };
    }
    if (/(turn off|disable|deactivate)/i.test(query)) {
      return { action: 'off' };
    }
    if (/(toggle|switch)/i.test(query)) {
      return { action: 'toggle' };
    }
    if (/(list|show|available)/i.test(query)) {
      return { action: 'available' };
    }
    return { action: 'status' };
  }

  /**
   * Extract Do Not Disturb parameters
   */
  private extractDndParams(query: string): ExtractedParams {
    if (/(turn on|enable|activate)/i.test(query)) {
      // Check for duration
      const durationMatch = query.match(/(\d+)\s*(min|minute|minutes|hour|hours)/i);
      if (durationMatch) {
        const value = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const minutes = unit.startsWith('h') ? value * 60 : value;
        return { action: 'on', duration: minutes };
      }
      return { action: 'on' };
    }
    if (/(turn off|disable|deactivate)/i.test(query)) {
      return { action: 'off' };
    }
    return { action: 'status' };
  }

  /**
   * Extract clipboard write parameters
   */
  private extractClipboardParams(query: string): ExtractedParams {
    // Try to extract quoted content
    const quotedMatch = query.match(/["'](.+)["']/);
    if (quotedMatch) {
      return { content: quotedMatch[1] };
    }

    // Extract everything after "clipboard" or "copy"
    const contentMatch = query.match(/(?:clipboard|copy)\s+(.+)/i);
    if (contentMatch) {
      return { content: contentMatch[1] };
    }

    return {};
  }

  /**
   * Extract clipboard history parameters
   */
  private extractClipboardHistoryParams(query: string): ExtractedParams {
    // Extract search query if present
    const searchMatch = query.match(/(?:search|find|with|containing)\s+["']?([^"']+)["']?/i);
    if (searchMatch) {
      return { query: searchMatch[1] };
    }

    // Extract time-based queries
    const timeMatch = query.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
    if (timeMatch) {
      // Return as metadata for filtering
      return { timeframe: `${timeMatch[1]} ${timeMatch[2]}s ago` };
    }

    return {};
  }

  /**
   * Extract clipboard restore parameters
   */
  private extractClipboardRestoreParams(query: string): ExtractedParams {
    // Extract what to search for
    const quotedMatch = query.match(/["'](.+)["']/);
    if (quotedMatch) {
      return { query: quotedMatch[1] };
    }

    // Extract URL pattern
    if (query.toLowerCase().includes('url') || query.toLowerCase().includes('link')) {
      return { query: 'http' }; // Search for URLs
    }

    // Extract code pattern
    if (query.toLowerCase().includes('code')) {
      return { query: 'function' }; // Search for code
    }

    // Extract "from X minutes ago"
    const timeMatch = query.match(/from\s+(\d+)\s+(minute|hour)s?\s+ago/i);
    if (timeMatch) {
      return { timeframe: `${timeMatch[1]} ${timeMatch[2]}s` };
    }

    return {};
  }

  /**
   * Extract screenshot parameters
   */
  private extractScreenshotParams(query: string): ExtractedParams {
    if (/(window)/i.test(query)) {
      return { region: 'window' };
    }
    if (/(selection|select|area)/i.test(query)) {
      return { region: 'selection' };
    }
    return { region: 'fullscreen' };
  }

  /**
   * Extract number from query
   */
  extractNumber(query: string): number | null {
    const match = query.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Extract time duration in minutes
   */
  extractDuration(query: string): number | null {
    const match = query.match(/(\d+)\s*(min|minute|minutes|hour|hours|sec|second|seconds)/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('h')) {
      return value * 60;
    } else if (unit.startsWith('s')) {
      return Math.max(1, Math.round(value / 60));
    } else {
      return value;
    }
  }

  /**
   * Extract target name (app, window, etc.)
   */
  extractTarget(query: string, actionWords: string[]): string | null {
    let cleanQuery = query;
    for (const word of actionWords) {
      const regex = new RegExp(`^${word}\\s+`, 'i');
      cleanQuery = cleanQuery.replace(regex, '');
    }
    return cleanQuery.trim() || null;
  }

  /**
   * Extract browser open URL parameters
   */
  private extractBrowserOpenParams(query: string): ExtractedParams {
    // Extract URL from query
    const urlMatch = query.match(/(https?:\/\/\S+)/i);
    if (urlMatch) {
      return { url: urlMatch[1] };
    }

    // Try to extract domain-like strings (e.g., google.com)
    const domainMatch = query.match(/(?:open|go to|visit|navigate to)\s+(\S+\.\S+)/i);
    if (domainMatch) {
      return { url: domainMatch[1] };
    }

    // Check for specific browser
    const browserMatch = query.match(/in (chrome|firefox|edge|brave)/i);
    if (browserMatch) {
      const params: ExtractedParams = {};
      if (domainMatch) params.url = domainMatch[1];
      params.browser = browserMatch[1].toLowerCase();
      return params;
    }

    return {};
  }

  /**
   * Extract browser search parameters
   */
  private extractBrowserSearchParams(query: string): ExtractedParams {
    // Check for specific engine
    const engineMatch = query.match(/(google|bing|duckduckgo|youtube|github)/i);
    const engine = engineMatch ? engineMatch[1].toLowerCase() : 'google';

    // Extract search query
    let searchQuery = query
      .replace(/^(search|google|bing|duckduckgo|youtube|github|look up)\s*/i, '')
      .replace(/\s*(on|using|with)\s*(google|bing|duckduckgo|youtube|github)/i, '')
      .replace(/\s*search$/i, '')
      .trim();

    // Handle "search for X" pattern
    const forMatch = query.match(/search\s+(?:for\s+)?(.+?)(?:\s+on|\s*$)/i);
    if (forMatch) {
      searchQuery = forMatch[1].trim();
    }

    return { query: searchQuery, engine };
  }

  /**
   * Extract email compose parameters
   */
  private extractEmailComposeParams(query: string): ExtractedParams {
    const params: ExtractedParams = {};

    // Extract email address
    const emailMatch = query.match(/(\S+@\S+\.\S+)/i);
    if (emailMatch) {
      params.to = emailMatch[1];
    }

    // Extract subject from "about X" pattern
    const aboutMatch = query.match(/about\s+(.+?)(?:\s*$|(?=\s+to\s+))/i);
    if (aboutMatch) {
      params.subject = aboutMatch[1].trim();
    }

    // Extract body if quoted
    const bodyMatch = query.match(/(?:saying|body|message)\s*["'](.+?)["']/i);
    if (bodyMatch) {
      params.body = bodyMatch[1];
    }

    return params;
  }

  /**
   * Extract OCR parameters
   */
  private extractOcrParams(query: string): ExtractedParams {
    // Extract file path
    const pathMatch = query.match(/(\S+\.(png|jpg|jpeg|bmp|gif))/i);
    if (pathMatch) {
      return { imagePath: pathMatch[1] };
    }

    return {};
  }

  /**
   * Extract screen recording parameters
   */
  private extractScreenRecordParams(query: string): ExtractedParams {
    const params: ExtractedParams = {};

    // Extract audio source
    if (/(no audio|silent|mute)/i.test(query)) {
      params.audioSource = 'none';
    } else if (/(microphone|mic)/i.test(query)) {
      params.audioSource = 'microphone';
    } else if (/(both|all audio)/i.test(query)) {
      params.audioSource = 'both';
    } else if (/(system audio|desktop audio)/i.test(query)) {
      params.audioSource = 'system';
    }

    // Extract FPS
    const fpsMatch = query.match(/(\d+)\s*fps/i);
    if (fpsMatch) {
      const fps = parseInt(fpsMatch[1]);
      if ([15, 30, 60].includes(fps)) {
        params.fps = fps;
      }
    }

    // Check for region capture
    if (/(region|area|selection|part)/i.test(query)) {
      params.region = 'selection';
    }

    return params;
  }

  /**
   * Extract audio recording parameters
   */
  private extractAudioRecordParams(query: string): ExtractedParams {
    const params: ExtractedParams = {};

    // Extract source
    if (/(system audio|desktop audio|stereo mix)/i.test(query)) {
      params.source = 'system';
    } else if (/(microphone|mic|voice)/i.test(query)) {
      params.source = 'microphone';
    }

    // Extract format
    const formatMatch = query.match(/\b(mp3|wav|aac)\b/i);
    if (formatMatch) {
      params.format = formatMatch[1].toLowerCase();
    }

    return params;
  }
}
