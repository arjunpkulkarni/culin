'use client';

/**
 * useOidcAuth Hook
 * 
 * Custom hook for accessing OIDC authentication state and tokens
 */

import { useAuth } from 'react-oidc-context';

export function useOidcAuth() {
  const auth = useAuth();

  /**
   * Make an authenticated API request with the ID token
   */
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!auth.user?.id_token) {
      throw new Error('No authentication token available');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${auth.user.id_token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  return {
    // Authentication state
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    
    // User information
    user: auth.user ? {
      email: auth.user.profile.email,
      sub: auth.user.profile.sub,
      profile: auth.user.profile,
    } : null,
    
    // Tokens
    idToken: auth.user?.id_token,
    accessToken: auth.user?.access_token,
    refreshToken: auth.user?.refresh_token,
    
    // Authentication actions
    signIn: () => auth.signinRedirect(),
    signOut: () => auth.removeUser(),
    
    // Helper function
    makeAuthenticatedRequest,
  };
}
