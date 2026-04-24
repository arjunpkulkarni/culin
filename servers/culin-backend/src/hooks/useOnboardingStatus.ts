import { useState, useEffect } from 'react';
import { useCustomAuth } from './useCustomAuth';

export interface OnboardingStatus {
  needsOnboarding: boolean;
  profileExists: boolean;
  loading: boolean;
  error: string | null;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { user, accessToken } = useCustomAuth();
  const [status, setStatus] = useState<OnboardingStatus>({
    needsOnboarding: true,
    profileExists: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!user) {
        setStatus({
          needsOnboarding: true,
          profileExists: false,
          loading: false,
          error: null,
        });
        return;
      }

      try {
        const token = accessToken;
        if (!token) {
          throw new Error('No access token');
        }

        // Check if profile exists
        const response = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 404) {
          // Profile doesn't exist - create it
          const createResponse = await fetch('/api/user/profile', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              displayName: user.email?.split('@')[0],
            }),
          });

          if (!createResponse.ok) {
            throw new Error('Failed to create profile');
          }

          // New profile created - needs onboarding
          setStatus({
            needsOnboarding: true,
            profileExists: true,
            loading: false,
            error: null,
          });
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const { profile } = await response.json();

        // Check if onboarding is complete
        setStatus({
          needsOnboarding: !profile.onboarding_completed,
          profileExists: true,
          loading: false,
          error: null,
        });

      } catch (error: any) {
        console.error('Error checking onboarding status:', error);
        setStatus({
          needsOnboarding: true,
          profileExists: false,
          loading: false,
          error: error.message || 'Failed to check onboarding status',
        });
      }
    }

    checkOnboardingStatus();
  }, [user, accessToken]);

  return status;
}
