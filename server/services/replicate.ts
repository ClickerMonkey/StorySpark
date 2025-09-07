import Replicate from "replicate";

// Helper function to truncate URLs for logging
function truncateForLog(value: any): string {
  if (typeof value === 'string') {
    return value.length > 128 ? `${value.substring(0, 128)}...` : value;
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => truncateForLog(v)).join(', ')}]`;
  }
  return String(value);
}

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
      console.log('=== REPLICATE MODELS.LIST CALL ===');
      console.log('Query:', query);
      console.log('Limit:', limit);
      console.log('===================================');
      
      const models = await this.replicate.models.list();
      
      console.log('Found', models.results?.length || 0, 'models from Replicate API');
      
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

  async getModelSchema(modelId: string): Promise<any> {
    try {
      console.log('=== REPLICATE MODELS.GET CALL ===');
      console.log('Model ID:', modelId);
      console.log('Owner:', modelId.split('/')[0]);
      console.log('Name:', modelId.split('/')[1]);
      console.log('==================================');
      
      // Get the model information including input/output schema
      const model = await this.replicate.models.get(modelId.split('/')[0], modelId.split('/')[1]);
      
      console.log('Model retrieved successfully:');
      console.log('- Name:', model.name);
      console.log('- Description:', model.description);
      console.log('- Has latest version:', !!model.latest_version);
      
      if (!model.latest_version) {
        throw new Error('Model has no available versions');
      }
      
      const schema = model.latest_version.openapi_schema as any;
      
      return {
        modelId,
        name: model.name,
        description: model.description,
        inputSchema: schema?.components?.schemas?.Input || {},
        outputSchema: schema?.components?.schemas?.Output || {},
        version: model.latest_version.id
      };
    } catch (error) {
      console.error('Error fetching model schema:', error);
      throw new Error(`Failed to fetch schema for model ${modelId}`);
    }
  }

  async generateImageWithTemplate(
    template: any, 
    prompt: string, 
    options: {
      primaryImage?: string;
      referenceImage?: string;
      styleImage?: string;
      additionalImages?: Record<string, string>; // Additional images by field name
      additionalPrompt?: string;
    } = {}
  ): Promise<string> {
    try {
      console.log('generateImageWithTemplate called with:');
      console.log('- modelId:', template.modelId);
      console.log('- prompt:', prompt);
      console.log('- options:', JSON.stringify(options, null, 2));
      console.log('- template imageArrayFields:', template.imageArrayFields);
      
      const input: any = {};
      
      // Apply user's configured values from template
      Object.assign(input, template.userValues || {});
      
      // Apply prompt to the identified prompt field
      if (template.promptField) {
        let finalPrompt = prompt;
        if (options.additionalPrompt) {
          finalPrompt = `${prompt}\n\n${options.additionalPrompt}`;
        }
        input[template.promptField] = finalPrompt;
      }
      
      // Apply images to their appropriate fields based on type
      if (template.imageFields && template.imageFieldTypes) {
        for (const imageField of template.imageFields) {
          const fieldType = template.imageFieldTypes[imageField];
          const isArrayField = template.imageArrayFields?.includes(imageField);
          
          if (isArrayField) {
            // For array fields, collect all available images into an array
            const imageArray: string[] = [];
            
            // Add images based on priority order
            if (options.primaryImage) imageArray.push(options.primaryImage);
            if (options.referenceImage && options.referenceImage !== options.primaryImage) {
              imageArray.push(options.referenceImage);
            }
            if (options.styleImage && !imageArray.includes(options.styleImage)) {
              imageArray.push(options.styleImage);
            }
            
            // Add any additional images that aren't already included
            if (options.additionalImages) {
              for (const additionalImage of Object.values(options.additionalImages)) {
                if (!imageArray.includes(additionalImage)) {
                  imageArray.push(additionalImage);
                }
              }
            }
            
            // Only set the array if we have images
            if (imageArray.length > 0) {
              console.log(`Setting array field '${imageField}' with ${imageArray.length} images:`, truncateForLog(imageArray));
              input[imageField] = imageArray;
            }
          } else {
            // For single image fields, use the standard logic
            let imageUrl: string | undefined;
            
            // Map image inputs to field types
            switch (fieldType) {
              case 'primary':
                imageUrl = options.primaryImage;
                break;
              case 'reference':
                imageUrl = options.referenceImage;
                break;
              case 'style':
                imageUrl = options.styleImage;
                break;
              default:
                // Check additional images for this specific field
                imageUrl = options.additionalImages?.[imageField];
                break;
            }
            
            // Apply the image if we have one
            if (imageUrl) {
              console.log(`Setting single image field '${imageField}' with:`, truncateForLog(imageUrl));
              input[imageField] = imageUrl;
            }
          }
        }
      }
      
      // Fallback: If no typed fields, use the first image field for primary image
      if (!template.imageFieldTypes && template.imageFields && template.imageFields.length > 0) {
        const firstImageField = template.imageFields[0];
        const isArrayField = template.imageArrayFields?.includes(firstImageField);
        
        if (isArrayField) {
          // For array fallback, collect available images
          const imageArray: string[] = [];
          if (options.primaryImage) imageArray.push(options.primaryImage);
          if (options.referenceImage && options.referenceImage !== options.primaryImage) {
            imageArray.push(options.referenceImage);
          }
          if (imageArray.length > 0) {
            console.log(`Fallback: Setting array field '${firstImageField}' with ${imageArray.length} images`);
            input[firstImageField] = imageArray;
          }
        } else {
          // For single image fallback
          const primaryImageUrl = options.primaryImage || options.referenceImage;
          if (primaryImageUrl) {
            console.log(`Fallback: Setting single image field '${firstImageField}'`);
            input[firstImageField] = primaryImageUrl;
          }
        }
      }
      
      console.log('=== REPLICATE TEMPLATE CALL ===');
      console.log('Model ID:', template.modelId);
      console.log('Input Object:', JSON.stringify(input, null, 2));
      console.log('================================');
      
      const output = await this.replicate.run(template.modelId as `${string}/${string}`, { input });
      
      // Handle different output formats
      if (Array.isArray(output)) {
        const firstItem = output[0];
        
        // Handle FileOutput objects (new Replicate behavior)
        if (firstItem && typeof firstItem === 'object' && typeof firstItem.url === 'function') {
          try {
            const url = firstItem.url();
            console.log('Successfully extracted URL from FileOutput.url():', truncateForLog(url));
            return url.toString();
          } catch (urlError) {
            console.error('Error getting URL from FileOutput.url():', urlError);
            console.log('FileOutput object keys:', Object.keys(firstItem));
            console.log('FileOutput object:', JSON.stringify(firstItem, null, 2));
            
            // Try to extract URL from object properties
            if (firstItem.href && typeof firstItem.href === 'string') {
              console.log('Found URL in href property:', firstItem.href);
              return firstItem.href;
            }
            if (firstItem.src && typeof firstItem.src === 'string') {
              console.log('Found URL in src property:', firstItem.src);
              return firstItem.src;
            }
            if (firstItem.path && typeof firstItem.path === 'string' && firstItem.path.startsWith('http')) {
              console.log('Found URL in path property:', firstItem.path);
              return firstItem.path;
            }
            
            // Check for direct URL property
            if (firstItem.url && typeof firstItem.url === 'string') {
              console.log('Found URL as string property:', truncateForLog(firstItem.url));
              return firstItem.url;
            }
            
            // Try custom toString only if it's a URL string
            if (firstItem.toString && firstItem.toString !== Object.prototype.toString) {
              try {
                const urlString = firstItem.toString();
                console.log('toString result:', truncateForLog(urlString));
                if (urlString && typeof urlString === 'string' && urlString.startsWith('http') && !urlString.includes('function')) {
                  console.log('Using toString result as URL:', truncateForLog(urlString));
                  return urlString;
                }
              } catch (toStringError) {
                console.error('Error calling toString on FileOutput:', toStringError);
              }
            }
            
            throw new Error(`Could not extract valid URL from FileOutput object. Available properties: ${Object.keys(firstItem).join(', ')}`);
          }
        }
        
        return firstItem as string;
      } else if (typeof output === 'string') {
        return output;
      } else if (output && typeof output === 'object' && 'url' in output) {
        return (output as any).url;
      }
      throw new Error('Unexpected output format from Replicate');
    } catch (error) {
      console.error('Error generating image with template:', error);
      throw new Error(`Failed to generate image with ${template.modelId}`);
    }
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
      additionalImages?: { [key: string]: string }; // Additional image inputs for multi-image models
    } = {}
  ): Promise<string> {
    
    try {
      console.log('generateImage called with:');
      console.log('- modelId:', modelId);
      console.log('- prompt:', prompt);
      console.log('- options:', JSON.stringify(options, null, 2));
      
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

        // Handle additional images for multi-image models
        if (options.additionalImages) {
          Object.entries(options.additionalImages).forEach(([key, value]) => {
            input[key] = value;
          });
        }
      }

      console.log('=== REPLICATE DIRECT CALL ===');
      console.log('Model ID:', modelId);
      console.log('Input Object:', JSON.stringify(input, null, 2));
      console.log('==============================');
      
      const output = await this.replicate.run(modelId as `${string}/${string}`, { input });
      
      console.log('generateImage - Raw Replicate output:', output);
      console.log('generateImage - Output type:', typeof output);
      console.log('generateImage - Is array?', Array.isArray(output));
      
      // Handle different output formats
      if (Array.isArray(output)) {
        const firstItem = output[0];
        console.log('generateImage - First item:', firstItem);
        console.log('generateImage - First item type:', typeof firstItem);
        console.log('generateImage - First item keys:', firstItem && typeof firstItem === 'object' ? Object.keys(firstItem) : 'N/A');
        console.log('generateImage - First item url type:', firstItem && typeof firstItem === 'object' ? typeof firstItem.url : 'N/A');
        
        // Handle FileOutput objects (new Replicate behavior)
        if (firstItem && typeof firstItem === 'object' && typeof firstItem.url === 'function') {
          try {
            const url = firstItem.url();
            console.log('generateImage - Successfully extracted URL from FileOutput.url():', url);
            return url.toString();
          } catch (urlError) {
            console.error('generateImage - Error getting URL from FileOutput.url():', urlError);
            console.log('generateImage - FileOutput object keys:', Object.keys(firstItem));
            console.log('generateImage - FileOutput object:', JSON.stringify(firstItem, null, 2));
            
            // Try to extract URL from object properties
            if (firstItem.href && typeof firstItem.href === 'string') {
              console.log('generateImage - Found URL in href property:', firstItem.href);
              return firstItem.href;
            }
            if (firstItem.src && typeof firstItem.src === 'string') {
              console.log('generateImage - Found URL in src property:', firstItem.src);
              return firstItem.src;
            }
            if (firstItem.path && typeof firstItem.path === 'string' && firstItem.path.startsWith('http')) {
              console.log('generateImage - Found URL in path property:', firstItem.path);
              return firstItem.path;
            }
            
            // Check for direct URL property
            if (firstItem.url && typeof firstItem.url === 'string') {
              console.log('generateImage - Found URL as string property:', firstItem.url);
              return firstItem.url;
            }
            
            // Try custom toString only if it's a URL string
            if (firstItem.toString && firstItem.toString !== Object.prototype.toString) {
              try {
                const urlString = firstItem.toString();
                console.log('generateImage - toString result:', urlString);
                if (urlString && typeof urlString === 'string' && urlString.startsWith('http') && !urlString.includes('function')) {
                  console.log('generateImage - Using toString result as URL:', urlString);
                  return urlString;
                }
              } catch (toStringError) {
                console.error('generateImage - Error calling toString on FileOutput:', toStringError);
              }
            }
            
            throw new Error(`generateImage - Could not extract valid URL from FileOutput object. Available properties: ${Object.keys(firstItem).join(', ')}`);
          }
        }
        
        console.log('generateImage - Returning firstItem as string:', firstItem);
        return firstItem as string;
      } else if (typeof output === 'string') {
        console.log('generateImage - Output is string, returning directly:', output);
        return output;
      } else if (output && typeof output === 'object' && 'url' in output) {
        console.log('generateImage - Found object with url property, type:', typeof output.url);
        // Handle case where the output object has a url function property
        if (typeof output.url === 'function') {
          console.log('generateImage - Found url function in output object, calling it...');
          try {
            const url = output.url();
            console.log('generateImage - Successfully got URL from output.url():', url);
            return url.toString();
          } catch (error) {
            console.error('generateImage - Error calling output.url():', error);
            throw new Error('generateImage - Failed to extract URL from output object with url function');
          }
        } else if (typeof output.url === 'string') {
          console.log('generateImage - Found URL string in output.url property:', output.url);
          return output.url;
        }
        console.log('generateImage - Returning output.url as any:', (output as any).url);
        return (output as any).url;
      }
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