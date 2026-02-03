// Windows Browser Automation Implementation
// Uses default browser via 'start' command and keyboard shortcuts via PowerShell

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Browser Tab Information
 */
export interface BrowserTabInfo {
  title?: string;
  url?: string;
}

/**
 * Browser Control Interface
 */
export interface IBrowser {
  openUrl(url: string, browser?: string): Promise<boolean>;
  search(query: string, engine?: string): Promise<boolean>;
  newTab(url?: string): Promise<boolean>;
  closeTab(): Promise<boolean>;
  nextTab(): Promise<boolean>;
  previousTab(): Promise<boolean>;
  refreshTab(): Promise<boolean>;
  bookmark(): Promise<boolean>;
}

/**
 * Search engine URL templates
 */
const SEARCH_ENGINES: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  youtube: 'https://www.youtube.com/results?search_query=',
  github: 'https://github.com/search?q=',
};

/**
 * Send keyboard shortcut to active window using PowerShell
 */
async function sendKeys(keys: string): Promise<boolean> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${keys}")
`;

  try {
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      timeout: 5000,
    });
    // Small delay to allow the action to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('Failed to send keys:', error);
    return false;
  }
}

/**
 * Windows Browser Implementation
 */
export class WindowsBrowser implements IBrowser {
  /**
   * Open a URL in the default browser
   */
  async openUrl(url: string, browser?: string): Promise<boolean> {
    try {
      // Ensure URL has protocol
      let fullUrl = url;
      if (!url.match(/^https?:\/\//i)) {
        fullUrl = 'https://' + url;
      }

      // Escape the URL for command line
      const escapedUrl = fullUrl.replace(/&/g, '^&');

      if (browser) {
        // Open with specific browser
        const browserPaths: Record<string, string> = {
          chrome: 'chrome',
          firefox: 'firefox',
          edge: 'msedge',
          brave: 'brave',
        };
        const browserExe = browserPaths[browser.toLowerCase()] || browser;
        await execAsync(`start "" "${browserExe}" "${escapedUrl}"`, { timeout: 10000 });
      } else {
        // Open with default browser
        await execAsync(`start "" "${escapedUrl}"`, { timeout: 10000 });
      }
      return true;
    } catch (error) {
      console.error('Failed to open URL:', error);
      return false;
    }
  }

  /**
   * Search the web using specified search engine
   */
  async search(query: string, engine: string = 'google'): Promise<boolean> {
    const baseUrl = SEARCH_ENGINES[engine.toLowerCase()] || SEARCH_ENGINES.google;
    const encodedQuery = encodeURIComponent(query);
    return this.openUrl(baseUrl + encodedQuery);
  }

  /**
   * Open a new tab (optionally with URL)
   */
  async newTab(url?: string): Promise<boolean> {
    if (url) {
      // Open URL which creates a new tab in most browsers
      return this.openUrl(url);
    }
    // Ctrl+T for new tab
    return sendKeys('^t');
  }

  /**
   * Close the current tab
   */
  async closeTab(): Promise<boolean> {
    // Ctrl+W to close tab
    return sendKeys('^w');
  }

  /**
   * Switch to the next tab
   */
  async nextTab(): Promise<boolean> {
    // Ctrl+Tab for next tab
    return sendKeys('^{TAB}');
  }

  /**
   * Switch to the previous tab
   */
  async previousTab(): Promise<boolean> {
    // Ctrl+Shift+Tab for previous tab
    return sendKeys('^+{TAB}');
  }

  /**
   * Refresh the current page
   */
  async refreshTab(): Promise<boolean> {
    // F5 to refresh
    return sendKeys('{F5}');
  }

  /**
   * Bookmark the current page
   */
  async bookmark(): Promise<boolean> {
    // Ctrl+D to bookmark
    return sendKeys('^d');
  }
}

export const windowsBrowser = new WindowsBrowser();
