import { type User, type InsertUser, type Story, type InsertStory, type StoryPage, type Character, stories, users } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createStory(story: InsertStory): Promise<Story>;
  getStory(id: string): Promise<Story | undefined>;
  getAllStories(): Promise<Story[]>;
  updateStory(id: string, updates: Partial<Story>): Promise<Story | undefined>;
  updateStoryPages(id: string, pages: StoryPage[]): Promise<Story | undefined>;
  updateStoryStatus(id: string, status: string): Promise<Story | undefined>;
  updateStoryCoreImage(id: string, coreImageUrl: string): Promise<Story | undefined>;
  updateStoryPageImage(id: string, pageNumber: number, imageUrl: string): Promise<Story | undefined>;
  updateStoryExpandedSetting(id: string, expandedSetting: string): Promise<Story | undefined>;
  updateStoryExtractedCharacters(id: string, characters: Character[]): Promise<Story | undefined>;
  updateCharacterImage(id: string, characterName: string, imageUrl: string): Promise<Story | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private stories: Map<string, Story>;

  constructor() {
    this.users = new Map();
    this.stories = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const id = randomUUID();
    const now = new Date();
    const story: Story = {
      ...insertStory,
      id,
      createdAt: now,
      updatedAt: now,
      status: insertStory.status || "draft",
      pages: insertStory.pages || [],
      coreImageUrl: insertStory.coreImageUrl || null,
      expandedSetting: insertStory.expandedSetting || null,
      extractedCharacters: insertStory.extractedCharacters || [],
    };
    this.stories.set(id, story);
    return story;
  }

  async getStory(id: string): Promise<Story | undefined> {
    return this.stories.get(id);
  }

  async getAllStories(): Promise<Story[]> {
    return Array.from(this.stories.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateStory(id: string, updates: Partial<Story>): Promise<Story | undefined> {
    const story = this.stories.get(id);
    if (!story) return undefined;

    const updatedStory = {
      ...story,
      ...updates,
      updatedAt: new Date(),
    };
    this.stories.set(id, updatedStory);
    return updatedStory;
  }

  async updateStoryPages(id: string, pages: StoryPage[]): Promise<Story | undefined> {
    return this.updateStory(id, { pages });
  }

  async updateStoryStatus(id: string, status: string): Promise<Story | undefined> {
    return this.updateStory(id, { status });
  }

  async updateStoryCoreImage(id: string, coreImageUrl: string): Promise<Story | undefined> {
    return this.updateStory(id, { coreImageUrl });
  }

  async updateStoryPageImage(id: string, pageNumber: number, imageUrl: string): Promise<Story | undefined> {
    const story = this.stories.get(id);
    if (!story) return undefined;

    const updatedPages = story.pages.map(page =>
      page.pageNumber === pageNumber
        ? { ...page, imageUrl }
        : page
    );

    return this.updateStory(id, { pages: updatedPages });
  }

  async updateStoryExpandedSetting(id: string, expandedSetting: string): Promise<Story | undefined> {
    return this.updateStory(id, { expandedSetting });
  }

  async updateStoryExtractedCharacters(id: string, characters: Character[]): Promise<Story | undefined> {
    return this.updateStory(id, { extractedCharacters: characters });
  }

  async updateCharacterImage(id: string, characterName: string, imageUrl: string): Promise<Story | undefined> {
    const story = this.stories.get(id);
    if (!story) return undefined;

    const updatedCharacters = story.extractedCharacters.map(char =>
      char.name === characterName
        ? { ...char, imageUrl }
        : char
    );

    return this.updateStory(id, { extractedCharacters: updatedCharacters });
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const [story] = await db
      .insert(stories)
      .values(insertStory)
      .returning();
    return story;
  }

  async getStory(id: string): Promise<Story | undefined> {
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    return story || undefined;
  }

  async getAllStories(): Promise<Story[]> {
    return await db.select().from(stories).orderBy(stories.createdAt);
  }

  async updateStory(id: string, updates: Partial<Story>): Promise<Story | undefined> {
    const [updatedStory] = await db
      .update(stories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stories.id, id))
      .returning();
    return updatedStory || undefined;
  }

  async updateStoryPages(id: string, pages: StoryPage[]): Promise<Story | undefined> {
    return this.updateStory(id, { pages });
  }

  async updateStoryStatus(id: string, status: string): Promise<Story | undefined> {
    return this.updateStory(id, { status });
  }

  async updateStoryCoreImage(id: string, coreImageUrl: string): Promise<Story | undefined> {
    return this.updateStory(id, { coreImageUrl });
  }

  async updateStoryPageImage(id: string, pageNumber: number, imageUrl: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    const updatedPages = story.pages.map(page =>
      page.pageNumber === pageNumber
        ? { ...page, imageUrl }
        : page
    );

    return this.updateStory(id, { pages: updatedPages });
  }

  async updateStoryExpandedSetting(id: string, expandedSetting: string): Promise<Story | undefined> {
    return this.updateStory(id, { expandedSetting });
  }

  async updateStoryExtractedCharacters(id: string, characters: Character[]): Promise<Story | undefined> {
    return this.updateStory(id, { extractedCharacters: characters });
  }

  async updateCharacterImage(id: string, characterName: string, imageUrl: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    const updatedCharacters = story.extractedCharacters.map(char =>
      char.name === characterName
        ? { ...char, imageUrl }
        : char
    );

    return this.updateStory(id, { extractedCharacters: updatedCharacters });
  }
}

export const storage = new DatabaseStorage();
