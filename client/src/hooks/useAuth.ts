import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  replicateApiKey?: string;
  preferredImageProvider?: string;
  preferredReplicateModel?: string;
  replicateModelTemplates?: any[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    isAuthenticated: false,
    isLoading: true,
  });

  // Query to get current user if token exists
  const { data: userData, isLoading: isUserLoading, error } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/user');
      return response.json();
    },
    enabled: !!authState.token,
    retry: false,
  });

  // Update auth state when user data changes
  useEffect(() => {
    if (userData?.user) {
      setAuthState(prev => ({
        ...prev,
        user: userData.user,
        isAuthenticated: true,
        isLoading: false,
      }));
    } else if (error || !authState.token) {
      setAuthState(prev => ({
        ...prev,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      }));
    } else {
      setAuthState(prev => ({
        ...prev,
        isLoading: isUserLoading,
      }));
    }
  }, [userData, error, authState.token, isUserLoading]);

  const login = (user: User, token: string) => {
    localStorage.setItem('auth_token', token);
    setAuthState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateUser = (user: User) => {
    setAuthState(prev => ({
      ...prev,
      user,
    }));
  };

  return {
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login,
    logout,
    updateUser,
  };
}