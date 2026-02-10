// URL Fetch - fetches web pages and returns cleaned text content

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface FetchResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  contentLength?: number;
  error?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) WinPilot/0.1.0';
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024; // 2MB max download
const DEFAULT_SUMMARY_LENGTH = 2000;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;

function isPrivateUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  );
}

export async function fetchUrl(
  url: string,
  maxLength: number = DEFAULT_SUMMARY_LENGTH
): Promise<FetchResult> {
  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, url, error: `Unsupported protocol: ${parsedUrl.protocol}` };
    }

    if (isPrivateUrl(parsedUrl)) {
      return { success: false, url, error: 'Access to private/local URLs is blocked for security.' };
    }

    if (parsedUrl.protocol === 'http:') {
      parsedUrl.protocol = 'https:';
    }

    const html = await httpGet(parsedUrl.toString(), 0);

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/si);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

    const text = stripHtml(html);

    const content = text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;

    return {
      success: true,
      url: parsedUrl.toString(),
      title,
      content,
      contentLength: text.length,
    };
  } catch (error) {
    return {
      success: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function httpGet(url: string, redirectCount: number): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(
      url,
      {
        headers: { 'User-Agent': USER_AGENT },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          resolve(httpGet(redirectUrl, redirectCount + 1));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
          reject(new Error(`Unsupported content type: ${contentType}`));
          return;
        }

        const chunks: Buffer[] = [];
        let totalLength = 0;

        res.on('data', (chunk: Buffer) => {
          totalLength += chunk.length;
          if (totalLength > MAX_CONTENT_LENGTH) {
            req.destroy();
            reject(new Error('Content too large (>2MB)'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        res.on('error', reject);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`));
    });

    req.on('error', reject);
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
