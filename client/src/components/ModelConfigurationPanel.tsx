import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReplicateModelTemplate } from '@shared/schema';
import { DynamicModelForm } from './DynamicModelForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  Plus, 
  Settings, 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ModelConfigurationPanelProps {
  className?: string;
  initialModelId?: string; // Model to analyze on load
  onSaved?: () => void; // Callback when template is saved
}

/**
 * Complete model configuration panel for managing Replicate model templates.
 * 
 * Features:
 * - Browse and search popular Replicate models
 * - Analyze any model's input schema automatically
 * - Configure models with intelligent dynamic forms
 * - Save and manage user templates
 * - Test configurations before saving
 */
export function ModelConfigurationPanel({ 
  className = '',
  initialModelId,
  onSaved
}: ModelConfigurationPanelProps) {
  const [selectedModelId, setSelectedModelId] = useState(initialModelId || '');
  const [customModelId, setCustomModelId] = useState(initialModelId || '');
  const [currentTemplate, setCurrentTemplate] = useState<ReplicateModelTemplate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-analyze the initial model if provided
  useEffect(() => {
    if (initialModelId && !currentTemplate) {
      analyzeModelMutation.mutate(initialModelId);
    }
  }, [initialModelId]);

  // Popular Replicate models for quick selection
  const popularModels = [
    { id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', description: 'Fast, high-quality image generation' },
    { id: 'stability-ai/sdxl', name: 'Stable Diffusion XL', description: 'Popular diffusion model' },
    { id: 'stability-ai/stable-diffusion', name: 'Stable Diffusion v1.5', description: 'Classic stable diffusion' },
    { id: 'lucataco/animate-diff', name: 'AnimateDiff', description: 'Turn images into videos' },
    { id: 'tencentarc/photomaker', name: 'PhotoMaker', description: 'Generate photos of people' },
  ];

  // Fetch user's existing templates
  const { data: userTemplates = [], isLoading: templatesLoading } = useQuery<ReplicateModelTemplate[]>({
    queryKey: ['/api/replicate/templates'],
    select: (data) => Array.isArray(data) ? data : [], // Ensure it's always an array
  });

  // Analyze model schema
  const analyzeModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await apiRequest('POST', `/api/replicate/analyze-model`, { modelId });
      return response.json();
    },
    onSuccess: (data: any) => {
      setCurrentTemplate(data.template);
      toast({
        title: "Model Analyzed Successfully", 
        description: `Found ${Object.keys(data.template.inputSchema.properties || {}).length} input properties`,
      });
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze the model schema",
        variant: "destructive",
      });
    },
  });

  // Save template
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: ReplicateModelTemplate) => {
      const response = await apiRequest('POST', `/api/replicate/save-template`, { template });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicate/templates'] });
      toast({
        title: "Template Saved",
        description: "Model configuration saved successfully",
      });
      onSaved?.(); // Call the callback if provided
    },
    onError: (error) => {
      toast({
        title: "Save Failed", 
        description: error.message || "Could not save template",
        variant: "destructive",
      });
    },
  });

  // Delete template
  const deleteTemplateMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const template = { modelId, delete: true };
      const response = await apiRequest('POST', `/api/replicate/save-template`, { template });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicate/templates'] });
      toast({
        title: "Template Deleted",
        description: "Model configuration removed successfully",
      });
    },
  });

  const handleAnalyzeModel = () => {
    const modelId = selectedModelId || customModelId;
    if (!modelId.trim()) {
      toast({
        title: "Model ID Required",
        description: "Please select or enter a model ID to analyze",
        variant: "destructive",
      });
      return;
    }
    analyzeModelMutation.mutate(modelId.trim());
  };

  const handleSaveTemplate = () => {
    if (!currentTemplate) return;
    saveTemplateMutation.mutate(currentTemplate);
  };

  const handleDeleteTemplate = (modelId: string) => {
    deleteTemplateMutation.mutate(modelId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Model Configuration
        </h2>
        <p className="text-muted-foreground">
          Configure Replicate models for intelligent image generation. The system will analyze model schemas
          and create smart forms that adapt to any model's requirements.
        </p>
      </div>

      <Tabs defaultValue="configure" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configure" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Configure New Model
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Manage Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Select Model
              </CardTitle>
              <CardDescription>
                Choose a popular model or enter any Replicate model ID (format: username/model-name)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Popular Models */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Popular Models</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {popularModels.map((model) => (
                    <div
                      key={model.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedModelId === model.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setCustomModelId('');
                      }}
                      data-testid={`model-option-${model.id.replace('/', '-')}`}
                    >
                      <div className="font-medium text-sm">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.description}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{model.id}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-sm text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

              {/* Custom Model ID */}
              <div className="space-y-2">
                <Label htmlFor="custom-model">Custom Model ID</Label>
                <Input
                  id="custom-model"
                  placeholder="e.g., username/model-name"
                  value={customModelId}
                  onChange={(e) => {
                    setCustomModelId(e.target.value);
                    setSelectedModelId('');
                  }}
                  data-testid="input-custom-model"
                />
                <p className="text-xs text-muted-foreground">
                  Find models at{' '}
                  <a 
                    href="https://replicate.com/explore" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    replicate.com/explore <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <Button 
                onClick={handleAnalyzeModel}
                disabled={analyzeModelMutation.isPending}
                className="w-full"
                data-testid="button-analyze-model"
              >
                {analyzeModelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Model...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 mr-2" />
                    Analyze Model Schema
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Model Configuration Form */}
          {currentTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configure: {currentTemplate.modelName || currentTemplate.modelId}
                </CardTitle>
                <CardDescription>
                  Customize the model parameters. Changes are saved automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DynamicModelForm
                  template={currentTemplate}
                  onTemplateUpdate={setCurrentTemplate}
                />
                
                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <Button 
                    onClick={handleSaveTemplate}
                    disabled={saveTemplateMutation.isPending}
                    data-testid="button-save-template"
                  >
                    {saveTemplateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => setCurrentTemplate(null)}
                    data-testid="button-cancel-config"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Saved Templates
              </CardTitle>
              <CardDescription>
                Manage your configured model templates. These are used automatically during image generation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : userTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <h4 className="font-medium mb-1">No Templates Yet</h4>
                  <p className="text-sm">Configure your first model to get started.</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {userTemplates.map((template) => (
                      <Card key={template.modelId} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-base">
                                {template.modelName || template.modelId}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {template.modelId}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {Object.keys(template.userValues || {}).length} settings
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTemplate(template.modelId)}
                              disabled={deleteTemplateMutation.isPending}
                              data-testid={`button-delete-${template.modelId.replace('/', '-')}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        
                        {Object.keys(template.userValues || {}).length > 0 && (
                          <CardContent className="pt-0">
                            <div className="text-sm text-muted-foreground">
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(template.userValues || {}).slice(0, 4).map(([key, value]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="truncate">{key}:</span>
                                    <span className="font-mono text-xs ml-2 truncate">
                                      {String(value).slice(0, 10)}
                                      {String(value).length > 10 ? '...' : ''}
                                    </span>
                                  </div>
                                ))}
                                {Object.keys(template.userValues || {}).length > 4 && (
                                  <div className="text-xs text-muted-foreground col-span-2">
                                    +{Object.keys(template.userValues || {}).length - 4} more settings
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Once you save a model configuration, it will be automatically used 
          whenever you generate images with that model. The system intelligently maps your story prompts to the 
          model's input fields and applies your custom settings.
        </AlertDescription>
      </Alert>
    </div>
  );
}