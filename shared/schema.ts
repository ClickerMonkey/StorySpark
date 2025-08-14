import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  setting: text("setting").notNull(),
  expandedSetting: text("expanded_setting"),
  characters: text("characters").notNull(),
  extractedCharacters: jsonb("extracted_characters").$type<Character[]>().default([]),
  plot: text("plot").notNull(),
  ageGroup: text("age_group").notNull(),
  totalPages: integer("total_pages").notNull(),
  pages: jsonb("pages").$type<StoryPage[]>().notNull().default([]),
  coreImageUrl: text("core_image_url"),
  status: text("status").notNull().default("draft"), // draft, setting_expansion, characters_extracted, text_approved, generating_images, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStorySchema = insertStorySchema.partial();

export const createStorySchema = z.object({
  setting: z.string().min(10, "Setting must be at least 10 characters"),
  characters: z.string().min(10, "Characters must be at least 10 characters"),
  plot: z.string().min(20, "Plot must be at least 20 characters"),
  totalPages: z.number().min(3).max(20),
  ageGroup: z.enum(["3-5", "6-8", "9-12"]),
});

export const approveSettingSchema = z.object({
  storyId: z.string(),
  expandedSetting: z.string().min(20, "Setting must be at least 20 characters"),
});

export const approveCharactersSchema = z.object({
  storyId: z.string(),
  characters: z.array(z.object({
    name: z.string().min(1, "Character name required"),
    description: z.string().min(10, "Character description must be at least 10 characters"),
  })),
});

export const approveStorySchema = z.object({
  storyId: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number(),
    text: z.string().min(50, "Page text must be at least 50 characters"),
  })),
});

export const regenerateImageSchema = z.object({
  storyId: z.string(),
  pageNumber: z.number(),
  customPrompt: z.string().min(10, "Custom prompt must be at least 10 characters"),
});

export type Character = {
  name: string;
  description: string;
  imageUrl?: string;
};

export type StoryPage = {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  imagePrompt?: string;
};

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type CreateStory = z.infer<typeof createStorySchema>;
export type ApproveSetting = z.infer<typeof approveSettingSchema>;
export type ApproveCharacters = z.infer<typeof approveCharactersSchema>;
export type ApproveStory = z.infer<typeof approveStorySchema>;
export type RegenerateImage = z.infer<typeof regenerateImageSchema>;
