import type { Express } from "express";
import { createServer, type Server } from "http";
import imageRoutes from './routes/images';
import { storage } from "./storage";
import { generateStoryText, generateCoreImage, generatePageImage, expandSetting, extractCharacters, generateCharacterImage, regenerateCoreImage, generateStoryIdea } from "./services/openai";
import { ReplicateService } from "./services/replicate";
import { ImageStorageService } from "./storage/ImageStorageService";
import { createStorySchema, approveStorySchema, approveSettingSchema, approveCharactersSchema, regenerateImageSchema, regenerateCoreImageSchema, createRevisionSchema, updateUserProfileSchema } from "@shared/schema";
import { verifyGoogleToken, generateJWT, requireAuth, optionalAuth, type AuthenticatedRequest } from "./auth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register image serving routes
  app.use('/images', imageRoutes);
  
  // Get client configuration
  app.get("/api/config", (req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID
    });
  });

  // Development test login route
  app.post("/api/auth/test-login", async (req, res) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: "Test login only available in development" });
      }

      const { testCredential } = req.body;
      const payload = JSON.parse(atob(testCredential));
      
      const googleUser = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        profileImageUrl: payload.picture,
      };
      
      const user = await storage.upsertUser(googleUser);
      const jwt = generateJWT(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          openaiApiKey: user.openaiApiKey,
          openaiBaseUrl: user.openaiBaseUrl,
        },
        token: jwt
      });
    } catch (error) {
      console.error("Test auth error:", error);
      res.status(400).json({ message: "Test login failed" });
    }
  });

  // Serve stored files by file ID  
  app.get("/api/files/:fileId", async (req, res) => {
    try {
      const imageStorage = new ImageStorageService();
      const fileData = await imageStorage.retrieve(req.params.fileId);
      
      if (!fileData) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.set({
        'Content-Type': fileData.mimeType,
        'Content-Length': fileData.buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      });
      
      res.send(fileData.buffer);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Google OAuth callback route
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, error } = req.query;
      
      if (error) {
        console.error('Google OAuth error:', error);
        return res.redirect(`/auth/google/callback?error=${encodeURIComponent(error as string)}`);
      }

      if (!code) {
        return res.redirect('/auth/google/callback?error=no_authorization_code');
      }

      // Exchange the authorization code for tokens
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      
      // Use the same redirect URI that was used in the initial OAuth request
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
      
      const tokenParams = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Google token exchange error:', errorData);
        return res.redirect('/auth/google/callback?error=token_exchange_failed');
      }

      const tokenData = await tokenResponse.json();
      
      // Verify the ID token
      const googleUser = await verifyGoogleToken(tokenData.id_token);
      const user = await storage.upsertUser(googleUser);
      const jwt = generateJWT(user.id);

      // Redirect to client callback with success data
      const params = new URLSearchParams({
        token: jwt,
        user: JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          openaiApiKey: user.openaiApiKey,
          openaiBaseUrl: user.openaiBaseUrl,
        })
      });
      
      res.redirect(`/auth/google/callback?${params.toString()}`);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect('/auth/google/callback?error=oauth_callback_failed');
    }
  });

  // Auth routes
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Google token is required" });
      }

      const googleUser = await verifyGoogleToken(token);
      const user = await storage.upsertUser(googleUser);
      const jwt = generateJWT(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          openaiApiKey: user.openaiApiKey,
          openaiBaseUrl: user.openaiBaseUrl,
        },
        token: jwt
      });
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(401).json({ message: "Invalid Google token" });
    }
  });

  app.get("/api/auth/user", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Fetch the complete user data from storage to ensure all fields are included
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          openaiApiKey: user.openaiApiKey,
          openaiBaseUrl: user.openaiBaseUrl,
          replicateApiKey: user.replicateApiKey,
          preferredImageProvider: user.preferredImageProvider,
          preferredReplicateModel: user.preferredReplicateModel,
        }
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/setup-openai", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { openaiApiKey, openaiBaseUrl } = req.body;
      if (!openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key is required" });
      }

      const updatedUser = await storage.updateUserOpenAI(req.user!.id, openaiApiKey, openaiBaseUrl);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          profileImageUrl: updatedUser.profileImageUrl,
          openaiApiKey: updatedUser.openaiApiKey,
          openaiBaseUrl: updatedUser.openaiBaseUrl,
        }
      });
    } catch (error) {
      console.error("Setup OpenAI error:", error);
      res.status(500).json({ message: "Failed to update OpenAI settings" });
    }
  });

  // Update user profile (Replicate API key, preferences)
  app.patch("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = updateUserProfileSchema.parse(req.body);
      const updatedUser = await storage.updateUserProfile(req.user!.id, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          profileImageUrl: updatedUser.profileImageUrl,
          openaiApiKey: updatedUser.openaiApiKey,
          openaiBaseUrl: updatedUser.openaiBaseUrl,
          replicateApiKey: updatedUser.replicateApiKey,
          preferredImageProvider: updatedUser.preferredImageProvider,
          preferredReplicateModel: updatedUser.preferredReplicateModel,
        }
      });
    } catch (error) {
      console.error("Update profile error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update profile" });
      }
    }
  });

  // Search Replicate models
  app.get("/api/replicate/models", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { q: query, limit = "20" } = req.query;
      
      if (!req.user?.replicateApiKey) {
        return res.status(400).json({ message: "Replicate API key required" });
      }

      const replicateService = new ReplicateService(req.user.replicateApiKey);
      
      if (query && typeof query === 'string') {
        const models = await replicateService.searchModels(query, parseInt(limit as string));
        res.json({ models });
      } else {
        const models = await replicateService.getPopularImageModels();
        res.json({ models });
      }
    } catch (error) {
      console.error("Search models error:", error);
      res.status(500).json({ message: "Failed to search models" });
    }
  });

  // Analyze Replicate model schema with LLM
  app.post("/api/replicate/analyze-model", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { modelId } = req.body;
      
      if (!modelId || typeof modelId !== 'string') {
        return res.status(400).json({ message: "Model ID is required" });
      }

      if (!req.user?.replicateApiKey) {
        return res.status(400).json({ message: "Replicate API key required" });
      }

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required for schema analysis" });
      }

      // Get model schema from Replicate
      const replicateService = new ReplicateService(req.user.replicateApiKey);
      const modelSchema = await replicateService.getModelSchema(modelId);

      // Analyze schema with LLM
      const { ModelSchemaAnalyzer } = await import('./services/ModelSchemaAnalyzer');
      const analyzer = new ModelSchemaAnalyzer(req.user.openaiApiKey, req.user.openaiBaseUrl);
      const template = await analyzer.analyzeModelSchema(modelSchema);

      res.json({ template });
    } catch (error) {
      console.error("Model schema analysis error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to analyze model schema" 
      });
    }
  });

  // Save Replicate model template
  app.post("/api/replicate/save-template", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { template } = req.body;
      
      if (!template || !template.modelId) {
        return res.status(400).json({ message: "Valid template is required" });
      }

      // Handle delete operation
      if (template.delete) {
        const user = await storage.getUserById(req.user!.id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const templates = user.replicateModelTemplates || [];
        const filteredTemplates = templates.filter((t: any) => t.modelId !== template.modelId);
        
        await storage.updateUser(req.user!.id, { replicateModelTemplates: filteredTemplates });
        return res.json({ message: "Template deleted successfully" });
      }

      // Get current user templates for save/update
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const templates = user.replicateModelTemplates || [];
      const existingIndex = templates.findIndex((t: any) => t.modelId === template.modelId);

      if (existingIndex >= 0) {
        // Update existing template
        templates[existingIndex] = template;
      } else {
        // Add new template
        templates.push(template);
      }

      // Update user with new templates
      await storage.updateUser(req.user!.id, { replicateModelTemplates: templates });
      
      console.log(`Template saved for user ${req.user!.id}: ${template.modelId}`, { templateCount: templates.length });

      res.json({ template, message: "Template saved successfully" });
    } catch (error) {
      console.error("Save template error:", error);
      res.status(500).json({ message: "Failed to save template" });
    }
  });

  // Get user's Replicate model templates
  app.get("/api/replicate/templates", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user.replicateModelTemplates || []);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  // Generate story idea
  app.post("/api/generate-story-idea", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { ageGroup } = req.body;
      
      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required. Please configure it in your settings." });
      }

      const storyIdea = await generateStoryIdea(
        ageGroup,
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );

      res.json(storyIdea);
    } catch (error) {
      console.error("Error generating story idea:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate story idea" });
    }
  });

  // Story routes
  app.post("/api/stories", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const storyData = createStorySchema.parse(req.body);
      
      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required. Please configure it in your settings." });
      }

      const story = await storage.createStory({
        userId: req.user.id,
        ...storyData,
        status: "draft"
      });

      res.status(201).json(story);
    } catch (error) {
      console.error("Error creating story:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid story data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create story" });
      }
    }
  });

  app.get("/api/stories", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stories = await storage.getUserStories(req.user!.id);
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  app.get("/api/stories/:id", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // Check if user owns the story (for private stories in the future)
      if (req.user && story.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(story);
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({ message: "Failed to fetch story" });
    }
  });

  app.post("/api/stories/:id/expand-setting", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      const expandedSetting = await expandSetting(
        story.setting,
        story.characters,
        story.plot,
        story.ageGroup,
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );

      const updatedStory = await storage.updateStoryExpandedSetting(story.id, expandedSetting);
      res.json({ expandedSetting, story: updatedStory });
    } catch (error) {
      console.error("Error expanding setting:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to expand setting" });
    }
  });

  app.post("/api/stories/:id/approve-setting", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId, expandedSetting } = approveSettingSchema.parse({
        storyId: req.params.id,
        ...req.body
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.updateStory(storyId, {
        expandedSetting,
        status: "setting_expansion"
      });

      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error approving setting:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid setting data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve setting" });
      }
    }
  });

  app.post("/api/stories/:id/extract-characters", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      const extractedCharacters = await extractCharacters(
        story.characters,
        story.expandedSetting || story.setting,
        story.ageGroup,
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );

      const updatedStory = await storage.updateStoryExtractedCharacters(story.id, extractedCharacters);
      res.json({ characters: extractedCharacters, story: updatedStory });
    } catch (error) {
      console.error("Error extracting characters:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to extract characters" });
    }
  });

  app.post("/api/stories/:id/approve-characters", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId, characters } = approveCharactersSchema.parse({
        storyId: req.params.id,
        ...req.body
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      // Update story with approved characters first
      let updatedStory = await storage.updateStory(storyId, {
        extractedCharacters: characters,
        status: "characters_extracted"
      });

      // Generate story pages
      const storyContent = await generateStoryText(
        {
          title: story.title || "My Story",
          setting: story.setting,
          characters: story.characters,
          plot: story.plot,
          ageGroup: story.ageGroup as "3-5" | "6-8" | "9-12",
          totalPages: story.totalPages
        },
        story.expandedSetting || story.setting,
        characters,
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );

      // Update story with generated pages
      updatedStory = await storage.updateStory(story.id, {
        title: storyContent.title,
        pages: storyContent.pages,
        status: "text_approved"
      });

      res.json({ story: updatedStory, storyContent });
    } catch (error) {
      console.error("Error approving characters:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid character data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve characters" });
      }
    }
  });

  app.post("/api/stories/:id/generate-story", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      const storyContent = await generateStoryText(
        {
          title: story.title || "My Story",
          setting: story.setting,
          characters: story.characters,
          plot: story.plot,
          ageGroup: story.ageGroup as "3-5" | "6-8" | "9-12",
          totalPages: story.totalPages
        },
        story.expandedSetting || story.setting,
        story.extractedCharacters || [],
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );

      const updatedStory = await storage.updateStory(story.id, {
        title: storyContent.title,
        pages: storyContent.pages,
        status: "text_approved"
      });

      res.json({ story: updatedStory, storyContent });
    } catch (error) {
      console.error("Error generating story:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate story text" });
    }
  });

  app.post("/api/stories/:id/approve-story", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId, pages } = approveStorySchema.parse({
        storyId: req.params.id,
        ...req.body
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.updateStory(storyId, {
        pages,
        status: "text_approved"
      });

      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error approving story:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid story data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve story" });
      }
    }
  });

  app.post("/api/stories/:id/generate-images", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check API keys based on preferred provider
      const preferredProvider = req.user?.preferredImageProvider || "openai";
      
      if (preferredProvider === "replicate") {
        if (!req.user?.replicateApiKey) {
          return res.status(400).json({ message: "Replicate API key required" });
        }
      } else {
        if (!req.user?.openaiApiKey) {
          return res.status(400).json({ message: "OpenAI API key required" });
        }
      }

      await storage.updateStoryStatus(story.id, "generating_images");

      // Initialize image storage service
      const imageStorage = new ImageStorageService();

      // Generate core image using preferred provider and store as file
      let coreImageUrl: string;
      let coreImageFileId: string;
      
      if (preferredProvider === "replicate") {
        // Use Replicate for core image generation
        const replicateService = new ReplicateService(req.user.replicateApiKey!);
        
        const characterDescriptions = story.extractedCharacters && story.extractedCharacters.length > 0
          ? `Characters: ${story.extractedCharacters.map(c => `${c.name} - ${c.description}`).join(', ')}\n`
          : "";
        
        const settingDescription = story.expandedSetting || story.setting;
        const storyGuidanceText = story.storyGuidance ? `\nStory guidance: ${story.storyGuidance}` : "";
        
        const replicatePrompt = `Create a beautiful core reference image for a children's storybook:

${characterDescriptions}Setting: ${settingDescription}${storyGuidanceText}

This image will serve as the visual foundation for the entire story. Create a scene that captures:
- The overall mood and atmosphere of the setting
- Key characters in a natural, welcoming scene
- The magical or special elements of this world
- A composition that could serve as a book cover

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only

IMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested in the story guidance above.`;

        // Use the user's preferred model or a default working FLUX model
        let modelId = req.user.preferredReplicateModel || "black-forest-labs/flux-schnell";
        // Fallback to working model if user has invalid model set
        if (modelId === "prunaai/flux-kontext-dev") {
          modelId = "black-forest-labs/flux-schnell";
        }
        
        // Check if user has a template for this model
        const userTemplates = req.user.replicateModelTemplates || [];
        const template = userTemplates.find((t: any) => t.modelId === modelId);
        
        if (template) {
          // Use intelligent template-based generation
          coreImageUrl = await replicateService.generateImageWithTemplate(template, replicatePrompt);
        } else {
          // Fall back to legacy hardcoded generation
          coreImageUrl = await replicateService.generateImage(modelId, replicatePrompt, {
            width: 1024,
            height: 1024,
            numSteps: 50,
            guidanceScale: 7.5,
          });
        }
      } else {
        // Use OpenAI for core image generation
        coreImageUrl = await generateCoreImage(
          story.expandedSetting || story.setting,
          story.extractedCharacters || [],
          req.user.openaiApiKey!,
          req.user.openaiBaseUrl
        );
      }
      
      // Download and store the core image as a file
      coreImageFileId = await imageStorage.downloadAndStore(
        coreImageUrl,
        story.id,
        'core',
        'core_image'
      );
      
      // Update story with both URL (for backward compatibility) and file ID
      await storage.updateStoryCoreImage(story.id, coreImageUrl);
      await storage.updateStoryCoreImageFileId(story.id, coreImageFileId);

      // Generate character images using preferred provider and store as files
      if (story.extractedCharacters && story.extractedCharacters.length > 0) {
        const characterImages: Record<string, string> = {};
        for (const character of story.extractedCharacters) {
          let characterImageUrl: string;
          
          if (preferredProvider === "replicate") {
            // Use Replicate for character image generation
            const replicateService = new ReplicateService(req.user.replicateApiKey!);
            
            const settingDescription = story.expandedSetting || story.setting;
            const storyGuidanceText = story.storyGuidance ? `\nStory guidance: ${story.storyGuidance}` : "";
            
            const characterPrompt = `Create a beautiful character portrait for a children's storybook:

Character: ${character.name}
Description: ${character.description}
Setting context: ${settingDescription}${storyGuidanceText}

Style requirements:
- Child-friendly, cartoonish illustration style
- Bright, vibrant colors
- Clear character design suitable for children's books
- Show the character's personality through expression and pose
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only`;

            // Use the user's preferred model or a default working FLUX model
            let modelId = req.user.preferredReplicateModel || "black-forest-labs/flux-schnell";
            // Fallback to working model if user has invalid model set
            if (modelId === "prunaai/flux-kontext-dev") {
              modelId = "black-forest-labs/flux-schnell";
            }
            
            // Check if user has a template for this model
            const userTemplates = req.user.replicateModelTemplates || [];
            const template = userTemplates.find((t: any) => t.modelId === modelId);
            
            if (template) {
              // Use intelligent template-based generation
              characterImageUrl = await replicateService.generateImageWithTemplate(template, characterPrompt);
            } else {
              // Fall back to legacy hardcoded generation
              characterImageUrl = await replicateService.generateImage(modelId, characterPrompt, {
                width: 1024,
                height: 1024,
                numSteps: 50,
                guidanceScale: 7.5,
              });
            }
          } else {
            // Use OpenAI for character image generation
            characterImageUrl = await generateCharacterImage(
              character,
              story.expandedSetting || story.setting,
              req.user.openaiApiKey!,
              req.user.openaiBaseUrl
            );
          }
          
          // Download and store character image as file
          const characterImageFileId = await imageStorage.downloadAndStore(
            characterImageUrl,
            story.id,
            'character',
            `${character.name.toLowerCase().replace(/\s+/g, '_')}_character`
          );
          
          characterImages[character.name] = characterImageUrl;
          await storage.updateCharacterImage(story.id, character.name, characterImageUrl);
          await storage.updateCharacterImageFileId(story.id, character.name, characterImageFileId);
        }
      }

      // Generate page images
      const updatedPages = [...story.pages];
      // Build full story context by combining all page texts
      const storyContext = story.pages.map(p => `Page ${p.pageNumber}: ${p.text}`).join('\n\n');
      
      for (let i = 0; i < story.pages.length; i++) {
        const page = story.pages[i];
        const previousPageImageUrl = i > 0 ? updatedPages[i - 1].imageUrl : undefined;

        let imageUrl: string;

        if (preferredProvider === "replicate") {
          // Use Replicate for image generation
          const replicateService = new ReplicateService(req.user.replicateApiKey!);
          
          // Build comprehensive prompt for Replicate
          const characterDescriptions = story.extractedCharacters && story.extractedCharacters.length > 0
            ? `Characters: ${story.extractedCharacters.map(c => `${c.name} - ${c.description}`).join(', ')}\n`
            : "";
          
          const settingDescription = story.expandedSetting || story.setting;
          const pageImageGuidance = page.imageGuidance ? `\nPage guidance: ${page.imageGuidance}` : "";
          const storyGuidanceText = story.storyGuidance ? `\nStory guidance: ${story.storyGuidance}` : "";
          
          const replicatePrompt = `Create a beautiful children's book illustration for: ${page.text}

${characterDescriptions}Setting: ${settingDescription}${storyGuidanceText}${pageImageGuidance}

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only

IMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested in the page guidance above.`;

          // Use the user's preferred model or a default working FLUX model
          let modelId = req.user.preferredReplicateModel || "black-forest-labs/flux-schnell";
          // Fallback to working model if user has invalid model set
          if (modelId === "prunaai/flux-kontext-dev") {
            modelId = "black-forest-labs/flux-schnell";
          }
          
          imageUrl = await replicateService.generateImage(modelId, replicatePrompt, {
            width: 1024,
            height: 1024,
            numSteps: 50,
            guidanceScale: 7.5,
            imageInput: story.coreImageUrl || undefined // Pass reference image for visual consistency
          });
        } else {
          // Use OpenAI for image generation
          imageUrl = await generatePageImage(
            page.text,
            coreImageUrl,
            previousPageImageUrl,
            story.expandedSetting || story.setting,
            story.extractedCharacters || undefined,
            req.user.openaiApiKey!,
            req.user.openaiBaseUrl,
            undefined, // customPrompt
            storyContext, // full story context
            story.storyGuidance || undefined, // story-wide guidance
            page.imageGuidance || undefined // page-specific image guidance
          );
        }
        
        // Download and store page image as file
        const pageImageFileId = await imageStorage.downloadAndStore(
          imageUrl,
          story.id,
          'page',
          `page_${page.pageNumber}`
        );

        updatedPages[i] = { ...page, imageUrl, imageFileId: pageImageFileId };
        
        // Update the page with file ID
        await storage.updateStoryPageImageFileId(story.id, page.pageNumber, pageImageFileId);
      }

      const finalStory = await storage.updateStory(story.id, {
        pages: updatedPages,
        status: "completed"
      });

      res.json({ story: finalStory });
    } catch (error) {
      console.error("Error generating images:", error);
      await storage.updateStoryStatus(req.params.id, "text_approved");
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate images" });
    }
  });

  // Regenerate page image with custom prompt
  app.post("/api/stories/:id/pages/:pageNumber/regenerate-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId, pageNumber, customPrompt, currentImageUrl } = regenerateImageSchema.parse({
        storyId: req.params.id,
        pageNumber: parseInt(req.params.pageNumber),
        ...req.body
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get complete user data from database (req.user only has basic auth info)
      const fullUser = await storage.getUser(req.user!.id);
      if (!fullUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check API keys based on preferred provider
      const preferredProvider = fullUser.preferredImageProvider || "openai";
      
      if (preferredProvider === "replicate") {
        if (!fullUser.replicateApiKey) {
          return res.status(400).json({ message: "Replicate API key required" });
        }
      } else {
        if (!fullUser.openaiApiKey) {
          return res.status(400).json({ message: "OpenAI API key required" });
        }
      }

      const page = story.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const previousPage = story.pages.find(p => p.pageNumber === pageNumber - 1);
      const previousPageImageUrl = previousPage?.imageUrl;

      // Enhanced prompt for regeneration with strong consistency requirements
      let finalCustomPrompt = customPrompt;
      if (currentImageUrl) {
        const referenceText = `\n\nCRITICAL REGENERATION INSTRUCTIONS:
- You are regenerating an existing page image that must maintain PERFECT visual consistency with both the core story image AND the current page image
- The core story image establishes the character designs, art style, and visual world that must be preserved
- The current page image shows the exact composition and elements that should be kept while making requested modifications
- Do NOT change the fundamental character designs, art style, or color palette established in the core image
- Do NOT drastically alter the composition or main elements unless specifically requested
- Focus on making the specific changes mentioned in the custom prompt while preserving all established visual consistency
- This is a refinement/modification of an existing image, not a completely new creation`;
        
        finalCustomPrompt = customPrompt 
          ? customPrompt + referenceText 
          : "Please regenerate this image keeping the same composition, style, and character designs while making minor improvements or adjustments." + referenceText;
      }

      // Build full story context for regeneration
      const storyContext = story.pages.map(p => `Page ${p.pageNumber}: ${p.text}`).join('\n\n');

      let imageUrl: string;

      if (preferredProvider === "replicate") {
        // Use Replicate for image generation
        const replicateService = new ReplicateService(fullUser.replicateApiKey!);
        
        // Build comprehensive prompt for Replicate
        const characterDescriptions = story.extractedCharacters && story.extractedCharacters.length > 0
          ? `Characters: ${story.extractedCharacters.map(c => `${c.name} - ${c.description}`).join(', ')}\n`
          : "";
        
        const settingDescription = story.expandedSetting || story.setting;
        const pageImageGuidance = page.imageGuidance ? `\nPage guidance: ${page.imageGuidance}` : "";
        const storyGuidanceText = story.storyGuidance ? `\nStory guidance: ${story.storyGuidance}` : "";
        
        let replicatePrompt = `Create a beautiful children's book illustration for: ${page.text}

${characterDescriptions}Setting: ${settingDescription}${storyGuidanceText}${pageImageGuidance}

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only`;

        if (finalCustomPrompt) {
          replicatePrompt += `\n\nCustom modifications: ${finalCustomPrompt}`;
        }
        
        // Add text exclusion instruction for all Replicate prompts
        replicatePrompt += `\n\nIMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested in the ${finalCustomPrompt ? 'custom modifications' : 'page guidance'} above.`;

        // Use the user's preferred model or a default working FLUX model
        let modelId = fullUser.preferredReplicateModel || "black-forest-labs/flux-schnell";
        // Fallback to working model if user has invalid model set
        if (modelId === "prunaai/flux-kontext-dev") {
          modelId = "black-forest-labs/flux-schnell";
        }
        
        // Check if user has a template for this model
        const userTemplates = fullUser.replicateModelTemplates || [];
        console.log('Page regeneration - Debug template lookup:');
        console.log('- Looking for modelId:', modelId);
        console.log('- User templates count:', userTemplates.length);
        console.log('- Available template modelIds:', userTemplates.map((t: any) => t.modelId));
        
        const template = userTemplates.find((t: any) => t.modelId === modelId);
        console.log('- Template found:', !!template);
        if (template) {
          console.log('- Template details:', JSON.stringify(template, null, 2));
        }
        
        if (template) {
          // Use intelligent template-based generation with multi-image support
          console.log('Using template-based page regeneration with template:', JSON.stringify(template, null, 2));
          
          // Prepare multi-image inputs for models that support them
          const imageOptions: any = {
            additionalPrompt: finalCustomPrompt
          };
          
          // Convert file IDs to local URLs instead of using external Replicate URLs
          const getImageUrl = (url: string | undefined, fileId: string | undefined): string | undefined => {
            if (fileId) {
              // Use stored file reference instead of external URL
              const protocol = req.protocol;
              const host = req.get('host');
              return `${protocol}://${host}/api/files/${fileId}`;
            }
            return url; // Fallback to original URL if no fileId
          };

          // Set primary image (current page image takes priority)
          const primaryImageUrl = getImageUrl(currentImageUrl, page.imageFileId);
          if (primaryImageUrl) {
            imageOptions.primaryImage = primaryImageUrl;
          }
          
          // Set reference image (story core image for visual consistency)
          const referenceImageUrl = getImageUrl(story.coreImageUrl, story.coreImageFileId);
          if (referenceImageUrl && referenceImageUrl !== primaryImageUrl) {
            imageOptions.referenceImage = referenceImageUrl;
          }
          
          // Set additional images for models that support extra image inputs
          const additionalImages: { [key: string]: string } = {};
          if (previousPage?.imageFileId) {
            const prevImageUrl = getImageUrl(previousPageImageUrl, previousPage.imageFileId);
            if (prevImageUrl && prevImageUrl !== primaryImageUrl && prevImageUrl !== referenceImageUrl) {
              additionalImages.previous_page = prevImageUrl;
            }
          }
          
          if (Object.keys(additionalImages).length > 0) {
            imageOptions.additionalImages = additionalImages;
          }
          
          console.log('Page regeneration - Using multiple images:', {
            primaryImage: !!imageOptions.primaryImage,
            referenceImage: !!imageOptions.referenceImage,
            additionalImages: Object.keys(additionalImages),
            primaryImageUrl: imageOptions.primaryImage,
            referenceImageUrl: imageOptions.referenceImage
          });
          
          imageUrl = await replicateService.generateImageWithTemplate(template, replicatePrompt, imageOptions);
        } else {
          // Fall back to legacy hardcoded generation with primary reference image
          const legacyImageUrl = getImageUrl(currentImageUrl, page.imageFileId) || 
                                 getImageUrl(previousPageImageUrl, previousPage?.imageFileId) || 
                                 getImageUrl(story.coreImageUrl, story.coreImageFileId);
          
          imageUrl = await replicateService.generateImage(modelId, replicatePrompt, {
            width: 1024,
            height: 1024,
            numSteps: 50,
            guidanceScale: 7.5,
            imageInput: legacyImageUrl
          });
        }
      } else {
        // Use OpenAI for image generation with stored file references
        const protocol = req.protocol;
        const host = req.get('host');
        const getImageUrl = (url: string | undefined, fileId: string | undefined): string | undefined => {
          if (fileId) {
            return `${protocol}://${host}/api/files/${fileId}`;
          }
          return url;
        };

        const openaiCoreImageUrl = getImageUrl(story.coreImageUrl, story.coreImageFileId) || "";
        const openaiPreviousImageUrl = getImageUrl(previousPageImageUrl, previousPage?.imageFileId);
        
        imageUrl = await generatePageImage(
          page.text,
          openaiCoreImageUrl,
          openaiPreviousImageUrl,
          story.expandedSetting || story.setting,
          story.extractedCharacters || undefined,
          fullUser.openaiApiKey!,
          fullUser.openaiBaseUrl,
          finalCustomPrompt,
          storyContext, // full story context
          story.storyGuidance || undefined, // story-wide guidance
          page.imageGuidance || undefined // page-specific image guidance
        );
      }
      
      const updatedStory = await storage.updateStoryPageImage(storyId, pageNumber, imageUrl, finalCustomPrompt);
      res.json({ imageUrl, story: updatedStory });
    } catch (error) {
      console.error("Error regenerating page image:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to regenerate page image" });
      }
    }
  });

  // Restore an image version from history
  app.post("/api/stories/:id/pages/:pageNumber/restore-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const storyId = req.params.id;
      const pageNumber = parseInt(req.params.pageNumber);
      const { imageUrl, prompt } = req.body;
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.updateStoryPageImage(storyId, pageNumber, imageUrl, prompt);
      res.json({ imageUrl, story: updatedStory });
    } catch (error) {
      console.error("Error restoring image version:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to restore image version" });
    }
  });

  // Regenerate core image with custom prompt
  app.post("/api/stories/:id/regenerate-core-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { storyId, customPrompt, useCurrentImageAsReference } = regenerateCoreImageSchema.parse({
        storyId: req.params.id,
        ...req.body
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check API keys based on preferred provider
      const preferredProvider = req.user?.preferredImageProvider || "openai";
      
      if (preferredProvider === "replicate") {
        if (!req.user?.replicateApiKey) {
          return res.status(400).json({ message: "Replicate API key required" });
        }
      } else {
        if (!req.user?.openaiApiKey) {
          return res.status(400).json({ message: "OpenAI API key required" });
        }
      }

      // Initialize image storage service
      const imageStorage = new ImageStorageService();

      let imageUrl: string;
      let coreImageFileId: string;

      if (preferredProvider === "replicate") {
        // Use Replicate for core image regeneration
        const replicateService = new ReplicateService(req.user.replicateApiKey!);
        
        const characterDescriptions = story.extractedCharacters && story.extractedCharacters.length > 0
          ? `Characters: ${story.extractedCharacters.map(c => `${c.name} - ${c.description}`).join(', ')}\n`
          : "";
        
        const settingDescription = story.expandedSetting || story.setting;
        const storyGuidanceText = story.storyGuidance ? `\nStory guidance: ${story.storyGuidance}` : "";
        const customPromptText = customPrompt ? `\nCustom instructions: ${customPrompt}` : "";
        
        const replicatePrompt = `Create a beautiful core reference image for a children's storybook:

${characterDescriptions}Setting: ${settingDescription}${storyGuidanceText}${customPromptText}

This image will serve as the visual foundation for the entire story. Create a scene that captures:
- The overall mood and atmosphere of the setting
- Key characters in a natural, welcoming scene
- The magical or special elements of this world
- A composition that could serve as a book cover

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only

IMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested in the custom instructions above.`;

        // Use the user's preferred model or a default working FLUX model
        let modelId = req.user.preferredReplicateModel || "black-forest-labs/flux-schnell";
        // Fallback to working model if user has invalid model set
        if (modelId === "prunaai/flux-kontext-dev") {
          modelId = "black-forest-labs/flux-schnell";
        }
        
        // Check if user has a template for this model
        const userTemplates = req.user.replicateModelTemplates || [];
        const template = userTemplates.find((t: any) => t.modelId === modelId);
        
        if (template) {
          // Use intelligent template-based generation with optional reference image
          console.log('Using template-based generation with template:', JSON.stringify(template, null, 2));
          imageUrl = await replicateService.generateImageWithTemplate(template, replicatePrompt, {
            referenceImage: useCurrentImageAsReference ? (story.coreImageUrl || undefined) : undefined,
            additionalPrompt: customPromptText
          });
          console.log('Template-based generation returned imageUrl:', imageUrl);
          console.log('Template-based generation imageUrl type:', typeof imageUrl);
        } else {
          // Fall back to legacy hardcoded generation
          console.log('Using legacy hardcoded generation with modelId:', modelId);
          imageUrl = await replicateService.generateImage(modelId, replicatePrompt, {
            width: 1024,
            height: 1024,
            numSteps: 50,
            guidanceScale: 7.5,
            imageInput: useCurrentImageAsReference ? (story.coreImageUrl || undefined) : undefined
          });
          console.log('Legacy generation returned imageUrl:', imageUrl);
          console.log('Legacy generation imageUrl type:', typeof imageUrl);
        }
      } else {
        // Use OpenAI for core image regeneration
        imageUrl = await regenerateCoreImage(
          story.expandedSetting || story.setting,
          story.extractedCharacters || [],
          customPrompt,
          useCurrentImageAsReference,
          req.user.openaiApiKey!,
          req.user.openaiBaseUrl,
          useCurrentImageAsReference ? (story.coreImageUrl || undefined) : undefined
        );
        console.log('OpenAI generation returned imageUrl:', imageUrl);
        console.log('OpenAI generation imageUrl type:', typeof imageUrl);
      }
      
      console.log('About to call downloadAndStore with imageUrl:', imageUrl);
      console.log('imageUrl type:', typeof imageUrl);
      console.log('imageUrl is string?', typeof imageUrl === 'string');
      if (typeof imageUrl === 'string') {
        console.log('imageUrl validation - starts with http:', imageUrl.startsWith('http'));
        console.log('imageUrl length:', imageUrl.length);
      } else {
        console.error('ERROR: imageUrl is not a string! Received type:', typeof imageUrl);
        console.error('imageUrl value:', imageUrl);
        console.error('imageUrl keys (if object):', imageUrl && typeof imageUrl === 'object' ? Object.keys(imageUrl) : 'N/A');
        throw new Error(`Invalid imageUrl type. Expected string, got ${typeof imageUrl}. Value: ${JSON.stringify(imageUrl)}`);
      }
      
      // Download and store the regenerated core image as a file
      coreImageFileId = await imageStorage.downloadAndStore(
        imageUrl,
        story.id,
        'core',
        'core_image_regenerated'
      );
      
      // Update story with both URL (for backward compatibility) and file ID
      await storage.updateStoryCoreImage(storyId, imageUrl);
      await storage.updateStoryCoreImageFileId(storyId, coreImageFileId);
      
      const updatedStory = await storage.getStory(storyId);
      res.json({ imageUrl, story: updatedStory });
    } catch (error) {
      console.error("Error regenerating core image:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to regenerate core image" });
      }
    }
  });

  // Bookmark story
  app.post("/api/stories/:id/bookmark", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.toggleStoryBookmark(req.params.id);
      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error bookmarking story:", error);
      res.status(500).json({ message: "Failed to bookmark story" });
    }
  });

  // REVISION SYSTEM ROUTES

  // Get all revisions for a story
  app.get("/api/stories/:id/revisions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const revisions = await storage.getRevisions(req.params.id);
      res.json({ revisions });
    } catch (error) {
      console.error("Error fetching revisions:", error);
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  // Create a new revision from current story state
  app.post("/api/stories/:id/revisions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { step, description, fromRevision } = createRevisionSchema.parse({
        storyId: req.params.id,
        ...req.body
      });

      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the highest revision number and increment
      const existingRevisions = await storage.getRevisions(req.params.id);
      const maxRevisionNumber = Math.max(0, ...existingRevisions.map(r => r.revisionNumber));
      const newRevisionNumber = maxRevisionNumber + 1;

      const stepOrder = ["details", "setting", "characters", "review", "images", "complete"];
      const stepCompleted = step;

      // Create the revision
      const revision = await storage.createRevision({
        storyId: req.params.id,
        revisionNumber: newRevisionNumber,
        title: story.title,
        setting: story.setting,
        expandedSetting: story.expandedSetting,
        characters: story.characters,
        extractedCharacters: story.extractedCharacters,
        plot: story.plot,
        ageGroup: story.ageGroup,
        totalPages: story.totalPages,
        pages: story.pages,
        coreImageUrl: story.coreImageUrl,
        status: story.status,
        stepCompleted,
        parentRevision: fromRevision,
        description,
      });

      // Update the story's current revision
      await storage.updateStory(req.params.id, { currentRevision: newRevisionNumber });

      res.json({ revision });
    } catch (error) {
      console.error("Error creating revision:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid revision data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create revision" });
      }
    }
  });

  // Load a revision as the current story state
  app.post("/api/stories/:id/revisions/:revisionNumber/load", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const revisionNumber = parseInt(req.params.revisionNumber);
      
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.loadRevisionAsCurrentStory(req.params.id, revisionNumber);
      if (!updatedStory) {
        return res.status(404).json({ message: "Revision not found" });
      }

      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error loading revision:", error);
      res.status(500).json({ message: "Failed to load revision" });
    }
  });

  // Save story state at a specific step and clear future steps if needed
  app.post("/api/stories/:id/save-step", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { step, storyData, clearFutureSteps = false } = req.body;

      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If clearFutureSteps is true and we're editing an earlier step with future data,
      // create a new revision and clear following steps
      let shouldCreateRevision = clearFutureSteps;
      
      const stepOrder = ["details", "setting", "characters", "review", "images", "complete"];
      const currentStepIndex = stepOrder.indexOf(step);
      
      if (shouldCreateRevision) {
        // Get the highest revision number and create a new one
        const existingRevisions = await storage.getRevisions(req.params.id);
        const maxRevisionNumber = Math.max(0, ...existingRevisions.map(r => r.revisionNumber));
        const newRevisionNumber = maxRevisionNumber + 1;

        // Save current state as a revision first
        await storage.createRevision({
          storyId: req.params.id,
          revisionNumber: newRevisionNumber,
          title: story.title,
          setting: story.setting,
          expandedSetting: story.expandedSetting,
          characters: story.characters,
          extractedCharacters: story.extractedCharacters,
          plot: story.plot,
          ageGroup: story.ageGroup,
          totalPages: story.totalPages,
          pages: story.pages,
          coreImageUrl: story.coreImageUrl,
          status: story.status,
          stepCompleted: step,
          parentRevision: story.currentRevision,
          description: `Edited at ${step} step`,
        });

        // Clear future step data based on current step
        const clearedData: any = { ...storyData };
        
        if (currentStepIndex <= stepOrder.indexOf("setting")) {
          clearedData.expandedSetting = null;
        }
        if (currentStepIndex <= stepOrder.indexOf("characters")) {
          clearedData.extractedCharacters = [];
        }
        if (currentStepIndex <= stepOrder.indexOf("review")) {
          clearedData.pages = [];
        }
        if (currentStepIndex <= stepOrder.indexOf("images")) {
          clearedData.coreImageUrl = null;
          clearedData.pages = clearedData.pages?.map((p: any) => ({ ...p, imageUrl: undefined })) || [];
        }

        // Update story with cleared data and new revision number
        const updatedStory = await storage.updateStory(req.params.id, {
          ...clearedData,
          currentRevision: newRevisionNumber
        });

        res.json({ story: updatedStory, revisionCreated: true, revisionNumber: newRevisionNumber });
      } else {
        // Just update the story normally
        const updatedStory = await storage.updateStory(req.params.id, storyData);
        res.json({ story: updatedStory, revisionCreated: false });
      }
    } catch (error) {
      console.error("Error saving step:", error);
      res.status(500).json({ message: "Failed to save step" });
    }
  });

  // Update story (for title editing, etc.)
  app.patch("/api/stories/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedStory = await storage.updateStory(req.params.id, req.body);
      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error updating story:", error);
      res.status(500).json({ message: "Failed to update story" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}