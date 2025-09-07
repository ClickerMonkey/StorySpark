import { FileStorageProvider, ImageMetadata } from './interfaces';
import { LocalFileStorage } from './LocalFileStorage';

export class ImageStorageService {
  private fileStorage: FileStorageProvider;

  constructor(fileStorage?: FileStorageProvider) {
    this.fileStorage = fileStorage || new LocalFileStorage();
  }

  /**
   * Download an image from a URL and store it in the file system
   */
  async downloadAndStore(
    imageUrl: string, 
    storyId: string, 
    imageType: 'core' | 'character' | 'page',
    customFilename?: string
  ): Promise<string> {
    try {
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';
      
      // Generate filename if not provided
      const filename = customFilename || this.generateFilename(imageType, contentType);
      
      // Store the file
      const fileId = await this.fileStorage.store(buffer, filename, contentType, storyId);
      
      return fileId;
    } catch (error) {
      console.error('Error downloading and storing image:', error);
      throw new Error(`Failed to download and store image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store an image buffer directly
   */
  async storeBuffer(
    buffer: Buffer,
    storyId: string,
    imageType: 'core' | 'character' | 'page',
    mimeType: string = 'image/png',
    customFilename?: string
  ): Promise<string> {
    const filename = customFilename || this.generateFilename(imageType, mimeType);
    return await this.fileStorage.store(buffer, filename, mimeType, storyId);
  }

  /**
   * Retrieve an image by file ID
   */
  async retrieve(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    return await this.fileStorage.retrieve(fileId);
  }

  /**
   * Delete an image by file ID
   */
  async delete(fileId: string): Promise<boolean> {
    return await this.fileStorage.delete(fileId);
  }

  /**
   * Check if an image exists
   */
  async exists(fileId: string): Promise<boolean> {
    return await this.fileStorage.exists(fileId);
  }

  /**
   * Get image metadata
   */
  async getMetadata(fileId: string): Promise<{ size: number; mimeType: string; filename: string; createdAt: Date } | null> {
    return await this.fileStorage.getMetadata(fileId);
  }

  /**
   * Generate a filename based on image type and content type
   */
  private generateFilename(imageType: string, mimeType: string): string {
    const extension = this.getExtensionFromMimeType(mimeType);
    const timestamp = Date.now();
    return `${imageType}_${timestamp}${extension}`;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    
    return mimeToExt[mimeType.toLowerCase()] || '.png';
  }

  /**
   * Clean up orphaned files (files not referenced in database)
   */
  async cleanup(referencedFileIds: string[]): Promise<{ deleted: number; errors: string[] }> {
    // This would need to be implemented based on the specific storage provider
    // For now, return a placeholder
    return { deleted: 0, errors: [] };
  }
}