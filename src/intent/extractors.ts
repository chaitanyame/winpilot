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

      case 'system_screenshot':
        return this.extractScreenshotParams(normalizedQuery);

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
}
