import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryText, generateCoreImage, generatePageImage } from "./services/openai";
import { createStorySchema, approveStorySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create a new story from user input
  app.post("/api/stories", async (req, res) => {
    try {
      const storyInput = createStorySchema.parse(req.body);
      
      // Generate story text using OpenAI
      const generatedStory = await generateStoryText(storyInput);
      
      // Create story in storage
      const story = await storage.createStory({
        title: generatedStory.title,
        setting: storyInput.setting,
        characters: storyInput.characters,
        plot: storyInput.plot,
        ageGroup: storyInput.ageGroup,
        totalPages: storyInput.totalPages,
        pages: generatedStory.pages,
        status: "draft",
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
        story.setting,
        story.characters
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
