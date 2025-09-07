import Replicate from "replicate";

export interface ReplicateModel {
  id: string;
  name: string;
  description: string;
  version: string;
  supportImageInput: boolean;
  category: string;
}

export class ReplicateService {
  private replicate: Replicate;

  constructor(apiKey: string) {
    this.replicate = new Replicate({
      auth: apiKey,
    });
  }

  async searchModels(query: string = "", limit: number = 20): Promise<ReplicateModel[]> {
    try {
      const models = await this.replicate.models.list();
      
      // Filter for image generation models
      const imageModels = models.results
        .filter(model => {
          const name = model.name.toLowerCase();
          const description = model.description?.toLowerCase() || '';
          
          // Look for image generation keywords
          const isImageModel = 
            name.includes('image') || 
            name.includes('img') || 
            name.includes('draw') || 
            name.includes('art') || 
            name.includes('picture') || 
            name.includes('generate') || 
            name.includes('create') ||
            description.includes('image') || 
            description.includes('generate') ||
            description.includes('create') ||
            description.includes('art') ||
            description.includes('picture');
          
          // Filter by search query if provided
          const matchesQuery = !query || 
            name.includes(query.toLowerCase()) || 
            description.includes(query.toLowerCase());
          
          return isImageModel && matchesQuery;
        })
        .slice(0, limit)
        .map(model => ({
          id: `${model.owner}/${model.name}`,
          name: model.name,
          description: model.description || 'No description available',
          version: model.latest_version?.id || 'latest',
          supportImageInput: this.checkImageInputSupport(model),
          category: this.categorizeModel(model.name, model.description || '')
        }));

      return imageModels;
    } catch (error) {
      console.error('Error searching Replicate models:', error);
      throw new Error('Failed to search models');
    }
  }

  async getPopularImageModels(): Promise<ReplicateModel[]> {
    // Popular image generation models on Replicate
    const popularModels = [
      {
        id: "stability-ai/stable-diffusion",
        name: "Stable Diffusion",
        description: "A latent text-to-image diffusion model capable of generating photo-realistic images",
        version: "latest",
        supportImageInput: false,
        category: "text-to-image"
      },
      {
        id: "stability-ai/sdxl",
        name: "SDXL",
        description: "A text-to-image generative AI model that creates beautiful images",
        version: "latest", 
        supportImageInput: false,
        category: "text-to-image"
      },
      {
        id: "playgroundai/playground-v2.5-1024px-aesthetic",
        name: "Playground v2.5",
        description: "Playground v2.5 is the state-of-the-art open-source model in aesthetic quality",
        version: "latest",
        supportImageInput: false,
        category: "text-to-image"
      },
      {
        id: "lucataco/realvisxl-v4.0",
        name: "RealVisXL v4.0",
        description: "Amazing photorealism with RealVisXL_V4.0_Lightning",
        version: "latest",
        supportImageInput: false,
        category: "photorealistic"
      },
      {
        id: "tencentarc/photomaker",
        name: "PhotoMaker",
        description: "Create photos, paintings and avatars for anyone in any style within seconds",
        version: "latest",
        supportImageInput: true,
        category: "image-to-image"
      }
    ];

    return popularModels;
  }

  async generateImage(
    modelId: string,
    prompt: string,
    options: {
      width?: number;
      height?: number;
      seed?: number;
      numSteps?: number;
      guidanceScale?: number;
      imageInput?: string; // Base64 or URL
    } = {}
  ): Promise<string> {
    console.log('=== REPLICATE GENERATION START ===');
    console.log('Model ID:', modelId);
    console.log('Prompt length:', prompt.length);
    console.log('Options:', options);
    
    try {
      const input: any = {
        prompt,
      };

      // Handle FLUX models which have different parameter formats
      if (modelId.includes('flux')) {
        // FLUX models use aspect_ratio and have limited parameters
        input.aspect_ratio = "1:1"; // Default to square, FLUX supports 1:1, 16:9, 21:9, 2:3, 3:2, 4:5, 5:4, 9:16, 9:21
        
        if (options.seed) {
          input.seed = options.seed;
        }
        
        // Only flux-dev and flux-pro support num_inference_steps, flux-schnell doesn't
        if (modelId.includes('flux-dev') || modelId.includes('flux-pro')) {
          input.num_inference_steps = options.numSteps || 50;
        }
        
        // FLUX models don't use guidance_scale
        // FLUX models don't use width/height directly
      } else {
        // Standard Stable Diffusion style parameters for other models
        input.width = options.width || 1024;
        input.height = options.height || 1024;
        input.num_inference_steps = options.numSteps || 50;
        input.guidance_scale = options.guidanceScale || 7.5;
        
        if (options.seed) {
          input.seed = options.seed;
        }

        if (options.imageInput) {
          input.image = options.imageInput;
        }
      }

      console.log('Final input being sent to Replicate:', JSON.stringify(input, null, 2));
      console.log('About to call replicate.run...');
      
      const output = await this.replicate.run(modelId, { input });
      
      console.log('Replicate.run completed successfully');
      
      console.log('Replicate output type:', typeof output);
      console.log('Replicate raw output:', output);
      
      // Handle different output formats
      if (Array.isArray(output)) {
        console.log('Replicate returned array, using first item:', output[0]);
        return output[0] as string;
      } else if (typeof output === 'string') {
        console.log('Replicate returned string:', output);
        return output;
      } else if (output && typeof output === 'object' && 'url' in output) {
        console.log('Replicate returned object with URL:', (output as any).url);
        return (output as any).url;
      }
      
      console.error('Unexpected Replicate output format:', output);
      throw new Error('Unexpected output format from Replicate');
    } catch (error) {
      console.error('Error generating image with Replicate:', error);
      throw new Error('Failed to generate image with Replicate');
    }
  }

  private checkImageInputSupport(model: any): boolean {
    // Check if model supports image input by looking at its schema
    const schema = model.latest_version?.openapi_schema;
    if (schema?.components?.schemas?.Input?.properties) {
      const properties = schema.components.schemas.Input.properties;
      return Object.keys(properties).some(key => 
        key.toLowerCase().includes('image') && 
        (properties[key].format === 'uri' || properties[key].type === 'string')
      );
    }
    return false;
  }

  private categorizeModel(name: string, description: string): string {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('photo') || text.includes('realistic') || text.includes('portrait')) {
      return 'photorealistic';
    } else if (text.includes('anime') || text.includes('cartoon') || text.includes('illustration')) {
      return 'artistic';
    } else if (text.includes('edit') || text.includes('modify') || text.includes('enhance')) {
      return 'image-to-image';
    } else {
      return 'text-to-image';
    }
  }
}

export async function createReplicateService(apiKey: string): Promise<ReplicateService> {
  return new ReplicateService(apiKey);
}