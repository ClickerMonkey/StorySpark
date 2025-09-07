export interface FileStorageProvider {
  /**
   * Store a file and return a unique identifier
   */
  store(buffer: Buffer, filename: string, mimeType: string, storyId: string): Promise<string>;
  
  /**
   * Retrieve a file by its unique identifier
   */
  retrieve(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null>;
  
  /**
   * Delete a file by its unique identifier
   */
  delete(fileId: string): Promise<boolean>;
  
  /**
   * Check if a file exists
   */
  exists(fileId: string): Promise<boolean>;
  
  /**
   * Get file metadata
   */
  getMetadata(fileId: string): Promise<{ size: number; mimeType: string; filename: string; createdAt: Date } | null>;
}

export interface ImageMetadata {
  fileId: string;
  originalUrl?: string;
  filename: string;
  mimeType: string;
  size: number;
  storyId: string;
  imageType: 'core' | 'character' | 'page';
  createdAt: Date;
}