import { Story, StoryPage, Character, User } from "@shared/schema";
import { ReplicateService } from "./replicate";
import { ImagePromptGenerator } from "./imagePromptGenerator";
import { generateCoreImage as openaiGenerateCoreImage, generatePageImage as openaiGeneratePageImage } from "./openai";
import { ImageStorageService } from "../storage/ImageStorageService";
import { storage } from "../storage";

export interface CoreImageGenerationOptions {
  customPrompt?: string;
  useCurrentImageAsReference?: boolean;
  customModel?: string;
  customInput?: Record<string, any>;
}

export interface PageImageGenerationOptions {
  customPrompt?: string;
  useCurrentImageAsReference?: boolean;
  customModel?: string;
  customInput?: Record<string, any>;
}

export interface ImageGenerationResult {
  fileId: string;
}

/**
 * Service for handling all image generation operations
 * Consolidates OpenAI and Replicate logic to avoid duplication
 */
export class ImageGenerationService {
  private imageStorage: ImageStorageService;

  constructor() {
    this.imageStorage = new ImageStorageService();
  }

  /**
   * Generate or regenerate a core image with full customization options
   */
  async generateCoreImage(
    story: Story,
    user: User,
    options: CoreImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    const preferredProvider = user.preferredImageProvider || "openai";
    let imageUrl: string;

    if (preferredProvider === "replicate") {
      imageUrl = await this.generateCoreImageWithReplicate(story, user, options);
    } else {
      imageUrl = await this.generateCoreImageWithOpenAI(story, user, options);
    }

    // Store image as file
    const fileId = await this.imageStorage.downloadAndStore(imageUrl, story.id, 'core');
    
    return { fileId };
  }

  /**
   * Generate or regenerate a page image with full customization options
   */
  async generatePageImage(
    story: Story,
    page: StoryPage,
    user: User,
    options: PageImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    const preferredProvider = user.preferredImageProvider || "openai";
    let imageUrl: string;

    if (preferredProvider === "replicate") {
      imageUrl = await this.generatePageImageWithReplicate(story, page, user, options);
    } else {
      imageUrl = await this.generatePageImageWithOpenAI(story, page, user, options);
    }

    // Store image as file
    const fileId = await this.imageStorage.downloadAndStore(
      imageUrl, 
      story.id, 
      'page', 
      `page_${page.pageNumber}`
    );
    
    return { fileId };
  }

  /**
   * Generate all images for a story (core + all pages) - for initial creation
   */
  async generateStoryImages(story: Story, user: User): Promise<void> {
    try {
      console.log(`Starting image generation for story ${story.id}`);
      
      // Generate core image first
      const coreResult = await this.generateCoreImage(story, user);
      
      // Update story with core image
      await storage.updateStoryCoreImageFileId(story.id, coreResult.fileId);
      console.log(`Core image generated and stored for story ${story.id}`);

      // Generate all page images in parallel for efficiency
      const pageImagePromises = story.pages.map(async (page, index) => {
        console.log(`Generating image for page ${page.pageNumber}`);
        
        const pageResult = await this.generatePageImage(story, page, user);
        
        // Update the specific page with the new file ID only
        await storage.updateStoryPageImageFileId(story.id, page.pageNumber, pageResult.fileId);
        
        console.log(`Page ${page.pageNumber} image generated and stored`);
        return { pageNumber: page.pageNumber, fileId: pageResult.fileId };
      });

      // Wait for all page images to complete
      await Promise.all(pageImagePromises);

      // Mark story as complete with images
      await storage.updateStoryStatus(story.id, "complete");
      console.log(`All images generated for story ${story.id}`);
      
    } catch (error) {
      console.error(`Error in image generation for story ${story.id}:`, error);
      // Update story status to indicate error
      await storage.updateStoryStatus(story.id, "text_approved");
      throw error;
    }
  }

  /**
   * Regenerate only page images (not core image) - for bulk page regeneration
   */
  async regenerateAllPageImages(story: Story, user: User): Promise<void> {
    try {
      console.log(`Starting page image regeneration for story ${story.id}`);
      
      // Regenerate all page images in parallel for efficiency
      const pageImagePromises = story.pages.map(async (page, index) => {
        console.log(`Regenerating image for page ${page.pageNumber}`);
        
        const pageResult = await this.generatePageImage(story, page, user);
        
        // Update the specific page with the new file ID only
        await storage.updateStoryPageImageFileId(story.id, page.pageNumber, pageResult.fileId);
        
        console.log(`Page ${page.pageNumber} image regenerated and stored`);
        return { pageNumber: page.pageNumber, fileId: pageResult.fileId };
      });

      // Wait for all page images to complete
      await Promise.all(pageImagePromises);

      // Mark story as complete with images
      await storage.updateStoryStatus(story.id, "complete");
      console.log(`All page images regenerated for story ${story.id}`);
      
    } catch (error) {
      console.error(`Error in page image regeneration for story ${story.id}:`, error);
      // Update story status to indicate error
      await storage.updateStoryStatus(story.id, "text_approved");
      throw error;
    }
  }

  /**
   * Generate all images for a story - comprehensive method that handles the /generate-images endpoint
   * This replaces the route logic entirely
   */
  async generateAllImages(story: Story, user: User): Promise<Story> {
    try {
      console.log(`Starting comprehensive image generation for story ${story.id}`);
      
      // Update story status to generating images
      await storage.updateStoryStatus(story.id, "generating_images");
      
      // Generate core image first
      const coreResult = await this.generateCoreImage(story, user);
      
      // Update story with core image file ID  
      await storage.updateStoryCoreImageFileId(story.id, coreResult.fileId);
      console.log(`Core image generated and stored for story ${story.id}`);

      // Generate all page images in parallel for efficiency
      const pageImagePromises = story.pages.map(async (page, index) => {
        console.log(`Generating image for page ${page.pageNumber}`);
        
        const pageResult = await this.generatePageImage(story, page, user);
        
        console.log(`Page ${page.pageNumber} image generated and stored`);
        return { pageNumber: page.pageNumber, fileId: pageResult.fileId };
      });

      // Wait for all page images to complete
      const pageResults = await Promise.all(pageImagePromises);

      // Update all pages with their image file IDs
      for (const result of pageResults) {
        await storage.updateStoryPageImageFileId(story.id, result.pageNumber, result.fileId);
      }

      // Mark story as complete with images
      await storage.updateStoryStatus(story.id, "complete");
      console.log(`All images generated for story ${story.id}`);
      
      // Return updated story
      const updatedStory = await storage.getStory(story.id);
      if (!updatedStory) {
        throw new Error("Story not found after update");
      }
      return updatedStory;
      
    } catch (error) {
      console.error(`Error in comprehensive image generation for story ${story.id}:`, error);
      // Update story status to indicate error
      await storage.updateStoryStatus(story.id, "text_approved");
      throw error;
    }
  }

  /**
   * Regenerate a single core image - comprehensive method that handles the /regenerate-core-image endpoint
   * This replaces the route logic entirely
   */
  async regenerateCoreImageForEndpoint(
    story: Story, 
    user: User, 
    options: CoreImageGenerationOptions = {}
  ): Promise<Story> {
    try {
      console.log(`Starting core image regeneration for story ${story.id}`);
      
      const result = await this.generateCoreImage(story, user, options);
      
      // Update story with new core image file ID
      await storage.updateStoryCoreImageFileId(story.id, result.fileId);
      
      // Return updated story
      const updatedStory = await storage.getStory(story.id);
      if (!updatedStory) {
        throw new Error("Story not found after update");
      }
      return updatedStory;
      
    } catch (error) {
      console.error(`Error in core image regeneration for story ${story.id}:`, error);
      throw error;
    }
  }

  /**
   * Regenerate a single page image - comprehensive method that handles the /regenerate-page-image endpoint
   * This replaces the route logic entirely and includes all the complex prompt handling
   */
  async regeneratePageImageForEndpoint(
    story: Story,
    pageNumber: number,
    user: User,
    options: PageImageGenerationOptions & {
      currentImageUrl?: string;
    } = {}
  ): Promise<Story> {
    try {
      console.log(`Starting page image regeneration for story ${story.id}, page ${pageNumber}`);
      
      const page = story.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        throw new Error("Page not found");
      }

      // No longer need to track previous page URLs since we're not storing them

      // Enhanced prompt for regeneration with strong consistency requirements
      let finalCustomPrompt = options.customPrompt;
      if (options.currentImageUrl) {
        const referenceText = `\n\nCRITICAL REGENERATION INSTRUCTIONS:
- You are regenerating an existing page image that must maintain PERFECT visual consistency with both the core story image AND the current page image
- The core story image establishes the character designs, art style, and visual world that must be preserved
- The current page image shows the exact composition and elements that should be kept while making requested modifications
- Make ONLY the specific changes requested while preserving all other visual elements exactly as they appear
- Character faces, clothing, proportions, and distinctive features must remain IDENTICAL
- Background elements, lighting, and overall composition should stay consistent unless explicitly requested to change
- This is a modification of an existing image, NOT a complete recreation`;

        if (finalCustomPrompt) {
          finalCustomPrompt = finalCustomPrompt + referenceText;
        }
      }

      // Generate the page image with all options
      const pageResult = await this.generatePageImage(story, page, user, {
        ...options,
        customPrompt: finalCustomPrompt
      });

      // Update the specific page with the new image
      await storage.updateStoryPageImageFileId(story.id, pageNumber, pageResult.fileId);
      
      // Return updated story
      const updatedStory = await storage.getStory(story.id);
      if (!updatedStory) {
        throw new Error("Story not found after update");
      }
      return updatedStory;
      
    } catch (error) {
      console.error(`Error in page image regeneration for story ${story.id}, page ${pageNumber}:`, error);
      throw error;
    }
  }

  // Private helper methods for provider-specific generation

  private async generateCoreImageWithReplicate(
    story: Story,
    user: User,
    options: CoreImageGenerationOptions
  ): Promise<string> {
    const replicateService = new ReplicateService(user.replicateApiKey!);
    
    let prompt: string;
    // Always generate the base story prompt first
    const promptGenerator = new ImagePromptGenerator(user.openaiApiKey!, user.openaiBaseUrl || undefined);
    const basePrompt = await promptGenerator.generateCoreImagePrompt(story);
    
    if (options.customPrompt) {
      // Make custom prompt additive to the base story context
      prompt = `${basePrompt}\n\nAdditional style/modification request: ${options.customPrompt}`;
    } else {
      prompt = basePrompt;
    }

    // Determine model to use
    let modelId = options.customModel || user.preferredReplicateModel || "black-forest-labs/flux-schnell";
    // Fallback to working model if user has invalid model set
    if (modelId === "prunaai/flux-kontext-dev") {
      modelId = "black-forest-labs/flux-schnell";
    }
    
    // Check if user has a template for this model
    const userTemplates = user.replicateModelTemplates || [];
    const template = userTemplates.find((t: any) => t.modelId === modelId);
    
    if (template && options.customInput) {
      // Use intelligent template-based generation with custom input
      return await replicateService.generateImageWithTemplate(template, prompt, {
        customInput: options.customInput,
        storyContext: story
      });
    } else if (template) {
      // Use intelligent template-based generation
      return await replicateService.generateImageWithTemplate(template, prompt);
    } else {
      // Use basic model without template
      return await replicateService.generateImage(modelId, prompt);
    }
  }

  private async generateCoreImageWithOpenAI(
    story: Story,
    user: User,
    options: CoreImageGenerationOptions
  ): Promise<string> {
    if (options.customPrompt) {
      // Use custom prompt for regeneration
      const { regenerateCoreImage } = await import("./openai");
      return await regenerateCoreImage(
        story.expandedSetting || story.setting || "",
        story.extractedCharacters || [],
        options.customPrompt,
        options.useCurrentImageAsReference || false,
        user.openaiApiKey!,
        user.openaiBaseUrl || undefined,
        story.coreImageUrl || undefined
      );
    } else {
      // Use standard generation
      const coreImagePrompt = `Create a vibrant, child-friendly illustration for this story:

Title: ${story.title}
Setting: ${story.expandedSetting || story.setting}
Characters: ${story.extractedCharacters?.map((c: any) => `${c.name}: ${c.description}`).join(', ') || story.characters}
Age Group: ${story.ageGroup}

Style: Bright, colorful, safe for children, storybook illustration style. Make it magical and engaging for kids aged ${story.ageGroup}.`;

      return await openaiGenerateCoreImage(
        coreImagePrompt,
        [],
        user.openaiApiKey!,
        user.openaiBaseUrl || undefined
      );
    }
  }

  private async generatePageImageWithReplicate(
    story: Story,
    page: StoryPage,
    user: User,
    options: PageImageGenerationOptions
  ): Promise<string> {
    const replicateService = new ReplicateService(user.replicateApiKey!);
    
    let prompt: string;
    if (options.customPrompt) {
      prompt = options.customPrompt;
    } else {
      // Generate optimized page image prompt using LLM
      const promptGenerator = new ImagePromptGenerator(user.openaiApiKey!, user.openaiBaseUrl || undefined);
      prompt = await promptGenerator.generateImagePrompt(story, page);
    }

    // Determine model to use
    let modelId = options.customModel || user.preferredReplicateModel || "black-forest-labs/flux-schnell";
    // Fallback to working model if user has invalid model set
    if (modelId === "prunaai/flux-kontext-dev") {
      modelId = "black-forest-labs/flux-schnell";
    }
    
    // Check if user has a template for this model
    const userTemplates = user.replicateModelTemplates || [];
    const template = userTemplates.find((t: any) => t.modelId === modelId);
    
    if (template && options.customInput) {
      // Use intelligent template-based generation with custom input
      return await replicateService.generateImageWithTemplate(template, prompt, {
        customInput: options.customInput,
        storyContext: story
      });
    } else if (template) {
      // Use intelligent template-based generation with core image for consistency
      let defaultInput = {};
      
      if (story.coreImageFileId && template.imageFields && template.imageFields.length > 0) {
        // Use the first image field from the template
        const firstImageField = template.imageFields[0];
        const isArrayField = template.imageArrayFields?.includes(firstImageField);
        
        if (isArrayField) {
          // Array field - include core image in array format
          defaultInput[firstImageField] = [{ imageId: 'core' }];
        } else {
          // Single image field - include core image as single value
          defaultInput[firstImageField] = { imageId: 'core' };
        }
      }
      
      return await replicateService.generateImageWithTemplate(template, prompt, {
        customInput: defaultInput,
        storyContext: story
      });
    } else {
      // Use basic model without template
      return await replicateService.generateImage(modelId, prompt);
    }
  }

  private async generatePageImageWithOpenAI(
    story: Story,
    page: StoryPage,
    user: User,
    options: PageImageGenerationOptions
  ): Promise<string> {
    // Use the generatePageImage function which accepts custom prompts
    return await openaiGeneratePageImage(
      page.text,
      "", // No longer storing/using core image URLs
      "", // No longer storing/using previous page URLs
      story.expandedSetting || story.setting || undefined,
      story.extractedCharacters || [],
      user.openaiApiKey!,
      user.openaiBaseUrl || undefined,
      options.customPrompt, // custom prompt if provided
      story.title + " " + story.plot,
      story.storyGuidance || undefined,
      page.imageGuidance || undefined
    );
  }
}