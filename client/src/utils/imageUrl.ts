/**
 * Utility functions for handling image URLs and file IDs
 */

/**
 * Get the appropriate image URL - either from file ID or fallback to original URL
 * @param imageFileId - The UUID file ID for the image
 * @param fallbackUrl - The original URL to use if no file ID is available
 * @returns The URL to use for displaying the image
 */
export function getImageUrl(imageFileId?: string | null, fallbackUrl?: string | null): string | undefined {
  // If we have a file ID, use the file serving route
  if (imageFileId) {
    return `/images/${imageFileId}`;
  }
  
  // Otherwise, use the fallback URL (for backward compatibility)
  if (fallbackUrl) {
    return fallbackUrl;
  }
  
  return undefined;
}

/**
 * Get core image URL for a story
 */
export function getCoreImageUrl(story: { coreImageFileId?: string | null; coreImageUrl?: string | null }): string | undefined {
  return getImageUrl(story.coreImageFileId, story.coreImageUrl);
}

/**
 * Get character image URL
 */
export function getCharacterImageUrl(character: { imageFileId?: string | null; imageUrl?: string | null }): string | undefined {
  return getImageUrl(character.imageFileId, character.imageUrl);
}

/**
 * Get page image URL
 */
export function getPageImageUrl(page: { imageFileId?: string | null; imageUrl?: string | null }): string | undefined {
  return getImageUrl(page.imageFileId, page.imageUrl);
}