import OpenAI from 'openai';
import type { ReplicateModelTemplate, ReplicateModelInputProperty } from '@shared/schema';

export class ModelSchemaAnalyzer {
  private openai: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });
  }

  async analyzeModelSchema(modelSchema: any): Promise<ReplicateModelTemplate> {
    try {
      const { modelId, name, description, inputSchema, outputSchema, version } = modelSchema;

      // Extract properties from the input schema
      const properties = inputSchema?.properties || {};
      const required = inputSchema?.required || [];

      // Create prompt for LLM analysis
      const analysisPrompt = `You are an expert at analyzing Replicate model input schemas. Analyze this model schema and identify:
1. Which property is the MAIN PROMPT field (receives text descriptions/instructions)
2. Which properties are IMAGE INPUT fields (receive image URLs or base64 data) - FIND ALL OF THEM
3. Which image fields accept ARRAYS of images vs single images
4. All other properties and their purposes

IMPORTANT: Many models accept multiple images for different purposes:
- Primary input image
- Reference/style images
- Conditioning images
- Image masks
- Previous generation images

Some models like google/nano-banana accept ARRAYS of images in a single field.
Look for:
- type: "array" with items.type: "string" and items.format: "uri"
- Fields that explicitly mention multiple images or arrays
- Descriptions that reference "images" (plural) or "list of images"

Model: ${modelId}
Name: ${name || 'Unknown'}
Description: ${description || 'No description'}

Input Schema Properties:
${JSON.stringify(properties, null, 2)}

Required fields: ${JSON.stringify(required)}

Please respond with a JSON object in this exact format:
{
  "promptField": "property_name_that_receives_main_prompt_text",
  "imageFields": ["property1", "property2", "..."],
  "imageFieldTypes": {
    "property1": "primary|reference|style|mask|conditioning|other",
    "property2": "primary|reference|style|mask|conditioning|other"
  },
  "imageArrayFields": ["field1_that_accepts_image_arrays", "field2_that_accepts_image_arrays"],
  "analysis": {
    "property_name": {
      "purpose": "brief description of what this property does",
      "isPromptField": true/false,
      "isImageField": true/false,
      "imageFieldType": "primary|reference|style|mask|conditioning|other (if isImageField=true)",
      "acceptsArray": true/false
    }
  }
}

Rules:
- promptField should be the ONE main text prompt property (usually "prompt", "text", "instruction", etc.)
- imageFields should include ALL properties that accept image URLs or base64 data (both single and array)
- imageArrayFields should include only fields that accept arrays of images
- imageFieldTypes should categorize each image field by its purpose
- Mark isPromptField=true for only the main prompt property
- Mark isImageField=true for ALL image input properties
- Mark acceptsArray=true for fields that accept arrays of images
- Be thorough - don't miss any image fields or array fields
- Be accurate and conservative in your analysis`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing Replicate model schemas. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const analysisResult = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Build the template with analyzed data
      const analyzedProperties: Record<string, ReplicateModelInputProperty> = {};

      for (const [propName, propSchema] of Object.entries(properties)) {
        const analysis = analysisResult.analysis?.[propName] || {};
        const prop = propSchema as any;

        analyzedProperties[propName] = {
          name: propName,
          type: prop.type || 'string',
          description: prop.description || analysis.purpose || '',
          default: prop.default,
          required: required.includes(propName),
          enum: prop.enum,
          minimum: prop.minimum,
          maximum: prop.maximum,
          isPromptField: analysis.isPromptField === true,
          isImageField: analysis.isImageField === true,
          imageFieldType: analysis.imageFieldType || undefined,
          acceptsArray: analysis.acceptsArray === true
        };
      }

      const template: ReplicateModelTemplate = {
        modelId,
        modelName: name,
        inputSchema: {
          type: inputSchema?.type || 'object',
          properties: analyzedProperties,
          required
        },
        outputSchema,
        promptField: analysisResult.promptField,
        imageFields: analysisResult.imageFields || [],
        imageFieldTypes: analysisResult.imageFieldTypes || {},
        imageArrayFields: analysisResult.imageArrayFields || [],
        userValues: {}, // Empty initially, user will configure
        lastAnalyzed: new Date().toISOString()
      };

      return template;

    } catch (error) {
      console.error('Error analyzing model schema:', error);
      throw new Error('Failed to analyze model schema with LLM');
    }
  }

  async reanalyzeTemplate(template: ReplicateModelTemplate): Promise<ReplicateModelTemplate> {
    // Re-analyze an existing template with fresh LLM analysis
    const modelSchema = {
      modelId: template.modelId,
      name: template.modelName,
      description: 'Reanalysis',
      inputSchema: template.inputSchema,
      outputSchema: template.outputSchema,
      version: 'latest'
    };

    const freshTemplate = await this.analyzeModelSchema(modelSchema);
    
    // Preserve user values from the old template
    freshTemplate.userValues = template.userValues || {};
    
    return freshTemplate;
  }
}