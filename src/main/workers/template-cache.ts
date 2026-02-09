import fs from 'fs/promises';

export class TemplateCache {
  private cache = new Map<string, Buffer>();

  async getTemplate(templatePath: string): Promise<Buffer> {
    const cacheKey = templatePath.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return Buffer.from(cached);
    }

    const template = await fs.readFile(templatePath);
    this.cache.set(cacheKey, template);
    return Buffer.from(template);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const templateCache = new TemplateCache();
