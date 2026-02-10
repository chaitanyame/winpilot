// Clipboard Image Storage - Manages image files for clipboard history

import { app, nativeImage, NativeImage } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CLIPBOARD_LIMITS } from '../shared/constants';

export interface StoredImageInfo {
  imagePath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  size: number;
  hash: string;
}

class ClipboardImageStorage {
  private basePath: string;
  private thumbnailPath: string;
  private initialized = false;

  constructor() {
    this.basePath = path.join(app.getPath('userData'), 'clipboard-images');
    this.thumbnailPath = path.join(this.basePath, 'thumbnails');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[ImageStorage] Initializing, basePath:', this.basePath);
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.thumbnailPath, { recursive: true });
      this.initialized = true;
      console.log('[ImageStorage] Initialized successfully');
    } catch (error) {
      console.error('[ImageStorage] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Calculate hash of image data for deduplication
   */
  private calculateHash(data: Buffer): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Save an image to storage and create thumbnail
   */
  async saveImage(image: NativeImage): Promise<StoredImageInfo | null> {
    console.log('[ImageStorage] saveImage called');
    await this.initialize();

    if (image.isEmpty()) {
      console.log('[ImageStorage] Image is empty');
      return null;
    }

    const size = image.getSize();
    console.log('[ImageStorage] Image dimensions:', size.width, 'x', size.height);

    const pngData = image.toPNG();
    console.log('[ImageStorage] PNG data size:', pngData.length, 'bytes');

    // Check size limit
    if (pngData.length > CLIPBOARD_LIMITS.MAX_IMAGE_SIZE_BYTES) {
      console.log('[ImageStorage] Image too large:', pngData.length);
      return null;
    }

    // Calculate hash for deduplication
    const hash = this.calculateHash(pngData);
    const filename = `${hash}.png`;
    console.log('[ImageStorage] Hash:', hash, 'Filename:', filename);
    const imagePath = path.join(this.basePath, filename);
    const thumbnailFilePath = path.join(this.thumbnailPath, filename);

    // Check if already exists (deduplication)
    if (fsSync.existsSync(imagePath)) {
      console.log('[ImageStorage] Image already exists, returning cached');
      return {
        imagePath,
        thumbnailPath: thumbnailFilePath,
        width: size.width,
        height: size.height,
        format: 'png',
        size: pngData.length,
        hash,
      };
    }

    // Check storage limit and cleanup if needed
    await this.enforceStorageLimit(pngData.length);

    // Save full image
    console.log('[ImageStorage] Writing image to:', imagePath);
    await fs.writeFile(imagePath, pngData);
    console.log('[ImageStorage] Image saved');

    // Create and save thumbnail
    const thumbnailData = this.createThumbnail(image);
    console.log('[ImageStorage] Writing thumbnail to:', thumbnailFilePath, 'size:', thumbnailData.length);
    await fs.writeFile(thumbnailFilePath, thumbnailData);
    console.log('[ImageStorage] Thumbnail saved');

    return {
      imagePath,
      thumbnailPath: thumbnailFilePath,
      width: size.width,
      height: size.height,
      format: 'png',
      size: pngData.length,
      hash,
    };
  }

  /**
   * Create a thumbnail from an image
   */
  private createThumbnail(image: NativeImage): Buffer {
    const size = image.getSize();
    const maxDim = CLIPBOARD_LIMITS.THUMBNAIL_SIZE;

    // Calculate scaling to fit within maxDim x maxDim
    const scale = Math.min(maxDim / size.width, maxDim / size.height, 1);

    if (scale >= 1) {
      // Image already small enough, return as-is
      return image.toPNG();
    }

    const newWidth = Math.round(size.width * scale);
    const newHeight = Math.round(size.height * scale);

    try {
      // Try to resize - Electron's resize can be buggy on Windows
      const resized = image.resize({ width: newWidth, height: newHeight });
      if (resized.isEmpty()) {
        console.log('[ImageStorage] Resize returned empty image, using original');
        return image.toPNG();
      }
      return resized.toPNG();
    } catch (error) {
      console.error('[ImageStorage] Resize failed, using original:', error);
      return image.toPNG();
    }
  }

  /**
   * Get image data as base64 data URL
   */
  async getImageAsDataUrl(imagePath: string): Promise<string | null> {
    try {
      if (!fsSync.existsSync(imagePath)) {
        return null;
      }
      const data = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${data.toString('base64')}`;
    } catch (error) {
      console.error('Failed to read image:', error);
      return null;
    }
  }

  /**
   * Get thumbnail data as base64 data URL
   */
  async getThumbnailAsDataUrl(thumbnailPath: string): Promise<string | null> {
    return this.getImageAsDataUrl(thumbnailPath);
  }

  /**
   * Delete an image and its thumbnail
   */
  async deleteImage(imagePath: string): Promise<void> {
    try {
      const filename = path.basename(imagePath);
      const thumbnailFilePath = path.join(this.thumbnailPath, filename);

      if (fsSync.existsSync(imagePath)) {
        await fs.unlink(imagePath);
      }
      if (fsSync.existsSync(thumbnailFilePath)) {
        await fs.unlink(thumbnailFilePath);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  /**
   * Get total storage size in bytes
   */
  async getStorageSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.basePath);
      let total = 0;

      for (const file of files) {
        if (file === 'thumbnails') continue;
        const filePath = path.join(this.basePath, file);
        const stat = await fs.stat(filePath);
        total += stat.size;
      }

      return total;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  /**
   * Enforce storage limit by removing oldest images
   */
  private async enforceStorageLimit(newImageSize: number): Promise<void> {
    const maxBytes = CLIPBOARD_LIMITS.MAX_IMAGE_STORAGE_MB * 1024 * 1024;
    let currentSize = await this.getStorageSize();

    if (currentSize + newImageSize <= maxBytes) {
      return;
    }

    // Get all images sorted by modification time (oldest first)
    const files = await fs.readdir(this.basePath);
    const imageFiles: { path: string; mtime: number; size: number }[] = [];

    for (const file of files) {
      if (file === 'thumbnails') continue;
      const filePath = path.join(this.basePath, file);
      const stat = await fs.stat(filePath);
      imageFiles.push({ path: filePath, mtime: stat.mtimeMs, size: stat.size });
    }

    // Sort oldest first
    imageFiles.sort((a, b) => a.mtime - b.mtime);

    // Delete oldest until we have space
    for (const file of imageFiles) {
      if (currentSize + newImageSize <= maxBytes) {
        break;
      }
      await this.deleteImage(file.path);
      currentSize -= file.size;
      console.log('Cleaned up old clipboard image:', file.path);
    }
  }

  /**
   * Clean up orphaned images (images not referenced by any entry)
   */
  async cleanupOrphanedImages(referencedPaths: Set<string>): Promise<void> {
    try {
      const files = await fs.readdir(this.basePath);

      for (const file of files) {
        if (file === 'thumbnails') continue;
        const filePath = path.join(this.basePath, file);
        if (!referencedPaths.has(filePath)) {
          await this.deleteImage(filePath);
          console.log('Cleaned up orphaned clipboard image:', filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned images:', error);
    }
  }

  /**
   * Get native image from stored file
   */
  getNativeImage(imagePath: string): NativeImage | null {
    try {
      if (!fsSync.existsSync(imagePath)) {
        return null;
      }
      return nativeImage.createFromPath(imagePath);
    } catch (error) {
      console.error('Failed to load native image:', error);
      return null;
    }
  }
}

export const clipboardImageStorage = new ClipboardImageStorage();
