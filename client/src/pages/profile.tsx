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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, BookOpen, Settings, Key, Zap, Save, Eye, EyeOff, Search, ArrowLeft, Bot } from "lucide-react";
import { Link } from "wouter";
import { ModelConfigurationPanel } from "@/components/ModelConfigurationPanel";

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
  const [configuringModel, setConfiguringModel] = useState<string | null>(null);
  const [showModelConfiguration, setShowModelConfiguration] = useState(false);

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

  const configureModel = (modelName: string) => {
    setConfiguringModel(modelName);
    setShowModelConfiguration(true);
  };

  const backToProfile = () => {
    setShowModelConfiguration(false);
    setConfiguringModel(null);
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

  // Show model configuration panel if configuring a model
  if (showModelConfiguration && configuringModel) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Navigation Header */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={backToProfile}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <Bot className="text-white" size={16} />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Configure Model</h1>
                  <p className="text-sm text-gray-500 hidden sm:block">{configuringModel}</p>
                </div>
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

        {/* Model Configuration Panel */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Configure Template for {configuringModel}</h2>
              <p className="text-sm text-blue-700">
                This will analyze the model's schema and create a custom template with your preferred settings.
                Once saved, this template will be automatically applied during story generation.
              </p>
            </div>
          </div>
          <ModelConfigurationPanel 
            initialModelId={configuringModel}
            onSaved={backToProfile}
          />
        </main>
      </div>
    );
  }

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

          {/* OpenAI Settings */}
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
                    <div className="flex gap-2">
                      <Input
                        id="preferred-model"
                        value={formData.preferredReplicateModel}
                        onChange={(e) => setFormData(prev => ({...prev, preferredReplicateModel: e.target.value}))}
                        placeholder="e.g., stability-ai/stable-diffusion"
                        className="flex-1"
                      />
                      {formData.preferredReplicateModel && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => configureModel(formData.preferredReplicateModel)}
                          className="shrink-0"
                          data-testid="button-configure-preferred-model"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Leave empty to choose during story creation
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
                                    onClick={() => configureModel(model.id || model.name)}
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
                                <p className="text-sm text-gray-500 truncate">{model.description}</p>
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
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => selectModel(model.id || model.name)}
                                    className="text-xs h-8"
                                  >
                                    Quick Select
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => configureModel(model.id || model.name)}
                                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    <Settings className="h-3 w-3 mr-1" />
                                    Configure
                                  </Button>
                                </div>
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
    </div>
  );
}