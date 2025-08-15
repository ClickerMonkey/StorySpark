import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthCallbackProps {
  onLogin: (user: any, token: string) => void;
}

export function AuthCallback({ onLogin }: AuthCallbackProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const processAuthCallback = async () => {
      try {
        // Get the authorization code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Google OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Google');
        }

        // Exchange the authorization code for tokens
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Authentication failed');
        }

        const data = await response.json();
        
        // Store the token and user data
        localStorage.setItem('auth_token', data.token);
        onLogin(data.user, data.token);
        
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google.",
        });

        // Redirect to home page
        setLocation('/');
        
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        toast({
          title: "Authentication Failed",
          description: error.message || "Something went wrong during sign-in. Please try again.",
          variant: "destructive",
        });
        
        // Redirect back to login after a delay
        setTimeout(() => {
          setLocation('/');
        }, 3000);
      }
    };

    processAuthCallback();
  }, [onLogin, setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          {status === 'loading' ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Signing you in...</h2>
              <p className="text-gray-600">Please wait while we complete your authentication.</p>
            </>
          ) : (
            <>
              <div className="mx-auto h-8 w-8 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Authentication Failed</h2>
              <p className="text-gray-600">Redirecting back to login...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}