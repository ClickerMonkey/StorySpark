import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryText, generateCoreImage, generatePageImage, expandSetting, extractCharacters, generateCharacterImage } from "./services/openai";
import { createStorySchema, approveStorySchema, approveSettingSchema, approveCharactersSchema, regenerateImageSchema } from "@shared/schema";
import { verifyGoogleToken, generateJWT, requireAuth, optionalAuth, type AuthenticatedRequest } from "./auth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
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
      const tokenParams = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
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
    res.json({
      user: req.user
    });
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

  // Story routes
  app.post("/api/stories", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const storyData = createStorySchema.parse(req.body);
      
      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required. Please configure it in your settings." });
      }

      const story = await storage.createStory({
        userId: req.user.id,
        title: "Untitled Story",
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

      const updatedStory = await storage.updateStory(storyId, {
        extractedCharacters: characters,
        status: "characters_extracted"
      });

      res.json({ story: updatedStory });
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

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      await storage.updateStoryStatus(story.id, "generating_images");

      // Generate core image
      const coreImageUrl = await generateCoreImage(
        story.expandedSetting || story.setting,
        story.extractedCharacters || [],
        req.user.openaiApiKey,
        req.user.openaiBaseUrl
      );
      
      await storage.updateStoryCoreImage(story.id, coreImageUrl);

      // Generate character images
      if (story.extractedCharacters && story.extractedCharacters.length > 0) {
        const characterImages: Record<string, string> = {};
        for (const character of story.extractedCharacters) {
          const characterImageUrl = await generateCharacterImage(
            character,
            story.expandedSetting || story.setting,
            req.user.openaiApiKey,
            req.user.openaiBaseUrl
          );
          characterImages[character.name] = characterImageUrl;
          await storage.updateCharacterImage(story.id, character.name, characterImageUrl);
        }
      }

      // Generate page images
      const updatedPages = [...story.pages];
      for (let i = 0; i < story.pages.length; i++) {
        const page = story.pages[i];
        const previousPageImageUrl = i > 0 ? updatedPages[i - 1].imageUrl : undefined;

        const imageUrl = await generatePageImage(
          page.text,
          coreImageUrl,
          previousPageImageUrl,
          story.expandedSetting || story.setting,
          story.extractedCharacters || undefined,
          req.user.openaiApiKey,
          req.user.openaiBaseUrl
        );
        
        updatedPages[i] = { ...page, imageUrl };
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
      const { storyId, pageNumber, customPrompt } = regenerateImageSchema.parse({
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

      if (!req.user?.openaiApiKey) {
        return res.status(400).json({ message: "OpenAI API key required" });
      }

      const page = story.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      const previousPage = story.pages.find(p => p.pageNumber === pageNumber - 1);
      const previousPageImageUrl = previousPage?.imageUrl;

      const imageUrl = await generatePageImage(
        page.text,
        story.coreImageUrl || "",
        previousPageImageUrl,
        story.expandedSetting || story.setting,
        story.extractedCharacters || undefined,
        req.user.openaiApiKey,
        req.user.openaiBaseUrl,
        customPrompt
      );
      
      const updatedStory = await storage.updateStoryPageImage(storyId, pageNumber, imageUrl);
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

  const httpServer = createServer(app);
  return httpServer;
}