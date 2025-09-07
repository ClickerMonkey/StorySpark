import { 
  type User, 
  type InsertUser, 
  type Story, 
  type InsertStory, 
  type StoryRevision,
  type InsertStoryRevision,
  type StoryPage, 
  type Character, 
  stories, 
  users,
  storyRevisions
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { encryptApiKey, decryptApiKey } from "./utils/encryption";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: any): Promise<User>;
  updateUserOpenAI(userId: string, apiKey: string, baseUrl?: string): Promise<User | undefined>;
  updateUser(userId: string, data: Partial<User>): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  
  createStory(story: InsertStory): Promise<Story>;
  getStory(id: string): Promise<Story | undefined>;
  getAllStories(): Promise<Story[]>;
  updateStory(id: string, updates: Partial<Story>): Promise<Story | undefined>;
  updateStoryPages(id: string, pages: StoryPage[]): Promise<Story | undefined>;
  updateStoryStatus(id: string, status: string): Promise<Story | undefined>;
  updateStoryCoreImage(id: string, coreImageUrl: string): Promise<Story | undefined>;
  updateStoryCoreImageFileId(id: string, fileId: string): Promise<Story | undefined>;
  updateStoryPageImage(id: string, pageNumber: number, imageUrl: string): Promise<Story | undefined>;
  updateStoryExpandedSetting(id: string, expandedSetting: string): Promise<Story | undefined>;
  updateStoryExtractedCharacters(id: string, characters: Character[]): Promise<Story | undefined>;
  updateCharacterImage(id: string, characterName: string, imageUrl: string): Promise<Story | undefined>;
  updateCharacterImageFileId(id: string, characterName: string, fileId: string): Promise<Story | undefined>;
  updateStoryPageImageFileId(id: string, pageNumber: number, fileId: string): Promise<Story | undefined>;
  
  // Revision methods
  createRevision(revision: InsertStoryRevision): Promise<StoryRevision>;
  getRevisions(storyId: string): Promise<StoryRevision[]>;
  getRevision(storyId: string, revisionNumber: number): Promise<StoryRevision | undefined>;
  loadRevisionAsCurrentStory(storyId: string, revisionNumber: number): Promise<Story | undefined>;
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
      (user) => user.email === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async upsertUser(userData: any): Promise<User> {
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      // Update existing user
      const updatedUser = { 
        ...existingUser, 
        name: userData.name,
        profileImageUrl: userData.profileImageUrl 
      };
      this.users.set(existingUser.id, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const id = randomUUID();
      const now = new Date();
      const user: User = {
        id: userData.googleId || id,
        email: userData.email,
        name: userData.name,
        profileImageUrl: userData.profileImageUrl || null,
        googleId: userData.googleId || null,
        openaiApiKey: null,
        openaiBaseUrl: null,
        replicateApiKey: null,
        preferredImageProvider: null,
        preferredReplicateModel: null,
        replicateModelTemplates: [],
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(user.id, user);
      return user;
    }
  }

  async updateUserOpenAI(userId: string, apiKey: string, baseUrl?: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      openaiApiKey: apiKey,
      openaiBaseUrl: baseUrl || null,
      updatedAt: new Date()
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserProfile(userId: string, profileData: { replicateApiKey?: string; preferredImageProvider?: string; preferredReplicateModel?: string }): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      ...(profileData.replicateApiKey !== undefined && { replicateApiKey: profileData.replicateApiKey || null }),
      ...(profileData.preferredImageProvider !== undefined && { preferredImageProvider: profileData.preferredImageProvider }),
      ...(profileData.preferredReplicateModel !== undefined && { preferredReplicateModel: profileData.preferredReplicateModel || null }),
      updatedAt: new Date()
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
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

  async updateStoryPageImage(id: string, pageNumber: number, imageUrl: string, prompt?: string): Promise<Story | undefined> {
    const story = this.stories.get(id);
    if (!story) return undefined;

    const updatedPages = story.pages.map(page => {
      if (page.pageNumber === pageNumber) {
        const currentHistory = page.imageHistory || [];
        
        // Mark previous images as inactive
        const inactiveHistory = currentHistory.map(h => ({ ...h, isActive: false }));
        
        // Add current image to history if it exists
        if (page.imageUrl) {
          inactiveHistory.push({
            url: page.imageUrl,
            prompt: page.imagePrompt || undefined,
            createdAt: new Date().toISOString(),
            isActive: false
          });
        }
        
        // Add new image as active
        const newHistory = [...inactiveHistory, {
          url: imageUrl,
          prompt: prompt,
          createdAt: new Date().toISOString(),
          isActive: true
        }];
        
        return { 
          ...page, 
          imageUrl, 
          imagePrompt: prompt,
          imageHistory: newHistory
        };
      }
      return page;
    });

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

    const updatedCharacters = story.extractedCharacters?.map(char =>
      char.name === characterName
        ? { ...char, imageUrl }
        : char
    ) || [];

    return this.updateStory(id, { extractedCharacters: updatedCharacters });
  }

  // Revision methods - simplified implementations for MemStorage
  async createRevision(revision: InsertStoryRevision): Promise<StoryRevision> {
    const id = randomUUID();
    const newRevision: StoryRevision = {
      id,
      ...revision,
      createdAt: new Date(),
    };
    // In memory storage - not persisted
    return newRevision;
  }

  async getRevisions(storyId: string): Promise<StoryRevision[]> {
    // Return empty array for MemStorage
    return [];
  }

  async getRevision(storyId: string, revisionNumber: number): Promise<StoryRevision | undefined> {
    // Return undefined for MemStorage
    return undefined;
  }

  async loadRevisionAsCurrentStory(storyId: string, revisionNumber: number): Promise<Story | undefined> {
    // Return undefined for MemStorage
    return undefined;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Since we're using email as the main identifier, we'll search by email
    return this.getUserByEmail(username);
  }
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    
    // Decrypt API keys before returning to client
    return {
      ...user,
      openaiApiKey: decryptApiKey(user.openaiApiKey),
      replicateApiKey: decryptApiKey(user.replicateApiKey),
    };
  }

  async createUser(insertUser: Omit<InsertUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createStory(insertStory: Omit<InsertStory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Story> {
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

  async updateStoryPageImage(id: string, pageNumber: number, imageUrl: string, prompt?: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    const updatedPages = story.pages.map(page => {
      if (page.pageNumber === pageNumber) {
        const currentHistory = page.imageHistory || [];
        
        // Mark previous images as inactive
        const inactiveHistory = currentHistory.map(h => ({ ...h, isActive: false }));
        
        // Add current image to history if it exists
        if (page.imageUrl) {
          inactiveHistory.push({
            url: page.imageUrl,
            prompt: page.imagePrompt || undefined,
            createdAt: new Date().toISOString(),
            isActive: false
          });
        }
        
        // Add new image as active
        const newHistory = [...inactiveHistory, {
          url: imageUrl,
          prompt: prompt,
          createdAt: new Date().toISOString(),
          isActive: true
        }];
        
        return { 
          ...page, 
          imageUrl, 
          imagePrompt: prompt,
          imageHistory: newHistory
        };
      }
      return page;
    });

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
    if (!story || !story.extractedCharacters) return undefined;

    const updatedCharacters = story.extractedCharacters.map(char =>
      char.name === characterName
        ? { ...char, imageUrl }
        : char
    );

    return this.updateStory(id, { extractedCharacters: updatedCharacters });
  }

  // Revision methods
  async createRevision(revision: InsertStoryRevision): Promise<StoryRevision> {
    const [newRevision] = await db
      .insert(storyRevisions)
      .values(revision)
      .returning();
    return newRevision;
  }

  async getRevisions(storyId: string): Promise<StoryRevision[]> {
    return await db
      .select()
      .from(storyRevisions)
      .where(eq(storyRevisions.storyId, storyId))
      .orderBy(desc(storyRevisions.revisionNumber));
  }

  async getRevision(storyId: string, revisionNumber: number): Promise<StoryRevision | undefined> {
    const [revision] = await db
      .select()
      .from(storyRevisions)
      .where(and(
        eq(storyRevisions.storyId, storyId),
        eq(storyRevisions.revisionNumber, revisionNumber)
      ));
    return revision || undefined;
  }

  async loadRevisionAsCurrentStory(storyId: string, revisionNumber: number): Promise<Story | undefined> {
    const revision = await this.getRevision(storyId, revisionNumber);
    if (!revision) return undefined;

    // Update the main story with the revision data
    const updatedStory = await this.updateStory(storyId, {
      title: revision.title,
      setting: revision.setting,
      expandedSetting: revision.expandedSetting,
      characters: revision.characters,
      extractedCharacters: revision.extractedCharacters,
      plot: revision.plot,
      ageGroup: revision.ageGroup,
      totalPages: revision.totalPages,
      pages: revision.pages,
      coreImageUrl: revision.coreImageUrl,
      status: revision.status,
      currentRevision: revisionNumber,
    });

    return updatedStory;
  }

  async getUserStories(userId: string): Promise<Story[]> {
    return await db.select().from(stories).where(eq(stories.userId, userId)).orderBy(desc(stories.createdAt));
  }

  async toggleStoryBookmark(id: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    const newBookmarkStatus = story.isBookmarked ? 0 : 1;
    return this.updateStory(id, { isBookmarked: newBookmarkStatus });
  }

  async upsertUser(googleData: {
    googleId: string;
    email: string;
    name: string;
    profileImageUrl?: string;
  }): Promise<User> {
    const [existingUser] = await db.select().from(users).where(eq(users.googleId, googleData.googleId));
    
    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({
          email: googleData.email,
          name: googleData.name,
          profileImageUrl: googleData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updatedUser;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          googleId: googleData.googleId,
          email: googleData.email,
          name: googleData.name,
          profileImageUrl: googleData.profileImageUrl,
        })
        .returning();
      return newUser;
    }
  }

  async updateUserOpenAI(userId: string, openaiApiKey: string, openaiBaseUrl?: string): Promise<User | undefined> {
    const encryptedApiKey = encryptApiKey(openaiApiKey);
    
    const [updatedUser] = await db
      .update(users)
      .set({
        openaiApiKey: encryptedApiKey,
        openaiBaseUrl: openaiBaseUrl || "https://api.openai.com/v1",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      // Decrypt API keys before returning to client
      return {
        ...updatedUser,
        openaiApiKey: decryptApiKey(updatedUser.openaiApiKey),
        replicateApiKey: decryptApiKey(updatedUser.replicateApiKey),
      };
    }
    return undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User | undefined> {
    // Prepare update data with encryption for sensitive fields
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Encrypt API keys if present
    if (data.openaiApiKey !== undefined) {
      updateData.openaiApiKey = data.openaiApiKey ? encryptApiKey(data.openaiApiKey) : null;
    }
    if (data.replicateApiKey !== undefined) {
      updateData.replicateApiKey = data.replicateApiKey ? encryptApiKey(data.replicateApiKey) : null;
    }
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      // Decrypt API keys before returning to client
      return {
        ...updatedUser,
        openaiApiKey: decryptApiKey(updatedUser.openaiApiKey),
        replicateApiKey: decryptApiKey(updatedUser.replicateApiKey),
      };
    }
    return undefined;
  }

  async updateUserProfile(userId: string, profileData: { replicateApiKey?: string; preferredImageProvider?: string; preferredReplicateModel?: string }): Promise<User | undefined> {
    // Only include fields that are defined and not empty strings
    const updateData: any = { updatedAt: new Date() };
    
    if (profileData.replicateApiKey !== undefined) {
      updateData.replicateApiKey = profileData.replicateApiKey ? encryptApiKey(profileData.replicateApiKey) : null;
    }
    if (profileData.preferredImageProvider !== undefined) {
      updateData.preferredImageProvider = profileData.preferredImageProvider;
    }
    if (profileData.preferredReplicateModel !== undefined) {
      updateData.preferredReplicateModel = profileData.preferredReplicateModel || null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      // Decrypt API keys before returning to client
      return {
        ...updatedUser,
        openaiApiKey: decryptApiKey(updatedUser.openaiApiKey),
        replicateApiKey: decryptApiKey(updatedUser.replicateApiKey),
      };
    }
    return undefined;
  }
  // File ID update methods
  async updateStoryCoreImageFileId(id: string, fileId: string): Promise<Story | undefined> {
    return this.updateStory(id, { coreImageFileId: fileId });
  }

  async updateCharacterImageFileId(id: string, characterName: string, fileId: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    // Update the character's imageFileId
    const updatedCharacters = story.extractedCharacters?.map(char => 
      char.name === characterName ? { ...char, imageFileId: fileId } : char
    ) || [];

    return this.updateStory(id, { extractedCharacters: updatedCharacters });
  }

  async updateStoryPageImageFileId(id: string, pageNumber: number, fileId: string): Promise<Story | undefined> {
    const story = await this.getStory(id);
    if (!story) return undefined;

    // Update the specific page's imageFileId
    const updatedPages = story.pages.map(page =>
      page.pageNumber === pageNumber ? { ...page, imageFileId: fileId } : page
    );

    return this.updateStory(id, { pages: updatedPages });
  }
}

export const storage = new DatabaseStorage();
