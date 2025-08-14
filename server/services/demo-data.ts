import { type CreateStory, type StoryPage } from "@shared/schema";

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
}

// Demo story data for testing without OpenAI API calls
export function generateDemoStoryText(storyInput: CreateStory): GeneratedStory {
  const { setting, characters, plot, totalPages, ageGroup } = storyInput;
  
  // Create a sample story based on the inputs
  const title = `The Amazing Adventure in ${setting.split(' ').slice(-2).join(' ')}`;
  
  const pages: StoryPage[] = [];
  
  // Generate pages based on the total requested
  for (let i = 1; i <= totalPages; i++) {
    let pageText = "";
    
    if (i === 1) {
      pageText = `Once upon a time, in ${setting}, there lived ${characters}. They were about to embark on the most exciting adventure of their lives!`;
    } else if (i === 2) {
      pageText = `${characters} discovered something magical in ${setting}. ${plot} was just beginning, and they could hardly contain their excitement.`;
    } else if (i === 3) {
      pageText = `As ${characters} ventured deeper into their quest, they faced their first challenge. But with courage and friendship, they knew they could overcome anything.`;
    } else if (i === totalPages) {
      pageText = `After their incredible journey, ${characters} returned home as heroes. They had learned valuable lessons about friendship, courage, and believing in themselves. The end!`;
    } else {
      pageText = `${characters} continued their amazing adventure in ${setting}. Every step brought new surprises and helped them grow stronger and wiser.`;
    }
    
    // Adjust text length based on age group
    if (ageGroup === "3-5") {
      pageText = pageText.split('.').slice(0, 2).join('.') + '.';
    }
    
    pages.push({
      pageNumber: i,
      text: pageText,
    });
  }
  
  return {
    title,
    pages,
  };
}

export function generateDemoCoreImageUrl(setting: string, characters: string): string {
  // Return a placeholder image URL for demo purposes
  return `https://via.placeholder.com/1024x1024/4F46E5/FFFFFF?text=${encodeURIComponent('Core Image: ' + characters + ' in ' + setting.split(' ').slice(-2).join(' '))}`;
}

export function generateDemoPageImageUrl(pageNumber: number, pageText: string): string {
  // Return a placeholder image URL for demo purposes
  const shortText = pageText.split(' ').slice(0, 3).join(' ');
  return `https://via.placeholder.com/1024x1024/EC4899/FFFFFF?text=${encodeURIComponent('Page ' + pageNumber + ': ' + shortText + '...')}`;
}