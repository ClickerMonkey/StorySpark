import OpenAI from "openai";
import { type CreateStory, type StoryPage, type Character } from "@shared/schema";

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
}

function createOpenAIClient(apiKey: string, baseURL?: string) {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }
  
  return new OpenAI({ 
    apiKey,
    baseURL: baseURL || "https://api.openai.com/v1"
  });
}

export async function expandSetting(setting: string, characters: string, plot: string, ageGroup: string, apiKey: string, baseURL?: string): Promise<string> {
  const openai = createOpenAIClient(apiKey, baseURL);

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
    throw new Error("Failed to expand setting. Please check your API key and try again.");
  }
}

export async function extractCharacters(characters: string, setting: string, ageGroup: string, apiKey: string, baseURL?: string): Promise<Character[]> {
  const openai = createOpenAIClient(apiKey, baseURL);

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
    throw new Error("Failed to extract characters. Please check your API key and try again.");
  }
}

export async function generateCharacterImage(character: Character, setting: string, apiKey: string, baseURL?: string): Promise<string> {
  const openai = createOpenAIClient(apiKey, baseURL);

  const prompt = `Create a beautiful character portrait for a children's storybook:

Character: ${character.name}
Description: ${character.description}
Setting context: ${setting}

Style requirements:
- Child-friendly, cartoonish illustration style
- Bright, vibrant colors
- Clear character design suitable for children's books
- Show the character's personality through expression and pose
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only`;

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from OpenAI");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating character image:", error);
    throw new Error("Failed to generate character image. Please check your API key and try again.");
  }
}

export async function generateStoryText(story: CreateStory, expandedSetting: string, characters: Character[], apiKey: string, baseURL?: string): Promise<GeneratedStory> {
  const openai = createOpenAIClient(apiKey, baseURL);

  const characterDescriptions = characters.map(c => `${c.name}: ${c.description}`).join('\n');
  
  const prompt = `Create a complete ${story.totalPages}-page children's story with the following details:

Title: Generate an engaging title
Setting: ${expandedSetting}
Characters: ${characterDescriptions}
Plot: ${story.plot}
Age Group: ${story.ageGroup}
Total Pages: ${story.totalPages}

Requirements:
- Each page should have 2-4 sentences of story text
- Text should be age-appropriate for ${story.ageGroup} year olds
- Include all the characters meaningfully
- Create a complete story arc with beginning, middle, and satisfying end
- Use simple, engaging language that children can understand
- Make it educational or include a positive message
- Ensure the story flows naturally across all ${story.totalPages} pages

Please return a JSON response in this exact format:
{
  "title": "Story Title",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page 1 text content..."
    },
    {
      "pageNumber": 2, 
      "text": "Page 2 text content..."
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert children's book author. Create engaging, age-appropriate stories that inspire imagination and learning. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      title: result.title || "My Story",
      pages: result.pages || []
    };
  } catch (error) {
    console.error("Error generating story text:", error);
    throw new Error("Failed to generate story text. Please check your API key and try again.");
  }
}

export async function generateCoreImage(setting: string, characters: Character[], apiKey: string, baseURL?: string): Promise<string> {
  const openai = createOpenAIClient(apiKey, baseURL);

  const characterDescriptions = characters.length > 0
    ? characters.map(c => `${c.name}: ${c.description}`).join('\n')
    : "";

  const prompt = `Create a beautiful core reference image for a children's storybook:

Setting: ${setting}
${characterDescriptions ? `Characters:\n${characterDescriptions}` : ""}

This image will serve as the visual foundation for the entire story. Create a scene that captures:
- The overall mood and atmosphere of the setting
- Key characters in a natural, welcoming scene
- The magical or special elements of this world
- A composition that could serve as a book cover

Style requirements:
- Bright, vibrant colors
- Cartoonish, friendly art style appropriate for children
- Clear, well-defined characters and environment
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only`;

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from OpenAI");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating core image:", error);
    throw new Error("Failed to generate core image. Please check your API key and try again.");
  }
}

export async function generatePageImage(
  pageText: string, 
  coreImageUrl: string, 
  previousPageImageUrl: string | undefined,
  setting: string | undefined,
  characters: Character[] | undefined,
  apiKey: string,
  baseURL?: string,
  customPrompt?: string
): Promise<string> {
  const openai = createOpenAIClient(apiKey, baseURL);

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
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024", 
      quality: "hd",
    });

    if (!response.data?.[0]?.url) {
      throw new Error("No image URL returned from OpenAI");
    }

    return response.data[0].url;
  } catch (error) {
    console.error("Error generating page image:", error);
    throw new Error("Failed to generate page image. Please check your API key and try again.");
  }
}