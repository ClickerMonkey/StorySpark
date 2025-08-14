import { type User, type InsertUser, type Story, type InsertStory, type StoryPage } from "@shared/schema";
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
}

export const storage = new MemStorage();
