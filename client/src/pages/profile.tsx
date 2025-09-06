import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, BookOpen, Settings, Key, Zap, Save, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";

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
                <div>
                  <Label htmlFor="preferred-model">Preferred Replicate Model</Label>
                  <Input
                    id="preferred-model"
                    value={formData.preferredReplicateModel}
                    onChange={(e) => setFormData(prev => ({...prev, preferredReplicateModel: e.target.value}))}
                    placeholder="e.g., stability-ai/stable-diffusion"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Leave empty to choose during story creation
                  </p>
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