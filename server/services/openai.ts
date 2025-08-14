import OpenAI from "openai";
import { type CreateStory, type StoryPage } from "@shared/schema";
import { generateDemoStoryText, generateDemoCoreImageUrl, generateDemoPageImageUrl } from "./demo-data";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "your-api-key-here"
});

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
}

const USE_DEMO_MODE = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-api-key-here";

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
      quality: "standard",
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
  characters?: string
): Promise<string> {
  // Check for demo mode or fallback
  if (USE_DEMO_MODE) {
    console.log("Using demo mode for page image generation");
    const pageNumber = parseInt(pageText.split(' ')[0]) || 1;
    return generateDemoPageImageUrl(pageNumber, pageText);
  }

  const contextDescription = setting && characters 
    ? `Setting: ${setting}\nCharacters: ${characters}\n` 
    : "";

  const previousPageContext = previousPageImageUrl 
    ? "Maintain visual consistency with the previous page illustration." 
    : "";

  const prompt = `Create a beautiful children's book illustration for this page of text:

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
      quality: "standard",
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
