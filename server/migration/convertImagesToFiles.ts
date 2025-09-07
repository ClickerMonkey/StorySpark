#!/usr/bin/env tsx

/**
 * Migration script to convert existing image URLs to file storage
 * This script downloads all existing images from URLs and stores them as files,
 * then updates the database with file IDs.
 */

import { storage } from '../storage';
import { ImageStorageService } from '../storage/ImageStorageService';

async function migrateImagesToFiles() {
  console.log('🔄 Starting image migration to file storage...');
  
  const imageStorage = new ImageStorageService();
  let migratedCount = 0;
  let errorCount = 0;

  try {
    // Get all stories
    const stories = await storage.getAllStories();
    console.log(`📚 Found ${stories.length} stories to process`);

    for (const story of stories) {
      console.log(`\n📖 Processing story: ${story.title} (${story.id})`);
      
      // Migrate core image
      if (story.coreImageUrl && !story.coreImageFileId) {
        try {
          console.log('  🖼️  Migrating core image...');
          const coreImageFileId = await imageStorage.downloadAndStore(
            story.coreImageUrl,
            story.id,
            'core',
            'core_image_migrated'
          );
          
          await storage.updateStoryCoreImageFileId(story.id, coreImageFileId);
          console.log(`  ✅ Core image migrated: ${coreImageFileId}`);
          migratedCount++;
        } catch (error) {
          console.error(`  ❌ Failed to migrate core image:`, error);
          errorCount++;
        }
      }

      // Migrate character images
      if (story.extractedCharacters && story.extractedCharacters.length > 0) {
        for (const character of story.extractedCharacters) {
          if (character.imageUrl && !character.imageFileId) {
            try {
              console.log(`  👤 Migrating character image: ${character.name}...`);
              const characterImageFileId = await imageStorage.downloadAndStore(
                character.imageUrl,
                story.id,
                'character',
                `${character.name.toLowerCase().replace(/\s+/g, '_')}_character_migrated`
              );
              
              await storage.updateCharacterImageFileId(story.id, character.name, characterImageFileId);
              console.log(`  ✅ Character image migrated: ${characterImageFileId}`);
              migratedCount++;
            } catch (error) {
              console.error(`  ❌ Failed to migrate character image for ${character.name}:`, error);
              errorCount++;
            }
          }
        }
      }

      // Migrate page images
      if (story.pages && story.pages.length > 0) {
        for (const page of story.pages) {
          if (page.imageUrl && !page.imageFileId) {
            try {
              console.log(`  📄 Migrating page ${page.pageNumber} image...`);
              const pageImageFileId = await imageStorage.downloadAndStore(
                page.imageUrl,
                story.id,
                'page',
                `page_${page.pageNumber}_migrated`
              );
              
              await storage.updateStoryPageImageFileId(story.id, page.pageNumber, pageImageFileId);
              console.log(`  ✅ Page ${page.pageNumber} image migrated: ${pageImageFileId}`);
              migratedCount++;
            } catch (error) {
              console.error(`  ❌ Failed to migrate page ${page.pageNumber} image:`, error);
              errorCount++;
            }
          }
        }
      }

      // Add a small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${migratedCount} images`);
    console.log(`❌ Errors encountered: ${errorCount} images`);
    
    if (errorCount > 0) {
      console.log(`\n⚠️  Some images failed to migrate. Check the error messages above for details.`);
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Helper function to check migration status
async function checkMigrationStatus() {
  const stories = await storage.getAllStories();
  let totalImages = 0;
  let migratedImages = 0;

  for (const story of stories) {
    // Count core images
    if (story.coreImageUrl) {
      totalImages++;
      if (story.coreImageFileId) migratedImages++;
    }

    // Count character images
    if (story.extractedCharacters) {
      for (const character of story.extractedCharacters) {
        if (character.imageUrl) {
          totalImages++;
          if (character.imageFileId) migratedImages++;
        }
      }
    }

    // Count page images
    if (story.pages) {
      for (const page of story.pages) {
        if (page.imageUrl) {
          totalImages++;
          if (page.imageFileId) migratedImages++;
        }
      }
    }
  }

  console.log(`📊 Migration Status:`);
  console.log(`   Total images: ${totalImages}`);
  console.log(`   Migrated: ${migratedImages}`);
  console.log(`   Remaining: ${totalImages - migratedImages}`);
  console.log(`   Progress: ${totalImages > 0 ? Math.round((migratedImages / totalImages) * 100) : 0}%`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    await checkMigrationStatus();
  } else {
    await migrateImagesToFiles();
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { migrateImagesToFiles, checkMigrationStatus };