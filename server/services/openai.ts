import OpenAI from "openai";
import { type CreateStory, type StoryPage, type Character } from "@shared/schema";
import { generateDemoStoryText, generateDemoCoreImageUrl, generateDemoPageImageUrl } from "./demo-data";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here"
});

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
}

const USE_DEMO_MODE = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-api-key-here";

export async function expandSetting(setting: string, characters: string, plot: string, ageGroup: string): Promise<string> {
  if (USE_DEMO_MODE) {
    return `${setting} is a magical place where extraordinary adventures unfold. The environment is vibrant and colorful, perfect for children aged ${ageGroup}. Every corner holds mysteries and wonders that spark imagination and curiosity.`;
  }

  const prompt = `Expand and enrich this story setting for a children's book suitable for ages ${ageGroup}:

Original Setting: ${setting}
Characters: ${characters}  
Plot: ${plot}

Please create a rich, detailed description of the setting that:
- Maintains the original essence but adds vivid, sensory details
- Is appropriate for children aged ${ageGroup}
- Creates an immersive world that supports the story and characters
- Uses child-friendly language and imagery
- Is 2-3 paragraphs long
- Focuses on visual, magical, or wonder-inspiring elements

Return only the expanded setting description, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional children's book author who creates vivid, engaging settings. Focus on creating magical, safe, and wonder-filled environments that capture children's imagination."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || setting;
  } catch (error) {
    console.error("Error expanding setting:", error);
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      return `${setting} is a magical place where extraordinary adventures unfold. The environment is vibrant and colorful, perfect for children aged ${ageGroup}. Every corner holds mysteries and wonders that spark imagination and curiosity.`;
    }
    throw new Error("Failed to expand setting. Please try again.");
  }
}

export async function extractCharacters(characters: string, setting: string, ageGroup: string): Promise<Character[]> {
  if (USE_DEMO_MODE) {
    const characterNames = characters.split(',').map(c => c.trim()).slice(0, 4);
    return characterNames.map((name, index) => ({
      name: name || `Character ${index + 1}`,
      description: `A brave and kind character who loves adventures. They have a special talent for making friends and solving problems with creativity and courage.`
    }));
  }

  const prompt = `Extract and expand character details for a children's story suitable for ages ${ageGroup}:

Characters mentioned: ${characters}
Setting: ${setting}

Please analyze the characters and create detailed descriptions. Return a JSON response with this exact format:
{
  "characters": [
    {
      "name": "Character Name",
      "description": "Detailed description including personality, appearance, and role"
    }
  ]
}

Requirements:
- Extract individual characters from the text
- Create 2-4 main characters maximum
- Each description should be 2-3 sentences
- Focus on personality traits, appearance, and special abilities
- Use age-appropriate language
- Make characters diverse and relatable for children`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a children's book character developer. Create diverse, relatable characters with clear personalities and child-friendly descriptions. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.characters || [];
  } catch (error) {
    console.error("Error extracting characters:", error);
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      const characterNames = characters.split(',').map(c => c.trim()).slice(0, 4);
      return characterNames.map((name, index) => ({
        name: name || `Character ${index + 1}`,
        description: `A brave and kind character who loves adventures. They have a special talent for making friends and solving problems with creativity and courage.`
      }));
    }
    throw new Error("Failed to extract characters. Please try again.");
  }
}

export async function generateCharacterImage(character: Character, setting: string): Promise<string> {
  if (USE_DEMO_MODE) {
    return `https://via.placeholder.com/512x512/8B5CF6/FFFFFF?text=${encodeURIComponent(character.name)}`;
  }

  const prompt = `Create a beautiful character portrait for a children's storybook:

Character: ${character.name}
Description: ${character.description}
Setting context: ${setting}

Style requirements:
- Child-friendly, cartoonish illustration style
- Bright, vibrant colors
- Clear character design suitable for children's books
- Show the character's personality through expression and pose
- Safe and wholesome content only
- High quality digital artwork
- Focus on the character, simple background or transparent background`;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from DALL-E");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating character image:", error);
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      return `https://via.placeholder.com/512x512/8B5CF6/FFFFFF?text=${encodeURIComponent(character.name)}`;
    }
    throw new Error("Failed to generate character image. Please try again.");
  }
}

export async function generateStoryText(storyInput: CreateStory): Promise<GeneratedStory> {
  // Check for insufficient quota or demo mode
  if (USE_DEMO_MODE) {
    console.log("Using demo mode for story generation");
    return generateDemoStoryText(storyInput);
  }

  const { setting, characters, plot, totalPages, ageGroup } = storyInput;

  const prompt = `Create a children's story suitable for ages ${ageGroup}. The story should have exactly ${totalPages} pages.

Setting: ${setting}
Characters: ${characters}
Plot: ${plot}

Requirements:
- Each page should have 50-150 words of engaging, age-appropriate text
- The story should be complete and satisfying
- Include dialogue and action appropriate for the age group
- Ensure the story flows naturally across all pages
- Generate a catchy, child-friendly title

Return the response as JSON in this exact format:
{
  "title": "Story Title Here",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page 1 text content here..."
    },
    {
      "pageNumber": 2,
      "text": "Page 2 text content here..."
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional children's book author who creates engaging, educational, and age-appropriate stories. Always respond with valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (!result.title || !result.pages || !Array.isArray(result.pages)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return result as GeneratedStory;
  } catch (error) {
    console.error("Error generating story text:", error);
    // Fallback to demo mode if API fails
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      console.log("OpenAI quota exceeded, falling back to demo mode");
      return generateDemoStoryText(storyInput);
    }
    throw new Error("Failed to generate story text. Please try again.");
  }
}

export async function generateCoreImage(setting: string, characters: string): Promise<string> {
  // Check for demo mode or fallback
  if (USE_DEMO_MODE) {
    console.log("Using demo mode for core image generation");
    return generateDemoCoreImageUrl(setting, characters);
  }

  const prompt = `Create a beautiful, child-friendly illustration showing the main characters and setting for a children's storybook. 

Setting: ${setting}
Characters: ${characters}

Style requirements:
- Bright, vibrant colors
- Cartoonish, friendly art style appropriate for children
- Clear, well-defined characters and environment
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only`;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from DALL-E");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating core image:", error);
    // Fallback to demo mode if API fails
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      console.log("OpenAI quota exceeded, falling back to demo mode");
      return generateDemoCoreImageUrl(setting, characters);
    }
    throw new Error("Failed to generate core image. Please try again.");
  }
}

export async function generatePageImage(
  pageText: string, 
  coreImageUrl: string, 
  previousPageImageUrl?: string,
  setting?: string,
  characters?: Character[],
  customPrompt?: string
): Promise<string> {
  // Check for demo mode or fallback
  if (USE_DEMO_MODE) {
    console.log("Using demo mode for page image generation");
    const pageNumber = parseInt(pageText.split(' ')[0]) || 1;
    return generateDemoPageImageUrl(pageNumber, pageText);
  }

  const characterDescriptions = characters && characters.length > 0
    ? `Characters in this story:\n${characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}\n`
    : "";
    
  const contextDescription = setting 
    ? `Setting: ${setting}\n${characterDescriptions}` 
    : characterDescriptions;

  const previousPageContext = previousPageImageUrl 
    ? "Maintain visual consistency with the previous page illustration." 
    : "";

  // Use custom prompt if provided, otherwise use default
  const prompt = customPrompt || `Create a beautiful children's book illustration for this page of text:

${pageText}

${contextDescription}

Style requirements:
- Maintain consistent character designs and art style with the core reference image
- Bright, vibrant colors suitable for children
- Cartoonish, friendly illustration style
- Show the specific scene or action described in the text
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only
- ${previousPageContext}

The illustration should directly relate to the events or emotions described in the page text while maintaining visual consistency throughout the story.`;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024", 
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from DALL-E");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating page image:", error);
    // Fallback to demo mode if API fails
    if (error instanceof Error && (error.message.includes('insufficient_quota') || error.message.includes('429'))) {
      console.log("OpenAI quota exceeded, falling back to demo mode");
      const pageNumber = parseInt(pageText.split(' ')[0]) || 1;
      return generateDemoPageImageUrl(pageNumber, pageText);
    }
    throw new Error("Failed to generate page image. Please try again.");
  }
}
