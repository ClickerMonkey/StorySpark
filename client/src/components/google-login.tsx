import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface GoogleLoginProps {
  onLogin: (user: any, token: string) => void;
}

export function GoogleLogin({ onLogin }: GoogleLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Fetch Google Client ID from backend
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setGoogleClientId(data.googleClientId);
      })
      .catch(error => {
        console.error('Failed to fetch config:', error);
        // Fallback to environment variable
        setGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
      });
  }, []);

  const handleGoogleLogin = () => {
    if (!googleClientId) {
      toast({
        title: "Configuration Error",
        description: "Google Client ID not available. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Create Google OAuth URL for browser redirect
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'email profile openid';
    
    const googleOAuthUrl = `https://accounts.google.com/oauth/v2/auth?` +
      `client_id=${encodeURIComponent(googleClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=select_account`;
    
    // Redirect to Google OAuth
    window.location.href = googleOAuthUrl;
  };

  const handleTestLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testCredential: btoa(JSON.stringify({
            sub: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://via.placeholder.com/150'
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Test login failed');
      }

      const data = await response.json();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Welcome to StoryMaker AI</CardTitle>
          <p className="text-gray-600 mt-2">Sign in to create amazing children's stories with AI</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading || !googleClientId}
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

          {/* Development fallback button */}
          {import.meta.env.MODE === 'development' && (
            <Button
              onClick={handleTestLogin}
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
            {import.meta.env.MODE === 'development' && (
              <p className="mt-2 text-xs text-blue-600">Development mode: Use test account if Google sign-in has issues</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}