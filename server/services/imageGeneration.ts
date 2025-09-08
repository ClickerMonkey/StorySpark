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
  previousPageImageUrl?: string;
  coreImageUrl?: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
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
    
    return { imageUrl, fileId };
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
    
    return { imageUrl, fileId };
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
        
        // Get previous page image URL for continuity if needed
        const previousPage = index > 0 ? story.pages[index - 1] : null;
        const previousPageImageUrl = previousPage?.imageUrl;
        
        const pageResult = await this.generatePageImage(story, page, user, {
          previousPageImageUrl,
          coreImageUrl: coreResult.imageUrl
        });
        
        // Update the specific page with the new image
        await storage.updateStoryPageImage(story.id, page.pageNumber, pageResult.imageUrl, pageResult.fileId);
        
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
      
      // Get existing core image URL for reference
      const coreImageUrl = story.coreImageUrl || "";
      
      // Regenerate all page images in parallel for efficiency
      const pageImagePromises = story.pages.map(async (page, index) => {
        console.log(`Regenerating image for page ${page.pageNumber}`);
        
        // Get previous page image URL for continuity if needed
        const previousPage = index > 0 ? story.pages[index - 1] : null;
        const previousPageImageUrl = previousPage?.imageUrl;
        
        const pageResult = await this.generatePageImage(story, page, user, {
          previousPageImageUrl,
          coreImageUrl
        });
        
        // Update the specific page with the new image
        await storage.updateStoryPageImage(story.id, page.pageNumber, pageResult.imageUrl, pageResult.fileId);
        
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

  // Private helper methods for provider-specific generation

  private async generateCoreImageWithReplicate(
    story: Story,
    user: User,
    options: CoreImageGenerationOptions
  ): Promise<string> {
    const replicateService = new ReplicateService(user.replicateApiKey!);
    
    let prompt: string;
    if (options.customPrompt) {
      prompt = options.customPrompt;
    } else {
      // Generate optimized core image prompt using LLM
      const promptGenerator = new ImagePromptGenerator(user.openaiApiKey!, user.openaiBaseUrl || undefined);
      prompt = await promptGenerator.generateCoreImagePrompt(story);
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
      return await replicateService.generateImageWithTemplate(template, prompt, options.customInput);
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
      return await replicateService.generateImageWithTemplate(template, prompt, options.customInput);
    } else if (template) {
      // Use intelligent template-based generation
      return await replicateService.generateImageWithTemplate(template, prompt);
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
      options.coreImageUrl || "",
      options.previousPageImageUrl || "",
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