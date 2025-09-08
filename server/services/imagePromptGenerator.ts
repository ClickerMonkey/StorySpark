import OpenAI from "openai";
import type { Story, StoryPage } from "@shared/schema";

export class ImagePromptGenerator {
  private openai: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  /**
   * Generates an optimized visual prompt for image generation based on story context
   */
  async generateImagePrompt(
    story: Story, 
    currentPage: StoryPage,
    previousPages: StoryPage[] = []
  ): Promise<string> {
    // Build concise context from previous pages
    const previousContext = previousPages.length > 0
      ? `Previous scenes: ${previousPages.map(p => `Page ${p.pageNumber}: ${p.text.substring(0, 100)}...`).join(' ')}`
      : "";
    
    // Extract key character info (names and brief descriptions)
    const characters = story.extractedCharacters || [];
    const characterInfo = characters.length > 0
      ? characters.map(c => `${c.name}: ${c.description.substring(0, 80)}...`).join(', ')
      : "";
    
    // Use condensed setting
    const setting = story.expandedSetting || story.setting || "";
    const condensedSetting = setting.length > 200 ? setting.substring(0, 200) + "..." : setting;
    
    const prompt = `You are an expert at creating visual descriptions for children's book illustrations. Generate a concise, vivid visual prompt that describes exactly what should appear in this illustration.

STORY CONTEXT:
Title: ${story.title}
Age Group: ${story.ageGroup}
Setting: ${condensedSetting}
${characterInfo ? `Characters: ${characterInfo}` : ""}
${story.storyGuidance ? `Story Theme: ${story.storyGuidance}` : ""}

CURRENT PAGE:
Page ${currentPage.pageNumber}: ${currentPage.text}
${currentPage.imageGuidance ? `Image Guidance: ${currentPage.imageGuidance}` : ""}

${previousContext}

INSTRUCTIONS:
- Create a focused visual description of what should be illustrated for the current page
- Include key visual elements: characters, setting details, actions, mood, lighting
- Maintain visual consistency with previous scenes mentioned
- Use vivid, descriptive language suitable for image generation
- Keep it concise (under 300 words) but visually rich
- Focus on what can be SEEN, not story narrative
- Include art style: "bright, vibrant colors suitable for children, cartoonish and friendly illustration style"

Generate the visual prompt:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert visual prompt generator for children's book illustrations. Create concise, vivid descriptions that focus on visual elements, characters, setting, and mood."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const generatedPrompt = response.choices[0]?.message?.content || "";
      
      // Ensure we always include the text exclusion instruction
      const finalPrompt = generatedPrompt + 
        "\n\nIMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested above.";
      
      console.log(`Generated image prompt for page ${currentPage.pageNumber}:`, finalPrompt.substring(0, 200) + "...");
      return finalPrompt;
      
    } catch (error) {
      console.error("Error generating image prompt:", error);
      
      // Fallback to basic prompt generation if LLM fails
      const fallbackPrompt = `Create a beautiful children's book illustration for: ${currentPage.text}
      
${characterInfo ? `Characters: ${characterInfo}` : ""}
Setting: ${condensedSetting}
${story.storyGuidance ? `Story guidance: ${story.storyGuidance}` : ""}
${currentPage.imageGuidance ? `Page guidance: ${currentPage.imageGuidance}` : ""}

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only

IMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested above.`;
      
      return fallbackPrompt;
    }
  }

  /**
   * Generates an optimized prompt for core story image generation
   */
  async generateCoreImagePrompt(story: Story, customPrompt?: string): Promise<string> {
    const characters = story.extractedCharacters || [];
    const characterInfo = characters.length > 0
      ? characters.map(c => `${c.name}: ${c.description.substring(0, 80)}...`).join(', ')
      : "";
    
    const setting = story.expandedSetting || story.setting || "";
    const condensedSetting = setting.length > 200 ? setting.substring(0, 200) + "..." : setting;
    
    const prompt = `You are an expert at creating visual descriptions for children's book cover art. Generate a compelling visual prompt that captures the essence of this entire story.

STORY OVERVIEW:
Title: ${story.title}
Age Group: ${story.ageGroup}
Plot: ${story.plot?.substring(0, 300)}...
Setting: ${condensedSetting}
${characterInfo ? `Main Characters: ${characterInfo}` : ""}
${story.storyGuidance ? `Story Theme: ${story.storyGuidance}` : ""}

${customPrompt ? `CUSTOM REQUIREMENTS: ${customPrompt}` : ""}

INSTRUCTIONS:
- Create a captivating visual description for the main story illustration
- Include the main characters in an iconic scene or setting
- Capture the story's mood, theme, and adventure
- Use vivid, descriptive language suitable for image generation
- Include art style: "bright, vibrant colors suitable for children, cartoonish and friendly illustration style"
- Focus on visual elements that represent the story's essence
- Keep it focused and under 250 words

Generate the core image visual prompt:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert visual prompt generator for children's book cover art. Create compelling, focused descriptions that capture story essence."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 350,
        temperature: 0.7,
      });

      const generatedPrompt = response.choices[0]?.message?.content || "";
      
      const finalPrompt = generatedPrompt +
        "\n\nIMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested above.";
      
      console.log("Generated core image prompt:", finalPrompt.substring(0, 200) + "...");
      return finalPrompt;
      
    } catch (error) {
      console.error("Error generating core image prompt:", error);
      
      // Fallback prompt
      const fallbackPrompt = `Create a beautiful children's book illustration representing the story "${story.title}"
      
${characterInfo ? `Characters: ${characterInfo}` : ""}
Setting: ${condensedSetting}
Plot: ${story.plot}
${story.storyGuidance ? `Story guidance: ${story.storyGuidance}` : ""}
${customPrompt ? `Custom modifications: ${customPrompt}` : ""}

Style: Bright, vibrant colors suitable for children, cartoonish and friendly illustration style, high quality digital illustration, safe and wholesome content only

IMPORTANT: Do not include any text, words, letters, or written language in the image unless specifically requested above.`;
      
      return fallbackPrompt;
    }
  }
}