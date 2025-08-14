import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleLoginProps {
  onLogin: (user: any, token: string) => void;
}

export function GoogleLogin({ onLogin }: GoogleLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleAuth;
    script.onerror = () => {
      console.error('Failed to load Google Identity Services');
      toast({
        title: "Google Services Unavailable",
        description: "Unable to load Google Sign-In. Please check your internet connection and try again.",
        variant: "destructive",
      });
    };
    document.head.appendChild(script);

    return () => {
      try {
        document.head.removeChild(script);
      } catch (e) {
        // Script might already be removed
      }
    };
  }, [toast]);

  const initializeGoogleAuth = () => {
    if (window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "your_google_client_id_here",
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false,
        });
        
        // Render the button immediately
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
          window.google.accounts.id.renderButton(buttonContainer, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          });
        }
      } catch (error) {
        console.error('Google Auth initialization error:', error);
        toast({
          title: "Google Sign-In Setup Issue",
          description: "Please check your Google OAuth configuration.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    try {
      const result = await apiRequest('POST', '/api/auth/google', {
        token: response.credential,
      });
      
      const data = await result.json();
      localStorage.setItem('auth_token', data.token);
      onLogin(data.user, data.token);
      
      toast({
        title: "Welcome!",
        description: "Successfully signed in with Google.",
      });
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error?.message || "Can't continue with Google, something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFallbackLogin = () => {
    if (process.env.NODE_ENV === 'development') {
      handleTestLogin();
    } else {
      toast({
        title: "Google Sign-In Issue",
        description: "Having trouble with Google authentication. Please try refreshing the page.",
        variant: "destructive",
      });
    }
  };

  const handleTestLogin = async () => {
    setIsLoading(true);
    try {
      // Create a test credential for development
      const testCredential = btoa(JSON.stringify({
        sub: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://via.placeholder.com/150'
      }));

      const result = await apiRequest('POST', '/api/auth/test-login', {
        testCredential,
      });
      
      const data = await result.json();
      localStorage.setItem('auth_token', data.token);
      onLogin(data.user, data.token);
      
      toast({
        title: "Welcome!",
        description: "Successfully signed in with test account.",
      });
    } catch (error: any) {
      console.error('Test login error:', error);
      toast({
        title: "Test Login Failed",
        description: "Unable to create test account. Please check the console for details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Welcome to StoryMaker AI</CardTitle>
          <p className="text-gray-600 mt-2">Sign in to create amazing children's stories with AI</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Sign-In Button Container */}
          <div id="google-signin-button" className="w-full min-h-[44px] flex items-center justify-center"></div>
          
          {/* Development fallback button */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={handleFallbackLogin}
              disabled={isLoading}
              className="w-full bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200"
              data-testid="button-test-login"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Use Test Account (Development)"
              )}
            </Button>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>By signing in, you agree to use your own OpenAI API key</p>
            <p>for generating stories and images.</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="mt-2 text-xs text-blue-600">Development mode: Use test account if Google sign-in has issues</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}