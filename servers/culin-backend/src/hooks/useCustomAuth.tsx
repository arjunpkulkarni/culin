'use client';

/**
 * Custom Auth Hook using Cognito Identity JS
 * 
 * Direct authentication with Cognito without Hosted UI
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserSession
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
};

const userPool = new CognitoUserPool(poolData);

interface CustomAuthUser {
  username: string;
  email?: string;
  attributes?: any;
}

interface CustomAuthContextType {
  user: CustomAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  idToken: string | null;
  accessToken: string | null;
  signOut: () => void;
  refreshSession: () => Promise<void>;
}

const CustomAuthContext = createContext<CustomAuthContextType | undefined>(undefined);

export function CustomAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const updateSession = (session: CognitoUserSession) => {
    setIdToken(session.getIdToken().getJwtToken());
    setAccessToken(session.getAccessToken().getJwtToken());
  };

  const refreshSession = async () => {
    const cognitoUser = userPool.getCurrentUser();
    
    if (!cognitoUser) {
      setUser(null);
      setIdToken(null);
      setAccessToken(null);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session) {
          setUser(null);
          setIdToken(null);
          setAccessToken(null);
          reject(err);
          return;
        }

        if (session.isValid()) {
          updateSession(session);
          
          cognitoUser.getUserAttributes((err, attributes) => {
            if (!err && attributes) {
              const email = attributes.find(attr => attr.Name === 'email')?.Value;
              setUser({
                username: cognitoUser.getUsername(),
                email,
                attributes,
              });
            } else {
              setUser({
                username: cognitoUser.getUsername(),
              });
            }
            resolve();
          });
        } else {
          setUser(null);
          setIdToken(null);
          setAccessToken(null);
          reject(new Error('Session invalid'));
        }
      });
    });
  };

  useEffect(() => {
    refreshSession()
      .catch(() => {
        // User not authenticated
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const signOut = () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);
    setIdToken(null);
    setAccessToken(null);
  };

  return (
    <CustomAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        idToken,
        accessToken,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </CustomAuthContext.Provider>
  );
}

export function useCustomAuth() {
  const context = useContext(CustomAuthContext);
  if (context === undefined) {
    throw new Error('useCustomAuth must be used within CustomAuthProvider');
  }
  return context;
}

/**
 * Helper function to make authenticated API calls
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const cognitoUser = userPool.getCurrentUser();
  
  if (!cognitoUser) {
    throw new Error('No authenticated user');
  }

  return new Promise((resolve, reject) => {
    cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
      if (err || !session) {
        reject(new Error('Failed to get session'));
        return;
      }

      const idToken = session.getIdToken().getJwtToken();

      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(resolve)
        .catch(reject);
    });
  });
}
