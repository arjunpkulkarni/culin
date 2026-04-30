import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { userPool, isCognitoConfigured, syncCognitoStorage } from '@/src/config/cognito';
import { setNutritionApiToken, setTokenRefresher } from '@/src/config/api';

interface AuthContextType {
  currentUser: CognitoUser | null;
  userData: UserData | null;
  loading: boolean;
  idToken: string | null;
  accessToken: string | null;
  /** False when Cognito is not configured. Use to show setup message. */
  isFirebaseReady: boolean; // Keep for compatibility with existing code
  isCognitoReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
  // Helper methods for compatibility with existing code
  getUserEmail: () => string | undefined;
  getUserId: () => string | undefined;
}

interface UserData {
  displayName: string;
  email: string;
  createdAt: string;
  photoURL?: string;
  dateOfBirth?: string; // ISO date string
  height?: number; // in cm
  weight?: number; // in kg
  sex?: 'M' | 'F' | 'Other';
  goals?: string[];
  healthConditions?: string[];
  onboardingCompleted?: boolean;
  [key: string]: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_DATA_KEY = '@culinai_user_data';

/**
 * Obtain fresh JWTs from Cognito. When the access token is expired but the
 * refresh token is still valid, calls refreshSession so API calls can succeed.
 */
function refreshCognitoTokens(
  cognitoUser: CognitoUser,
): Promise<{ idToken: string; accessToken: string } | null> {
  return new Promise((resolve) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (!session) {
        resolve(null);
        return;
      }

      const finish = (s: CognitoUserSession) => {
        if (!s.isValid()) {
          resolve(null);
          return;
        }
        resolve({
          idToken: s.getIdToken().getJwtToken(),
          accessToken: s.getAccessToken().getJwtToken(),
        });
      };

      if (session.isValid()) {
        finish(session);
        return;
      }

      const refreshToken = session.getRefreshToken();
      if (!refreshToken) {
        resolve(null);
        return;
      }

      cognitoUser.refreshSession(
        refreshToken,
        (reErr: Error | null, newSession: CognitoUserSession | null) => {
          if (reErr || !newSession) {
            resolve(null);
            return;
          }
          finish(newSession);
        },
      );
    });
  });
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CognitoUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Check if user is already signed in on app load
  useEffect(() => {
    void checkAuth();
    // Intentionally mount-only; checkAuth hydrates Cognito once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the nutrition-backend token store in sync with auth state
  useEffect(() => {
    setNutritionApiToken(accessToken);
  }, [accessToken]);

  // Register a refresh callback so callBackend can retry on 401
  useEffect(() => {
    setTokenRefresher(() => {
      return new Promise<string>((resolve, reject) => {
        const user = userPool.getCurrentUser();
        if (!user) {
          reject(new Error('No user'));
          return;
        }
        refreshCognitoTokens(user).then((tokens) => {
          if (!tokens) {
            reject(new Error('Session expired'));
            return;
          }
          setAccessToken(tokens.accessToken);
          setIdToken(tokens.idToken);
          resolve(tokens.accessToken);
        });
      });
    });
  }, []);

  // Auto-refresh session every 30 minutes if user is signed in.
  // Do not force logout on transient network failures.
  useEffect(() => {
    if (!currentUser) return;

    const refreshInterval = setInterval(async () => {
      try {
        if (__DEV__) console.log('🔄 Auto-refreshing session...');
        await refreshSession();
        if (__DEV__) console.log('✅ Session refreshed successfully');
      } catch (error) {
        if (__DEV__) console.warn('⚠️ Session refresh skipped (network issue?):', error);
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [currentUser]);

  const checkAuth = async () => {
    try {
      if (__DEV__) console.log('🔐 ========== CHECKING AUTH SESSION ==========');
      await syncCognitoStorage();
      const cognitoUser = userPool.getCurrentUser();

      if (!cognitoUser) {
        if (__DEV__) console.log('ℹ️ No existing session found - user needs to sign in');
        return;
      }

      if (__DEV__) console.log('👤 Found Cognito user:', cognitoUser.getUsername());

      const tokens = await refreshCognitoTokens(cognitoUser);
      if (!tokens) {
        if (__DEV__) {
          console.warn(
            'Could not obtain valid Cognito tokens — user must sign in again',
          );
        }
        setCurrentUser(null);
        setIdToken(null);
        setAccessToken(null);
        setUserData(null);
        return;
      }

      const username = cognitoUser.getUsername();
      const newIdToken = tokens.idToken;
      const newAccessToken = tokens.accessToken;

      setCurrentUser(cognitoUser);
      setIdToken(newIdToken);
      setAccessToken(newAccessToken);

      let hasUserData = false;
      try {
        const storedData = await AsyncStorage.getItem(`${USER_DATA_KEY}_${username}`);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          setUserData(parsedData);
          hasUserData = true;
        }
      } catch (localErr) {
        if (__DEV__) console.warn('Failed to read local user data:', localErr);
      }

      try {
        const { createCulinAIApi } = await import('@/src/services/culinaiApi');
        const api = createCulinAIApi(newIdToken);
        const response = await api.getUserProfile();

        const backendUserData = response.profile || response;

        if (backendUserData) {
          const transformedData = {
            displayName: backendUserData.display_name || backendUserData.displayName,
            email: backendUserData.email,
            dateOfBirth: backendUserData.date_of_birth,
            height: backendUserData.height,
            weight: backendUserData.weight,
            sex: backendUserData.sex,
            goals: backendUserData.goals,
            healthConditions: backendUserData.health_conditions,
            onboardingCompleted: backendUserData.onboarding_completed,
            photoURL: backendUserData.photo_url,
            createdAt: backendUserData.created_at,
          };

          await saveUserData(username, transformedData);
          hasUserData = true;
        }
      } catch (syncError) {
        if (__DEV__) {
          console.warn(
            'Could not fetch profile from backend (using local data):',
            syncError,
          );
        }
      }

      if (!hasUserData) {
        const stub: UserData = {
          displayName: 'User',
          email: cognitoUser.getUsername(),
          createdAt: new Date().toISOString(),
          onboardingCompleted: false,
        };
        await saveUserData(username, stub);
        if (__DEV__) console.log('🆕 Returning user with no profile — seeded onboarding stub');
      }
    } catch (error) {
      console.error('❌ Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (username: string) => {
    try {
      const storedData = await AsyncStorage.getItem(`${USER_DATA_KEY}_${username}`);
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          setUserData(parsedData);
        } catch (parseErr) {
          // Corrupted JSON — clear it so the backend sync can repopulate
          if (__DEV__) console.error('Corrupted user data in storage, clearing:', parseErr);
          await AsyncStorage.removeItem(`${USER_DATA_KEY}_${username}`);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading user data:', error);
      setUserData(null);
    }
  };

  // Save user data to AsyncStorage
  const saveUserData = async (username: string, data: UserData) => {
    try {
      await AsyncStorage.setItem(`${USER_DATA_KEY}_${username}`, JSON.stringify(data));
      setUserData(data);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  // Sign Up
  const signUp = (email: string, password: string, displayName: string = 'User') => {
    return new Promise<void>((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: 'name',
          Value: displayName,
        }),
      ];

      userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          setError(err.message);
          reject(err);
          return;
        }
        setError(null);
        
        // Initialize user data (will be fully populated after email verification)
        const initialUserData: UserData = {
      displayName,
      email,
      createdAt: new Date().toISOString(),
    };
        
        resolve();
      });
    });
  };

  // Verify Email Code
  const verifyEmail = (email: string, code: string) => {
    return new Promise<void>((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          setError(err.message);
          reject(err);
        return;
      }
        setError(null);
        resolve();
      });
    });
  };

  // Resend Verification Code
  const resendVerificationCode = (email: string) => {
    return new Promise<void>((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          setError(err.message);
          reject(err);
              return;
            }
        setError(null);
        resolve();
      });
    });
  };

  // Sign In
  const signIn = (email: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      console.log('🔐 ========== SIGN IN ATTEMPT ==========');
      console.log('Email:', email);
      
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const userData = {
        Username: email,
        Pool: userPool,
      };

      const cognitoUser = new CognitoUser(userData);

      // Use USER_PASSWORD_AUTH instead of SRP. The SRP flow in
      // amazon-cognito-identity-js v6 falls back to Math.random() in __DEV__
      // when global.nativeCallSyncHook is undefined (RN 0.81+ bridgeless),
      // which produces invalid SRP A values and Cognito rejects with
      // "Incorrect username or password". USER_PASSWORD_AUTH skips client-side
      // crypto entirely and sends credentials over TLS.
      cognitoUser.setAuthenticationFlowType('USER_PASSWORD_AUTH');

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session: CognitoUserSession) => {
          console.log('✅ Authentication successful!');
          const newIdToken = session.getIdToken().getJwtToken();
          const newAccessToken = session.getAccessToken().getJwtToken();
          
          console.log('📝 Setting user session...');
          setCurrentUser(cognitoUser);
          setIdToken(newIdToken);
          setAccessToken(newAccessToken);
          setError(null);
          
          const username = cognitoUser.getUsername();
          let hasUserData = false;
          // Load user data from AsyncStorage first
          console.log('📱 Loading user data from local storage...');
          try {
            const storedData = await AsyncStorage.getItem(`${USER_DATA_KEY}_${username}`);
            if (storedData) {
              const parsedData = JSON.parse(storedData);
              setUserData(parsedData);
              hasUserData = true;
            }
          } catch (localErr) {
            console.warn('⚠️ Failed to read local user data:', localErr);
          }
          
          // Try to fetch from backend and sync to local storage
          try {
            console.log('🌐 Fetching user profile from backend...');
            const { createCulinAIApi } = await import('@/src/services/culinaiApi');
            const api = createCulinAIApi(newIdToken);
            const response = await api.getUserProfile();
            
            const backendUserData = response.profile || response;
            
            if (backendUserData) {
              console.log('✅ User profile fetched from backend:', {
                displayName: backendUserData.display_name || backendUserData.displayName,
                onboardingCompleted: backendUserData.onboarding_completed,
              });
              
              const transformedData = {
                displayName: backendUserData.display_name || backendUserData.displayName,
                email: backendUserData.email,
                dateOfBirth: backendUserData.date_of_birth,
                height: backendUserData.height,
                weight: backendUserData.weight,
                sex: backendUserData.sex,
                goals: backendUserData.goals,
                healthConditions: backendUserData.health_conditions,
                onboardingCompleted: backendUserData.onboarding_completed,
                photoURL: backendUserData.photo_url,
                createdAt: backendUserData.created_at,
              };
              
              await saveUserData(username, transformedData);
              hasUserData = true;
              console.log('💾 Backend profile synced to local storage');
            }
          } catch (error) {
            console.warn('⚠️ Could not fetch profile from backend (using local data):', error);
          }

          // First-ever sign-in for this user (no local data, no backend profile —
          // typical 404 from /api/user/profile). Seed a stub so the root layout
          // routes to OnboardingScreen instead of hanging on the loading spinner
          // until LOADING_TIMEOUT_MS fires "Something went wrong".
          if (!hasUserData) {
            const stub: UserData = {
              displayName: 'User',
              email,
              createdAt: new Date().toISOString(),
              onboardingCompleted: false,
            };
            await saveUserData(username, stub);
            console.log('🆕 New user — seeded onboarding stub');
          }
          
          console.log('✅ Sign in complete! Session will persist until logout.');
          console.log('========================================');
          resolve();
        },
        onFailure: (err) => {
          console.error('❌ Sign in failed:', err.message);
          console.error('========================================');
          setError(err.message);
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // This is for admin-created users that need to set password
          // Not implemented in this flow
          console.error('❌ New password required (not implemented)');
          console.error('========================================');
          reject(new Error('New password required'));
        },
      });
    });
  };

  // Sign Out
  const logout = useCallback(async () => {
    console.log('👋 ========== SIGNING OUT ==========');
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      console.log('Signing out user:', cognitoUser.getUsername());
      cognitoUser.signOut();
    }
    setCurrentUser(null);
    setIdToken(null);
    setAccessToken(null);
    setUserData(null);
    setError(null);
    console.log('✅ Successfully signed out. Session cleared.');
    console.log('========================================');
  }, []);

  // Reset Password (forgot password)
  const resetPassword = (email: string) => {
    return new Promise<void>((resolve, reject) => {
      const userData = {
        Username: email,
        Pool: userPool,
      };
      const cognitoUser = new CognitoUser(userData);

      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          setError(null);
          resolve();
        },
        onFailure: (err) => {
          setError(err.message);
          reject(err);
        },
      });
    });
  };

  // Refresh Session
  const refreshSession = () => {
    return new Promise<void>((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        reject(new Error('No user found'));
        return;
      }

      refreshCognitoTokens(cognitoUser).then((tokens) => {
        if (!tokens) {
          reject(new Error('Session expired'));
          return;
        }
        setCurrentUser(cognitoUser);
        setIdToken(tokens.idToken);
        setAccessToken(tokens.accessToken);
        resolve();
      });
    });
  };

  // Update User Data
  const updateUserData = async (data: Partial<UserData>) => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    const username = currentUser.getUsername();
    const updatedData = { ...userData, ...data } as UserData;
    
    console.log('💾 ========== UPDATING USER DATA ==========');
    console.log('Username:', username);
    console.log('Data to save:', JSON.stringify(updatedData, null, 2));
    
    // 1. Save to AsyncStorage first (fast, always works)
    console.log('📱 Saving to AsyncStorage...');
    await saveUserData(username, updatedData);
    console.log('✅ Saved to AsyncStorage successfully!');
    
    // 2. Sync to backend (async, handle failures gracefully)
    if (idToken) {
      try {
        console.log('🌐 Syncing profile to backend...');
        console.log('Has token:', !!idToken);
        const { createCulinAIApi } = await import('@/src/services/culinaiApi');
        const api = createCulinAIApi(idToken);
        try {
          await api.updateUserProfile(updatedData);
        } catch (putError: any) {
          // Backend's PUT only updates existing rows. For first-time users
          // (e.g. completing onboarding) the profile doesn't exist yet, so
          // fall back to POST (create).
          const msg = String(putError?.message || '');
          const isMissing = /not found|404/i.test(msg);
          if (isMissing) {
            console.log('ℹ️ Profile does not exist on backend — creating via POST');
            try {
              await api.saveUserProfile(updatedData);
            } catch (postError: any) {
              const postMsg = String(postError?.message || '');
              // Orphaned row exists under a different sub (old Cognito pool)
              // and the deployed backend doesn't yet auto re-link. Treat as
              // non-fatal: local data is saved, the next backend deploy with
              // re-link logic will reconcile on the next call.
              if (/already exists|409/i.test(postMsg)) {
                console.warn('⚠️ Profile email already exists under a different user_id — skipping backend sync until re-link deploy');
              } else {
                throw postError;
              }
            }
          } else {
            throw putError;
          }
        }
        console.log('✅ User profile synced to backend successfully!');
        console.log('========================================');
      } catch (error) {
        console.error('❌ ========== BACKEND SYNC FAILED ==========');
        console.error('Error:', error);
        console.error('Data was saved locally, will retry on next update');
        console.error('========================================');
        // Don't throw - local save succeeded
        // User data is still saved locally and will sync on next update
      }
    } else {
      console.warn('⚠️ No idToken available, skipping backend sync');
      console.warn('========================================');
    }
  };

  // Delete Account
  const deleteAccount = async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    return new Promise<void>((resolve, reject) => {
      currentUser.deleteUser((err, result) => {
        if (err) {
          reject(err);
      return;
    }

        // Clear local data
        const username = currentUser.getUsername();
        AsyncStorage.removeItem(`${USER_DATA_KEY}_${username}`).catch(console.error);
        
        setCurrentUser(null);
        setIdToken(null);
        setAccessToken(null);
        setUserData(null);
        
        resolve();
      });
    });
  };

  // Google Sign-In (not implemented for Cognito - placeholder for compatibility)
  const signInWithGoogle = async () => {
    throw new Error('Google Sign-In is not configured for Cognito. Please use email/password authentication.');
  };

  // Helper methods for compatibility
  const getUserEmail = () => {
    return userData?.email || currentUser?.getUsername();
  };

  const getUserId = () => {
    // Cognito username is typically the email or a UUID
    // For compatibility, we use it as the user ID
    return currentUser?.getUsername();
  };

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    idToken,
    accessToken,
    isFirebaseReady: isCognitoConfigured(), // For compatibility
    isCognitoReady: isCognitoConfigured(),
    signIn,
    signUp,
    verifyEmail,
    resendVerificationCode,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserData,
    deleteAccount,
    refreshSession,
    isAuthenticated: !!currentUser && !!idToken && !!accessToken,
    getUserEmail,
    getUserId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
