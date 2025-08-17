import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { GoogleLogin } from "@/components/google-login";
import { AuthCallback } from "@/pages/auth-callback";
import { OpenAISetup } from "@/components/openai-setup";
import Home from "@/pages/home";
import StoryLibrary from "@/pages/story-library";
import StoryView from "@/pages/story-view";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user, login, updateUser } = useAuth();

  // Handle auth callback route first, before authentication checks
  return (
    <Switch>
      <Route path="/auth/google/callback">
        <AuthCallback onLogin={login} />
      </Route>
      <Route>
        {/* All other routes require authentication */}
        {isLoading ? (
          <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
          </div>
        ) : !isAuthenticated ? (
          <GoogleLogin onLogin={login} />
        ) : !user?.openaiApiKey ? (
          <OpenAISetup user={user} onSetupComplete={updateUser} />
        ) : (
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/library" component={StoryLibrary} />
            <Route path="/story/:id" component={StoryView} />
            <Route component={NotFound} />
          </Switch>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
