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
        });
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

  const handleGoogleLogin = () => {
    try {
      if (window.google && window.google.accounts) {
        // First try to render the button if container exists and is empty
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer && !buttonContainer.hasChildNodes()) {
          try {
            window.google.accounts.id.renderButton(buttonContainer, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'continue_with'
            });
          } catch (renderError) {
            console.warn('Failed to render Google button:', renderError);
          }
        }
        // Always try to prompt for sign-in
        window.google.accounts.id.prompt();
      } else {
        // Dev mode fallback - create a test user
        if (process.env.NODE_ENV === 'development') {
          handleTestLogin();
        } else {
          toast({
            title: "Google Sign-In Not Ready",
            description: "Google authentication is still loading. Please wait a moment and try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
      if (process.env.NODE_ENV === 'development') {
        handleTestLogin();
      } else {
        toast({
          title: "Authentication Error",
          description: "Can't continue with Google, something went wrong. Please try again.",
          variant: "destructive",
        });
      }
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
          {/* Google Sign-In Button Container - Try to render Google's button first */}
          <div id="google-signin-button" className="w-full min-h-[40px]"></div>
          
          {/* Always show fallback button */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            data-testid="button-google-login"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="text-center text-sm text-gray-500">
            <p>By signing in, you agree to use your own OpenAI API key</p>
            <p>for generating stories and images.</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="mt-2 text-xs text-blue-600">Development mode: Click button for test login if Google OAuth fails</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}