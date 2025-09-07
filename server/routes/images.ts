import { Router, Response } from 'express';
import { ImageStorageService } from '../storage/ImageStorageService';

const router = Router();
const imageStorage = new ImageStorageService();

/**
 * Serve images by UUID from file storage
 * GET /images/:fileId
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    // Check if the image exists
    const exists = await imageStorage.exists(fileId);
    if (!exists) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Retrieve the image
    const imageData = await imageStorage.retrieve(fileId);
    if (!imageData) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get metadata for caching headers
    const metadata = await imageStorage.getMetadata(fileId);
    
    // Set appropriate headers
    res.set({
      'Content-Type': imageData.mimeType,
      'Content-Length': imageData.buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      'ETag': `"${fileId}"`,
    });

    // Set filename for downloads
    if (metadata) {
      res.set('Content-Disposition', `inline; filename="${metadata.filename}"`);
    }

    // Send the image data
    res.send(imageData.buffer);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get image metadata by UUID
 * GET /images/:fileId/metadata
 */
router.get('/:fileId/metadata', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const metadata = await imageStorage.getMetadata(fileId);
    if (!metadata) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      fileId,
      ...metadata,
    });
  } catch (error) {
    console.error('Error getting image metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;