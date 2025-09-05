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
      quality: "high",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      throw new Error("No image data returned from OpenAI");
    }

    // Handle both URL and base64 responses
    if (imageData.url) {
      return imageData.url;
    } else if (imageData.b64_json) {
      // Convert base64 to data URL for direct use
      return `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 data returned from OpenAI");
    }
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

export async function regenerateCoreImage(setting: string, characters: Character[], customPrompt: string, useReference: boolean, apiKey: string, baseURL?: string, existingImageUrl?: string): Promise<string> {
  const openai = createOpenAIClient(apiKey, baseURL);

  const characterDescriptions = characters.length > 0
    ? characters.map(c => `${c.name}: ${c.description}`).join('\n')
    : "";

  const referenceText = useReference && existingImageUrl
    ? `\n\nIMPORTANT: Use the current core image as a visual reference. Maintain the same character designs, art style, and overall composition while incorporating the changes requested below.`
    : "";

  const prompt = `${customPrompt}

Setting context: ${setting}
${characterDescriptions ? `Characters:\n${characterDescriptions}` : ""}

This is the core reference image for a children's storybook that will guide all other illustrations. ${referenceText}

Style requirements:
- Child-friendly, cartoonish illustration style
- Bright, vibrant colors
- Clear character design suitable for children's books
- Show the overall mood and atmosphere of the story
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only

${useReference ? "Focus on making the requested modifications while preserving the established visual style and character designs." : "Create a scene that captures the magical or special elements of this world and could serve as a book cover."}`;

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      throw new Error("No image data returned from OpenAI");
    }

    // Handle both URL and base64 responses
    if (imageData.url) {
      return imageData.url;
    } else if (imageData.b64_json) {
      // Convert base64 to data URL for direct use
      return `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 data returned from OpenAI");
    }
  } catch (error) {
    console.error("Error regenerating core image:", error);
    throw new Error("Failed to regenerate core image. Please check your API key and try again.");
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
      quality: "high",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      throw new Error("No image data returned from OpenAI");
    }

    // Handle both URL and base64 responses
    if (imageData.url) {
      return imageData.url;
    } else if (imageData.b64_json) {
      // Convert base64 to data URL for direct use
      return `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 data returned from OpenAI");
    }
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

  const coreImageContext = coreImageUrl 
    ? "CRITICAL: This story has a core reference image that defines the visual style, character designs, and overall artistic direction. You must maintain strict visual consistency with this core image in terms of character appearance, art style, color palette, and mood." 
    : "";

  const previousPageContext = previousPageImageUrl 
    ? "IMPORTANT: Maintain visual continuity with the previous page illustration to ensure smooth story flow." 
    : "";

  // Build comprehensive consistency prompt
  const consistencyPrompt = `${coreImageContext} ${previousPageContext}

VISUAL CONSISTENCY REQUIREMENTS:
- Use the EXACT same character designs, facial features, and proportions as shown in the core reference image
- Match the artistic style, line quality, and rendering technique from the core image
- Use a consistent color palette and lighting approach throughout
- Maintain the same level of detail and illustration quality
- Keep character clothing, accessories, and distinctive features identical across pages
- Ensure environmental elements (backgrounds, objects) match the established visual world`;

  // Always start with the page text and context, then add custom modifications if provided
  const basePrompt = `Create a beautiful children's book illustration for this page of text:

${pageText}

${contextDescription}

${customPrompt ? `CUSTOM MODIFICATIONS: ${customPrompt}

IMPORTANT: Apply these modifications while still illustrating the specific scene, events, and emotions described in the page text above.` : ""}

Style requirements:
- Bright, vibrant colors suitable for children
- Cartoonish, friendly illustration style
- Show the specific scene or action described in the text
- High quality digital illustration
- No text or words in the image
- Safe and wholesome content only`;

  const prompt = `${basePrompt}

${consistencyPrompt}

CRITICAL REQUIREMENTS:
1. The illustration MUST depict the specific scene, events, and emotions described in the page text
2. PERFECT visual consistency with the core reference image (character designs, art style, color palette)
3. If custom modifications were requested, apply them while preserving the story content and visual consistency
4. Characters must look exactly as they appear in the core reference image
5. The scene should clearly relate to what is happening in the page text`;

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024", 
      quality: "high",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      throw new Error("No image data returned from OpenAI");
    }

    // Handle both URL and base64 responses
    if (imageData.url) {
      return imageData.url;
    } else if (imageData.b64_json) {
      // Convert base64 to data URL for direct use
      return `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 data returned from OpenAI");
    }
  } catch (error) {
    console.error("Error generating page image:", error);
    throw new Error("Failed to generate page image. Please check your API key and try again.");
  }
}