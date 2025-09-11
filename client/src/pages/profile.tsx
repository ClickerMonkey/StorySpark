import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, BookOpen, Settings, Key, Zap, Save, Eye, EyeOff, Search, ArrowLeft, Bot, ChevronDown, Edit, Trash2, Plus, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { DynamicModelForm } from "@/components/DynamicModelForm";
import type { ReplicateModelTemplate } from "@shared/schema";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApiKeys, setShowApiKeys] = useState({
    openai: false,
    replicate: false
  });

  const [formData, setFormData] = useState({
    openaiApiKey: user?.openaiApiKey || "",
    openaiBaseUrl: user?.openaiBaseUrl || "https://api.openai.com/v1",
    replicateApiKey: user?.replicateApiKey || "",
    preferredImageProvider: user?.preferredImageProvider || "openai",
    preferredReplicateModel: user?.preferredReplicateModel || "",
  });

  const [modelSearch, setModelSearch] = useState("");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<ReplicateModelTemplate | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Query for user's saved templates
  const { data: userTemplates = [], isLoading: templatesLoading } = useQuery<ReplicateModelTemplate[]>({
    queryKey: ['/api/replicate/templates'],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Query for searching Replicate models
  const { data: replicateModels, isLoading: modelsLoading, refetch: searchModels } = useQuery({
    queryKey: ["/api/replicate/models", modelSearch],
    queryFn: async () => {
      if (!modelSearch.trim()) return null;
      const params = new URLSearchParams();
      params.append('q', modelSearch.trim());
      const response = await apiRequest("GET", `/api/replicate/models?${params.toString()}`);
      return response.json();
    },
    enabled: false, // Only run when explicitly triggered
  });

  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        openaiApiKey: user.openaiApiKey || "",
        openaiBaseUrl: user.openaiBaseUrl || "https://api.openai.com/v1",
        replicateApiKey: user.replicateApiKey || "",
        preferredImageProvider: user.preferredImageProvider || "openai",
        preferredReplicateModel: user.preferredReplicateModel || "",
      });
    }
  }, [user]);

  const handleModelSearch = () => {
    if (formData.replicateApiKey && modelSearch.trim()) {
      searchModels();
    } else if (!formData.replicateApiKey) {
      toast({
        title: "Replicate API Key Required",
        description: "Please enter your Replicate API key first to search models.",
        variant: "destructive",
      });
    }
  };

  const selectModel = (modelName: string) => {
    setFormData(prev => ({...prev, preferredReplicateModel: modelName}));
    setModelSearch("");
  };

  const configureNewModel = (modelId: string) => {
    setIsAnalyzing(true);
    setIsConfigModalOpen(true);
    setCurrentTemplate(null);
    analyzeModelMutation.mutate(modelId);
  };

  const editExistingTemplate = (template: ReplicateModelTemplate) => {
    setCurrentTemplate(template);
    setIsConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setIsConfigModalOpen(false);
    setCurrentTemplate(null);
    setIsAnalyzing(false);
  };

  const handleSaveTemplate = () => {
    if (currentTemplate) {
      saveTemplateMutation.mutate(currentTemplate);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile Updated!",
        description: "Your API settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Analyze model mutation
  const analyzeModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await apiRequest('POST', `/api/replicate/analyze-model`, { modelId });
      return response.json();
    },
    onSuccess: (data: any) => {
      setCurrentTemplate(data.template);
      setIsAnalyzing(false);
      toast({
        title: "Model Analyzed Successfully", 
        description: `Found ${Object.keys(data.template.inputSchema.properties || {}).length} input properties`,
      });
    },
    onError: (error) => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Could not analyze the model schema",
        variant: "destructive",
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: ReplicateModelTemplate) => {
      const response = await apiRequest('POST', `/api/replicate/save-template`, { template });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicate/templates'] });
      toast({
        title: "Template Saved!",
        description: "Your model configuration has been saved successfully.",
      });
      setIsConfigModalOpen(false);
      setCurrentTemplate(null);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await apiRequest('POST', `/api/replicate/save-template`, { 
        template: { modelId }, 
        action: 'delete' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/replicate/templates'] });
      toast({
        title: "Template Deleted",
        description: "The model template has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const toggleApiKeyVisibility = (provider: 'openai' | 'replicate') => {
    setShowApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                <BookOpen className="text-white" size={16} />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">StoryMaker AI</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/library">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900 px-2 sm:px-4" data-testid="link-library">
                  <BookOpen className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">My Stories</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Profile Settings
          </h1>
          <p className="text-gray-600 mt-2">Manage your API keys and preferences for story generation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input value={user?.name || ""} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="bg-gray-50" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Free Mode Notice */}
          {user?.freeMode && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  Free Mode Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-green-700">
                  You're using StoryMaker AI in free mode! All AI generation is powered by our system API keys, so you don't need to configure your own. 
                  You can still customize your preferred image provider and model settings below.
                </p>
              </CardContent>
            </Card>
          )}

          {/* OpenAI Settings - Hidden in Free Mode */}
          {!user?.freeMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  OpenAI Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                  <div className="relative">
                    <Input
                      id="openai-api-key"
                      type={showApiKeys.openai ? "text" : "password"}
                      value={formData.openaiApiKey}
                      onChange={(e) => setFormData(prev => ({...prev, openaiApiKey: e.target.value}))}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleApiKeyVisibility('openai')}
                    >
                      {showApiKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="openai-base-url">OpenAI Base URL</Label>
                  <Input
                    id="openai-base-url"
                    value={formData.openaiBaseUrl}
                    onChange={(e) => setFormData(prev => ({...prev, openaiBaseUrl: e.target.value}))}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Replicate Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Replicate Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="replicate-api-key">Replicate API Key</Label>
                <div className="relative">
                  <Input
                    id="replicate-api-key"
                    type={showApiKeys.replicate ? "text" : "password"}
                    value={formData.replicateApiKey}
                    onChange={(e) => setFormData(prev => ({...prev, replicateApiKey: e.target.value}))}
                    placeholder="r8_..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleApiKeyVisibility('replicate')}
                  >
                    {showApiKeys.replicate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Optional: Get your API key from <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Replicate</a>
                </p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="preferred-provider">Preferred Image Provider</Label>
                <Select
                  value={formData.preferredImageProvider}
                  onValueChange={(value) => setFormData(prev => ({...prev, preferredImageProvider: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI DALL-E</SelectItem>
                    <SelectItem value="replicate">Replicate Models</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.preferredImageProvider === "replicate" && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="preferred-model">Preferred Replicate Model</Label>
                    <Select
                      value={formData.preferredReplicateModel}
                      onValueChange={(value) => setFormData(prev => ({...prev, preferredReplicateModel: value}))}
                      disabled={userTemplates.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          userTemplates.length === 0 
                            ? "No templates configured - search and configure a model first"
                            : "Select a configured model template"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {userTemplates.map((template) => (
                          <SelectItem key={template.modelId} value={template.modelId}>
                            <div className="flex flex-col">
                              <span>{template.modelName || template.modelId}</span>
                              <span className="text-xs text-gray-500">{template.modelId}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500 mt-1">
                      {userTemplates.length === 0 
                        ? "Search for a model below and configure it to add to this dropdown"
                        : "Select from your configured model templates"
                      }
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="model-search">Search Models</Label>
                    <div className="flex gap-2">
                      <Input
                        id="model-search"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search for image generation models..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleModelSearch();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleModelSearch}
                        disabled={modelsLoading || !formData.replicateApiKey || !modelSearch.trim()}
                        data-testid="button-search-models"
                      >
                        {modelsLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {replicateModels?.models && replicateModels.models.length > 0 && (
                    <div>
                      <Label>Search Results</Label>
                      <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                        {replicateModels.models.map((model: any) => (
                          <div
                            key={model.name}
                            className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                            data-testid={`model-option-${model.name}`}
                          >
                            {/* Mobile Layout */}
                            <div className="block sm:hidden space-y-3">
                              <div>
                                <p className="font-medium text-sm">{model.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{model.description}</p>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1 flex-wrap">
                                  {model.supportsImageInput && (
                                    <Badge variant="secondary" className="text-xs">
                                      Image Input
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {model.latestVersion?.created_at ? 
                                      new Date(model.latestVersion.created_at).getFullYear() : 
                                      'Latest'
                                    }
                                  </Badge>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => selectModel(model.id || model.name)}
                                    className="text-xs h-7 px-2"
                                  >
                                    Select
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => configureNewModel(model.id || model.name)}
                                    className="text-xs h-7 px-2 bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    <Settings className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Desktop Layout */}
                            <div className="hidden sm:flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{model.name}</p>
                                <p className="text-sm text-gray-500 break-words">{model.description}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <div className="flex gap-1 flex-wrap">
                                  {model.supportsImageInput && (
                                    <Badge variant="secondary" className="text-xs">
                                      Image Input
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {model.latestVersion?.created_at ? 
                                      new Date(model.latestVersion.created_at).getFullYear() : 
                                      'Latest'
                                    }
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => configureNewModel(model.id || model.name)}
                                  className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                                >
                                  <Settings className="h-3 w-3 mr-1" />
                                  Configure
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {replicateModels?.models && replicateModels.models.length === 0 && (
                    <p className="text-sm text-gray-500">No models found. Try a different search term.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Template Management */}
          {formData.preferredImageProvider === "replicate" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configured Model Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-2"></div>
                    Loading templates...
                  </div>
                ) : userTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <h4 className="font-medium mb-1">No Model Templates Yet</h4>
                    <p className="text-sm">Search for a model below and configure it to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userTemplates.map((template) => (
                      <Collapsible key={template.modelId}>
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{template.modelName || template.modelId}</h4>
                                <Badge variant="outline" className="text-xs">{template.modelId}</Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {Object.keys(template.userValues || {}).length} settings
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                Last analyzed: {new Date(template.lastAnalyzed).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editExistingTemplate(template)}
                                data-testid={`button-edit-template-${template.modelId.replace('/', '-')}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTemplateMutation.mutate(template.modelId)}
                                disabled={deleteTemplateMutation.isPending}
                                data-testid={`button-delete-template-${template.modelId.replace('/', '-')}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <CollapsibleContent className="mt-4">
                            {Object.keys(template.userValues || {}).length > 0 ? (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h5 className="text-sm font-medium mb-2">Configured Settings:</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {Object.entries(template.userValues || {}).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="font-medium">{key}:</span>
                                      <span className="text-gray-600 break-all ml-2">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 italic">No custom settings configured</p>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </main>

      {/* Model Configuration Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={closeConfigModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {currentTemplate ? `Configure: ${currentTemplate.modelName || currentTemplate.modelId}` : 'Analyzing Model...'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {isAnalyzing || analyzeModelMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Analyzing model schema...</span>
              </div>
            ) : currentTemplate ? (
              <>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-blue-900 mb-1">Model Configuration</h3>
                  <p className="text-sm text-blue-700">
                    Customize the model parameters below. Changes are saved automatically to your template.
                  </p>
                </div>
                
                <DynamicModelForm
                  template={currentTemplate}
                  onTemplateUpdate={setCurrentTemplate}
                />
                
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    onClick={handleSaveTemplate}
                    disabled={saveTemplateMutation.isPending}
                    data-testid="button-save-template-modal"
                  >
                    {saveTemplateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={closeConfigModal}
                    data-testid="button-cancel-config-modal"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Failed to load model configuration</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}