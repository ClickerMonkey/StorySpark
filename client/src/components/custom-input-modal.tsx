import { useState, useEffect } from 'react';
import type { Story, ReplicateModelTemplate } from '@shared/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCoreImageUrl, getPageImageUrl } from '@/utils/imageUrl';
import { Image, Type, Settings2, X } from 'lucide-react';

interface CustomInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReplicateModelTemplate;
  story: Story;
  onSubmit: (customInput: Record<string, any>) => void;
  title?: string;
}

interface ImageOption {
  id: string;
  label: string;
  url?: string;
  description: string;
}

interface ImageSelectionProps {
  fieldName: string;
  property: any;
  value: any;
  onChange: (value: any) => void;
  imageOptions: ImageOption[];
  isArrayField: boolean;
}

function ImageSelection({ fieldName, property, value, onChange, imageOptions, isArrayField }: ImageSelectionProps) {
  if (isArrayField) {
    // Multiple image selection for array fields
    const selectedImages = Array.isArray(value) ? value : [];
    
    const handleImageToggle = (imageId: string) => {
      const newSelection = selectedImages.includes(imageId)
        ? selectedImages.filter(id => id !== imageId)
        : [...selectedImages, imageId];
      onChange(newSelection);
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          {imageOptions.map((option) => (
            <div key={option.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id={`${fieldName}-${option.id}`}
                checked={selectedImages.includes(option.id)}
                onCheckedChange={() => handleImageToggle(option.id)}
              />
              <div className="flex-1">
                <Label htmlFor={`${fieldName}-${option.id}`} className="font-medium cursor-pointer">
                  {option.label}
                </Label>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
              {option.url && (
                <div className="w-12 h-12 rounded border overflow-hidden">
                  <img 
                    src={option.url} 
                    alt={option.label}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Selected: {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''}
        </p>
      </div>
    );
  } else {
    // Single image selection
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select an image" />
        </SelectTrigger>
        <SelectContent>
          {imageOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <div className="flex items-center gap-2">
                {option.url && (
                  <div className="w-6 h-6 rounded border overflow-hidden">
                    <img 
                      src={option.url} 
                      alt={option.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
}

/**
 * Modal for customizing model inputs with story-specific image selection.
 * Allows users to select which story images to use for each model field.
 */
export function CustomInputModal({ open, onOpenChange, template, story, onSubmit, title = "Customize Model Input" }: CustomInputModalProps) {
  const [customInput, setCustomInput] = useState<Record<string, any>>({});

  // Generate image options from the story
  const imageOptions: ImageOption[] = [
    {
      id: 'none',
      label: 'No Image',
      description: 'Do not use any image for this field'
    }
  ];

  // Add core image if available
  if (getCoreImageUrl(story)) {
    imageOptions.push({
      id: 'core',
      label: 'Story Image',
      url: getCoreImageUrl(story),
      description: 'Main story reference image'
    });
  }

  // Add page images if available
  if (story.pages) {
    story.pages.forEach((page, index) => {
      const pageImageUrl = getPageImageUrl(page);
      if (pageImageUrl) {
        imageOptions.push({
          id: `page_${page.pageNumber}`,
          label: `Page ${page.pageNumber}`,
          url: pageImageUrl,
          description: `"${page.text.slice(0, 50)}..."`
        });
      }
    });
  }

  // Initialize custom input with template's default values
  useEffect(() => {
    if (open) {
      const initialInput = { ...(template.userValues || {}) };
      setCustomInput(initialInput);
    }
  }, [open, template]);

  const handleInputChange = (fieldName: string, value: any) => {
    setCustomInput(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSubmit = () => {
    // Convert image IDs to actual base64 images
    const finalInput = { ...customInput };
    
    // Process each field to convert image selections to base64
    Object.keys(finalInput).forEach(fieldName => {
      const property = template.inputSchema?.properties?.[fieldName];
      if (property?.isImageField) {
        const value = finalInput[fieldName];
        if (Array.isArray(value)) {
          // Handle array image fields - convert each ID to base64
          finalInput[fieldName] = value.filter(id => id !== 'none').map(id => ({ imageId: id }));
        } else if (value && value !== 'none') {
          // Handle single image fields
          finalInput[fieldName] = { imageId: value };
        } else {
          // Remove empty/none values
          delete finalInput[fieldName];
        }
      }
    });

    onSubmit(finalInput);
    onOpenChange(false);
  };

  const renderField = (fieldName: string, property: any) => {
    const value = customInput[fieldName] ?? property.default ?? '';
    const isRequired = property.required || false;
    const isArrayField = template.imageArrayFields?.includes(fieldName) || false;

    // Skip prompt fields - they're handled automatically
    if (property.isPromptField) {
      return (
        <Card key={fieldName} className="opacity-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              <CardTitle className="text-sm">{fieldName}</CardTitle>
              <Badge variant="outline">Automatic</Badge>
            </div>
            <CardDescription className="text-xs">
              This field is automatically generated from your story content.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea 
              value="Generated automatically from story..." 
              disabled 
              className="text-sm"
              rows={2}
            />
          </CardContent>
        </Card>
      );
    }

    // Handle image fields with story image selection
    if (property.isImageField) {
      return (
        <Card key={fieldName}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              <CardTitle className="text-sm">{fieldName}</CardTitle>
              {isRequired && <Badge variant="destructive">Required</Badge>}
              {isArrayField && <Badge variant="secondary">Multiple</Badge>}
            </div>
            {property.description && (
              <CardDescription className="text-xs">
                {property.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <ImageSelection
              fieldName={fieldName}
              property={property}
              value={value}
              onChange={(newValue) => handleInputChange(fieldName, newValue)}
              imageOptions={imageOptions}
              isArrayField={isArrayField}
            />
          </CardContent>
        </Card>
      );
    }

    // Handle other field types (non-image, non-prompt)
    const commonProps = {
      'data-testid': `custom-input-${fieldName}`
    };

    let inputElement;
    if (property.enum && property.enum.length > 0) {
      // Select dropdown for enum values
      inputElement = (
        <Select
          value={String(value)}
          onValueChange={(val) => handleInputChange(fieldName, val)}
          {...commonProps}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${fieldName}`} />
          </SelectTrigger>
          <SelectContent>
            {property.enum.map((option: any) => (
              <SelectItem key={String(option)} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (property.type === 'boolean') {
      // Switch for boolean values
      inputElement = (
        <div className="flex items-center gap-2">
          <Switch
            id={fieldName}
            checked={Boolean(value) || false}
            onCheckedChange={(checked) => handleInputChange(fieldName, checked)}
            {...commonProps}
          />
          <Label htmlFor={fieldName} className="text-sm">
            {fieldName}
          </Label>
        </div>
      );
    } else if (property.type === 'integer' || property.type === 'number') {
      // Number input
      inputElement = (
        <Input
          type="number"
          value={value}
          onChange={(e) => handleInputChange(fieldName, e.target.value ? Number(e.target.value) : '')}
          placeholder={property.default !== undefined ? String(property.default) : ''}
          min={property.minimum}
          max={property.maximum}
          {...commonProps}
        />
      );
    } else {
      // Text input for string and other types
      inputElement = (
        <Input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(fieldName, e.target.value)}
          placeholder={property.default !== undefined ? String(property.default) : ''}
          {...commonProps}
        />
      );
    }

    return (
      <Card key={fieldName}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <CardTitle className="text-sm">{fieldName}</CardTitle>
            {isRequired && <Badge variant="destructive">Required</Badge>}
          </div>
          {property.description && (
            <CardDescription className="text-xs">
              {property.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {inputElement}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            {title}
          </DialogTitle>
          <div className="text-sm text-gray-600">
            Configure model inputs using images and settings from your story
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] px-1">
          <div className="space-y-4">
            {template.inputSchema?.properties && Object.entries(template.inputSchema.properties).map(([fieldName, property]) => 
              renderField(fieldName, property)
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-custom-input"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            data-testid="button-apply-custom-input"
          >
            Apply Custom Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}