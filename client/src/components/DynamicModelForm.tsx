import { useState, useEffect } from 'react';
import type { ReplicateModelTemplate, ReplicateModelInputProperty } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Zap, Image, Type, Settings2 } from 'lucide-react';

interface DynamicModelFormProps {
  template: ReplicateModelTemplate;
  onTemplateUpdate: (template: ReplicateModelTemplate) => void;
  className?: string;
}

interface FieldGroupProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function FieldGroup({ title, description, icon, children, badge, badgeVariant = 'secondary' }: FieldGroupProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
          {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Dynamic form generator that creates intelligent forms based on Replicate model schemas.
 * 
 * Features:
 * - Automatically identifies prompt, image, and configuration fields
 * - Groups fields by type for better UX
 * - Provides appropriate input controls (text, number, select, etc.)
 * - Shows field descriptions and requirements
 * - Saves user configurations to template
 * 
 * @param template - The analyzed model template with schema and field classifications
 * @param onTemplateUpdate - Callback when user updates field values
 * @param className - Optional CSS classes
 */
export function DynamicModelForm({ template, onTemplateUpdate, className = '' }: DynamicModelFormProps) {
  const [values, setValues] = useState(template.userValues || {});
  const [hasChanges, setHasChanges] = useState(false);

  // Update values when template changes
  useEffect(() => {
    setValues(template.userValues || {});
    setHasChanges(false);
  }, [template]);

  const handleValueChange = (fieldName: string, value: any) => {
    const newValues = { ...values, [fieldName]: value };
    setValues(newValues);
    setHasChanges(true);
    
    // Auto-save changes to template
    onTemplateUpdate({
      ...template,
      userValues: newValues
    });
  };

  const renderField = (fieldName: string, property: ReplicateModelInputProperty) => {
    const value = values[fieldName] ?? property.default ?? '';
    const isRequired = property.required || false;

    // Skip prompt and image fields - they're handled automatically
    if (property.isPromptField || property.isImageField) {
      return null;
    }

    const commonProps = {
      'data-testid': `input-${fieldName}`
    };

    // Render appropriate input based on type and constraints
    if (property.enum && property.enum.length > 0) {
      // Select dropdown for enum values
      return (
        <div key={fieldName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={fieldName} className="text-sm font-medium">
              {fieldName}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          <Select
            value={String(value)}
            onValueChange={(val) => handleValueChange(fieldName, val)}
            {...commonProps}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${fieldName}`} />
            </SelectTrigger>
            <SelectContent>
              {property.enum.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    } else if (property.type === 'boolean') {
      // Switch for boolean values
      return (
        <div key={fieldName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id={fieldName}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleValueChange(fieldName, checked)}
              {...commonProps}
            />
            <Label htmlFor={fieldName} className="text-sm font-medium">
              {fieldName}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
          {property.description && (
            <p className="text-xs text-muted-foreground ml-8">{property.description}</p>
          )}
        </div>
      );
    } else if (property.type === 'number' || property.type === 'integer') {
      // Number input with min/max support
      return (
        <div key={fieldName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={fieldName} className="text-sm font-medium">
              {fieldName}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          <Input
            id={fieldName}
            type="number"
            value={value}
            onChange={(e) => handleValueChange(fieldName, Number(e.target.value) || 0)}
            min={property.minimum}
            max={property.maximum}
            placeholder={`Enter ${fieldName}`}
            {...commonProps}
          />
          {(property.minimum !== undefined || property.maximum !== undefined) && (
            <p className="text-xs text-muted-foreground">
              Range: {property.minimum ?? 'no min'} - {property.maximum ?? 'no max'}
            </p>
          )}
        </div>
      );
    } else {
      // Text input for strings and other types
      const isLongText = property.description && property.description.length > 100;
      
      return (
        <div key={fieldName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={fieldName} className="text-sm font-medium">
              {fieldName}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
          {property.description && (
            <p className="text-xs text-muted-foreground">{property.description}</p>
          )}
          {isLongText ? (
            <Textarea
              id={fieldName}
              value={String(value)}
              onChange={(e) => handleValueChange(fieldName, e.target.value)}
              placeholder={`Enter ${fieldName}`}
              {...commonProps}
            />
          ) : (
            <Input
              id={fieldName}
              value={String(value)}
              onChange={(e) => handleValueChange(fieldName, e.target.value)}
              placeholder={`Enter ${fieldName}`}
              {...commonProps}
            />
          )}
        </div>
      );
    }
  };

  // Separate fields into categories
  const properties = template.inputSchema.properties || {};
  const promptFields = Object.entries(properties).filter(([_, prop]) => prop.isPromptField);
  const imageFields = Object.entries(properties).filter(([_, prop]) => prop.isImageField);
  const configFields = Object.entries(properties).filter(([_, prop]) => 
    !prop.isPromptField && !prop.isImageField
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Model Info Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{template.modelName || template.modelId}</h3>
        <p className="text-sm text-muted-foreground">
          Configure parameters for this model. Prompt and image inputs are handled automatically.
        </p>
      </div>

      {/* Prompt Fields - Read Only Info */}
      {promptFields.length > 0 && (
        <FieldGroup
          title="Prompt Handling"
          description="These fields receive story prompts automatically"
          icon={<Type className="w-4 h-4 text-blue-500" />}
          badge="Auto-managed"
        >
          <div className="space-y-2">
            {promptFields.map(([fieldName, property]) => (
              <div key={fieldName} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div>
                  <span className="font-medium text-sm">{fieldName}</span>
                  {property.description && (
                    <p className="text-xs text-muted-foreground">{property.description}</p>
                  )}
                </div>
                <Badge variant="outline">Text Prompt</Badge>
              </div>
            ))}
          </div>
        </FieldGroup>
      )}

      {/* Image Fields - Read Only Info */}
      {imageFields.length > 0 && (
        <FieldGroup
          title="Image Handling"
          description="These fields receive reference images automatically"
          icon={<Image className="w-4 h-4 text-green-500" />}
          badge="Auto-managed"
        >
          <div className="space-y-2">
            {imageFields.map(([fieldName, property]) => (
              <div key={fieldName} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div>
                  <span className="font-medium text-sm">{fieldName}</span>
                  {property.description && (
                    <p className="text-xs text-muted-foreground">{property.description}</p>
                  )}
                </div>
                <Badge variant="outline">Image URL</Badge>
              </div>
            ))}
          </div>
        </FieldGroup>
      )}

      {/* Configuration Fields - User Editable */}
      {configFields.length > 0 && (
        <FieldGroup
          title="Model Configuration"
          description="Customize these parameters to control model behavior"
          icon={<Settings2 className="w-4 h-4 text-orange-500" />}
          badge={`${configFields.length} settings`}
        >
          <div className="space-y-4">
            {configFields.map(([fieldName, property]) => renderField(fieldName, property))}
          </div>
        </FieldGroup>
      )}

      {/* No Configuration Available */}
      {configFields.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h4 className="font-medium mb-1">No Additional Configuration</h4>
          <p className="text-sm">This model only uses prompt and image inputs.</p>
        </div>
      )}

      {/* Status */}
      {hasChanges && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="w-4 h-4" />
          Configuration automatically saved
        </div>
      )}
    </div>
  );
}