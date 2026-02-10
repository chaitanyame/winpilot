// Windows Email Actions Implementation
// Uses mailto: URLs to open default mail client

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Email Compose Parameters
 */
export interface EmailComposeParams {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
}

/**
 * Email Interface
 */
export interface IEmail {
  compose(params: EmailComposeParams): Promise<boolean>;
  openMailClient(): Promise<boolean>;
}

/**
 * Windows Email Implementation
 * Uses mailto: URLs which work with Outlook, Thunderbird, Windows Mail, etc.
 */
export class WindowsEmail implements IEmail {
  /**
   * Compose a new email
   */
  async compose(params: EmailComposeParams): Promise<boolean> {
    try {
      // Build mailto URL
      let mailtoUrl = 'mailto:';

      if (params.to) {
        mailtoUrl += encodeURIComponent(params.to);
      }

      const queryParams: string[] = [];

      if (params.cc) {
        queryParams.push(`cc=${encodeURIComponent(params.cc)}`);
      }

      if (params.bcc) {
        queryParams.push(`bcc=${encodeURIComponent(params.bcc)}`);
      }

      if (params.subject) {
        queryParams.push(`subject=${encodeURIComponent(params.subject)}`);
      }

      if (params.body) {
        queryParams.push(`body=${encodeURIComponent(params.body)}`);
      }

      if (queryParams.length > 0) {
        mailtoUrl += '?' + queryParams.join('&');
      }

      // Open mailto URL which launches default mail client
      await execAsync(`start "" "${mailtoUrl}"`, { timeout: 10000 });
      return true;
    } catch (error) {
      console.error('Failed to compose email:', error);
      return false;
    }
  }

  /**
   * Open the default mail client
   */
  async openMailClient(): Promise<boolean> {
    try {
      // Try to open Outlook first, fall back to mailto:
      try {
        await execAsync('start outlook:', { timeout: 5000 });
        return true;
      } catch {
        // Fall back to empty mailto which opens default client
        await execAsync('start "" "mailto:"', { timeout: 10000 });
        return true;
      }
    } catch (error) {
      console.error('Failed to open mail client:', error);
      return false;
    }
  }
}

export const windowsEmail = new WindowsEmail();
