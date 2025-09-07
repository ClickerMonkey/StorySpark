import { FileStorageProvider, ImageMetadata } from './interfaces';
import { LocalFileStorage } from './LocalFileStorage';

export class ImageStorageService {
  private fileStorage: FileStorageProvider;

  constructor(fileStorage?: FileStorageProvider) {
    this.fileStorage = fileStorage || new LocalFileStorage();
  }

  /**
   * Download an image from a URL or process base64 data and store it in the file system
   */
  async downloadAndStore(
    imageUrl: string, 
    storyId: string, 
    imageType: 'core' | 'character' | 'page',
    customFilename?: string
  ): Promise<string> {
    try {
      console.log('ImageStorageService.downloadAndStore - Received imageUrl:', imageUrl?.length > 128 ? imageUrl.substring(0, 128) + '...' : imageUrl);
      console.log('ImageStorageService.downloadAndStore - imageUrl type:', typeof imageUrl);
      console.log('ImageStorageService.downloadAndStore - imageUrl length:', imageUrl.length);
      
      // Validate input
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid imageUrl: must be a non-empty string');
      }

      let buffer: Buffer;
      let contentType: string;

      if (imageUrl.startsWith('data:')) {
        // Handle base64 data URL
        console.log('Processing base64 data URL');
        
        const dataUrlMatch = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!dataUrlMatch) {
          throw new Error('Invalid base64 data URL format');
        }
        
        contentType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];
        
        console.log('Base64 data - MIME type:', contentType);
        console.log('Base64 data - length:', base64Data.length);
        
        try {
          buffer = Buffer.from(base64Data, 'base64');
          console.log('Successfully decoded base64 data, buffer size:', buffer.length);
        } catch (decodeError) {
          console.error('Failed to decode base64 data:', decodeError);
          throw new Error('Invalid base64 data encoding');
        }
        
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // Handle HTTP/HTTPS URL
        console.log('Downloading from HTTP/HTTPS URL');
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        buffer = Buffer.from(await response.arrayBuffer());
        contentType = response.headers.get('content-type') || 'image/png';
        
        console.log('Successfully downloaded from URL, buffer size:', buffer.length);
        console.log('Content type from response:', contentType);
        
      } else {
        console.error('Invalid URL format. Expected HTTP/HTTPS URL or base64 data URL, got:', imageUrl.substring(0, 100) + '...');
        throw new Error(`Invalid URL format. Expected HTTP/HTTPS URL or base64 data URL, got: ${imageUrl.substring(0, 100)}...`);
      }
      
      // Generate filename if not provided
      const filename = customFilename || this.generateFilename(imageType, contentType);
      console.log('Generated filename:', filename);
      
      // Store the file
      const fileId = await this.fileStorage.store(buffer, filename, contentType, storyId);
      console.log('Successfully stored file with ID:', fileId);
      
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