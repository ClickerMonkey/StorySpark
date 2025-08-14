import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryText, generateCoreImage, generatePageImage, expandSetting, extractCharacters, generateCharacterImage } from "./services/openai";
import { createStorySchema, approveStorySchema, approveSettingSchema, approveCharactersSchema, regenerateImageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create a new story from user input
  app.post("/api/stories", async (req, res) => {
    try {
      const storyInput = createStorySchema.parse(req.body);
      
      // Create initial story in storage with basic information
      const story = await storage.createStory({
        title: `Story in ${storyInput.setting}`,
        setting: storyInput.setting,
        characters: storyInput.characters,
        plot: storyInput.plot,
        ageGroup: storyInput.ageGroup,
        totalPages: storyInput.totalPages,
        pages: [],
        status: "setting_expansion",
      });

      res.json(story);
    } catch (error) {
      console.error("Error creating story:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create story" });
      }
    }
  });

  // Get all stories
  app.get("/api/stories", async (req, res) => {
    try {
      const stories = await storage.getAllStories();
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  // Get a specific story
  app.get("/api/stories/:id", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      res.json(story);
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({ message: "Failed to fetch story" });
    }
  });

  // Approve story text and start image generation
  app.post("/api/stories/:id/approve", async (req, res) => {
    try {
      const { storyId, pages } = approveStorySchema.parse({ 
        storyId: req.params.id, 
        ...req.body 
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // Update story with approved text
      const updatedStory = await storage.updateStoryPages(storyId, pages);
      if (!updatedStory) {
        return res.status(500).json({ message: "Failed to update story" });
      }

      // Update status to text_approved
      await storage.updateStoryStatus(storyId, "text_approved");

      res.json({ message: "Story approved successfully", story: updatedStory });
    } catch (error) {
      console.error("Error approving story:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve story" });
      }
    }
  });

  // Generate core image for a story
  app.post("/api/stories/:id/generate-core-image", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (story.status !== "text_approved") {
        return res.status(400).json({ message: "Story text must be approved before generating images" });
      }

      // Generate core image
      const coreImageUrl = await generateCoreImage(story.setting, story.characters);
      
      // Update story with core image
      const updatedStory = await storage.updateStoryCoreImage(story.id, coreImageUrl);
      await storage.updateStoryStatus(story.id, "generating_images");

      res.json({ coreImageUrl, story: updatedStory });
    } catch (error) {
      console.error("Error generating core image:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate core image" });
    }
  });

  // Generate image for a specific page
  app.post("/api/stories/:id/pages/:pageNumber/generate-image", async (req, res) => {
    try {
      const storyId = req.params.id;
      const pageNumber = parseInt(req.params.pageNumber);
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      if (!story.coreImageUrl) {
        return res.status(400).json({ message: "Core image must be generated first" });
      }

      const page = story.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Get previous page image URL for context
      const previousPage = story.pages.find(p => p.pageNumber === pageNumber - 1);
      const previousPageImageUrl = previousPage?.imageUrl;

      // Generate page image
      const imageUrl = await generatePageImage(
        page.text, 
        story.coreImageUrl, 
        previousPageImageUrl,
        story.expandedSetting || story.setting,
        story.extractedCharacters
      );
      
      // Update page with image
      const updatedStory = await storage.updateStoryPageImage(storyId, pageNumber, imageUrl);
      
      // Check if all pages have images and update status to completed
      const allPagesHaveImages = updatedStory?.pages.every(p => p.imageUrl);
      if (allPagesHaveImages) {
        await storage.updateStoryStatus(storyId, "completed");
      }

      res.json({ imageUrl, story: updatedStory });
    } catch (error) {
      console.error("Error generating page image:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate page image" });
    }
  });

  // Expand story setting 
  app.post("/api/stories/:id/expand-setting", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // Expand the setting
      const expandedSetting = await expandSetting(story.setting, story.characters, story.plot, story.ageGroup);
      
      // Update story with expanded setting
      const updatedStory = await storage.updateStoryExpandedSetting(story.id, expandedSetting);
      await storage.updateStoryStatus(story.id, "setting_expansion");

      res.json({ expandedSetting, story: updatedStory });
    } catch (error) {
      console.error("Error expanding setting:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to expand setting" });
    }
  });

  // Approve expanded setting
  app.post("/api/stories/:id/approve-setting", async (req, res) => {
    try {
      const { storyId, expandedSetting } = approveSettingSchema.parse({ 
        storyId: req.params.id, 
        ...req.body 
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // Update story with approved setting
      await storage.updateStoryExpandedSetting(storyId, expandedSetting);
      
      // Extract characters next
      const extractedCharacters = await extractCharacters(story.characters, expandedSetting, story.ageGroup);
      await storage.updateStoryExtractedCharacters(storyId, extractedCharacters);
      await storage.updateStoryStatus(storyId, "characters_extracted");

      const updatedStory = await storage.getStory(storyId);
      res.json({ characters: extractedCharacters, story: updatedStory });
    } catch (error) {
      console.error("Error approving setting:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve setting" });
      }
    }
  });

  // Approve characters and generate character images
  app.post("/api/stories/:id/approve-characters", async (req, res) => {
    try {
      const { storyId, characters } = approveCharactersSchema.parse({ 
        storyId: req.params.id, 
        ...req.body 
      });
      
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // Update characters
      await storage.updateStoryExtractedCharacters(storyId, characters);
      
      // Generate story text now that we have detailed characters
      const storyInput = {
        setting: story.expandedSetting || story.setting,
        characters: characters.map(c => `${c.name}: ${c.description}`).join('\n'),
        plot: story.plot,
        totalPages: story.totalPages,
        ageGroup: story.ageGroup
      };
      
      const generatedStory = await generateStoryText(storyInput);
      
      // Update story with generated text
      await storage.updateStory(storyId, {
        title: generatedStory.title,
        pages: generatedStory.pages,
        status: "draft"
      });

      const updatedStory = await storage.getStory(storyId);
      res.json({ story: updatedStory });
    } catch (error) {
      console.error("Error approving characters:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to approve characters" });
      }
    }
  });

  // Generate character images
  app.post("/api/stories/:id/generate-character-images", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      const characterImages = [];
      
      // Generate images for each character
      for (const character of story.extractedCharacters) {
        try {
          const imageUrl = await generateCharacterImage(character, story.expandedSetting || story.setting);
          await storage.updateCharacterImage(story.id, character.name, imageUrl);
          characterImages.push({ character: character.name, imageUrl });
        } catch (error) {
          console.error(`Error generating image for character ${character.name}:`, error);
        }
      }

      const updatedStory = await storage.getStory(req.params.id);
      res.json({ characterImages, story: updatedStory });
    } catch (error) {
      console.error("Error generating character images:", error);
      res.status(500).json({ message: "Failed to generate character images" });
    }
  });

  // Regenerate page image with custom prompt
  app.post("/api/stories/:id/pages/:pageNumber/regenerate-image", async (req, res) => {
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

      const page = story.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        return res.status(404).json({ message: "Page not found" });
      }

      // Get previous page image URL for context
      const previousPage = story.pages.find(p => p.pageNumber === pageNumber - 1);
      const previousPageImageUrl = previousPage?.imageUrl;

      // Generate new image with custom prompt
      const imageUrl = await generatePageImage(
        page.text,
        story.coreImageUrl || "",
        previousPageImageUrl,
        story.expandedSetting || story.setting,
        story.extractedCharacters,
        customPrompt
      );
      
      // Update page with new image
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

  // Update story text (for editing)
  app.patch("/api/stories/:id", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      const updates = req.body;
      const updatedStory = await storage.updateStory(req.params.id, updates);

      res.json(updatedStory);
    } catch (error) {
      console.error("Error updating story:", error);
      res.status(500).json({ message: "Failed to update story" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
