import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  setting: text("setting").notNull(),
  characters: text("characters").notNull(),
  plot: text("plot").notNull(),
  ageGroup: text("age_group").notNull(),
  totalPages: integer("total_pages").notNull(),
  pages: jsonb("pages").$type<StoryPage[]>().notNull().default([]),
  coreImageUrl: text("core_image_url"),
  status: text("status").notNull().default("draft"), // draft, text_approved, generating_images, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const approveStorySchema = z.object({
  storyId: z.string(),
  pages: z.array(z.object({
    pageNumber: z.number(),
    text: z.string().min(50, "Page text must be at least 50 characters"),
  })),
});

export type StoryPage = {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  imagePrompt?: string;
};

export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type CreateStory = z.infer<typeof createStorySchema>;
export type ApproveStory = z.infer<typeof approveStorySchema>;

// Keep existing users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
