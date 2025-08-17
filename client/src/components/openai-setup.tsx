import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Key, Globe } from "lucide-react";

interface OpenAISetupProps {
  user: any;
  onSetupComplete: (user: any) => void;
}

export function OpenAISetup({ user, onSetupComplete }: OpenAISetupProps) {
  const [apiKey, setApiKey] = useState(user?.openaiApiKey || "");
  const [baseUrl, setBaseUrl] = useState(user?.openaiBaseUrl || "https://api.openai.com/v1");
  const { toast } = useToast();

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/setup-openai", {
        openaiApiKey: apiKey,
        openaiBaseUrl: baseUrl,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "OpenAI API Configured!",
        description: "You can now start creating amazing stories with AI.",
      });
      onSetupComplete(data.user);
    },
    onError: (error) => {
      toast({
        title: "Configuration Failed",
        description: error instanceof Error ? error.message : "Failed to save OpenAI settings",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key to continue.",
        variant: "destructive",
      });
      return;
    }
    setupMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Configure OpenAI API</CardTitle>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Enter your OpenAI API key to start creating stories with AI
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="apiKey">OpenAI API Key *</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pl-10"
                  data-testid="input-api-key"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Get your API key from{" "}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  OpenAI Platform
                </a>
              </p>
            </div>

            <div>
              <Label htmlFor="baseUrl">Base URL (Optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="baseUrl"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="pl-10"
                  data-testid="input-base-url"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Use custom OpenAI-compatible endpoints (Azure OpenAI, etc.)
              </p>
            </div>

            <Button
              type="submit"
              disabled={setupMutation.isPending || !apiKey.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-config"
            >
              {setupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Privacy Note:</strong> Your API key is securely stored and only used for your story generation requests. 
              We never share or use your API key for any other purpose.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}