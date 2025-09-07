import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { FileStorageProvider } from './interfaces';

export class LocalFileStorage implements FileStorageProvider {
  private basePath: string;

  constructor(basePath: string = './storage/images') {
    this.basePath = basePath;
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private getFilePath(fileId: string, storyId: string): string {
    const storyDir = path.join(this.basePath, storyId);
    return path.join(storyDir, fileId);
  }

  private getMetadataPath(fileId: string, storyId: string): string {
    const storyDir = path.join(this.basePath, storyId);
    return path.join(storyDir, `${fileId}.meta.json`);
  }

  async store(buffer: Buffer, filename: string, mimeType: string, storyId: string): Promise<string> {
    const fileId = randomUUID();
    const storyDir = path.join(this.basePath, storyId);
    
    await this.ensureDirectory(storyDir);
    
    const filePath = this.getFilePath(fileId, storyId);
    const metadataPath = this.getMetadataPath(fileId, storyId);
    
    // Store the file
    await fs.writeFile(filePath, buffer);
    
    // Store metadata
    const metadata = {
      filename,
      mimeType,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    return fileId;
  }

  async retrieve(fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    try {
      // First, find which story directory contains this fileId
      const storyDirs = await fs.readdir(this.basePath);
      
      for (const storyId of storyDirs) {
        const filePath = this.getFilePath(fileId, storyId);
        const metadataPath = this.getMetadataPath(fileId, storyId);
        
        try {
          const [buffer, metadataStr] = await Promise.all([
            fs.readFile(filePath),
            fs.readFile(metadataPath, 'utf-8')
          ]);
          
          const metadata = JSON.parse(metadataStr);
          
          return {
            buffer,
            mimeType: metadata.mimeType,
            filename: metadata.filename,
          };
        } catch {
          // File not in this story directory, continue searching
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving file:', error);
      return null;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      // Find and delete from all story directories
      const storyDirs = await fs.readdir(this.basePath);
      let deleted = false;
      
      for (const storyId of storyDirs) {
        const filePath = this.getFilePath(fileId, storyId);
        const metadataPath = this.getMetadataPath(fileId, storyId);
        
        try {
          await Promise.all([
            fs.unlink(filePath),
            fs.unlink(metadataPath)
          ]);
          deleted = true;
        } catch {
          // File not in this directory, continue
          continue;
        }
      }
      
      return deleted;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      const storyDirs = await fs.readdir(this.basePath);
      
      for (const storyId of storyDirs) {
        const filePath = this.getFilePath(fileId, storyId);
        try {
          await fs.access(filePath);
          return true;
        } catch {
          continue;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  async getMetadata(fileId: string): Promise<{ size: number; mimeType: string; filename: string; createdAt: Date } | null> {
    try {
      const storyDirs = await fs.readdir(this.basePath);
      
      for (const storyId of storyDirs) {
        const metadataPath = this.getMetadataPath(fileId, storyId);
        
        try {
          const metadataStr = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataStr);
          
          return {
            size: metadata.size,
            mimeType: metadata.mimeType,
            filename: metadata.filename,
            createdAt: new Date(metadata.createdAt),
          };
        } catch {
          continue;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}