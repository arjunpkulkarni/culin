/**
 * User Profile Hook
 * 
 * Hook for managing user profile data with automatic sync to RDS
 */

import { useState, useEffect, useCallback } from 'react';
import { useCustomAuth } from './useCustomAuth';

export interface UserProfile {
  user_id: string;
  email: string;
  display_name?: string;
  date_of_birth?: string;
  height?: number; // cm
  weight?: number; // kg
  sex?: 'M' | 'F' | 'Other';
  goals?: string[];
  health_conditions?: string[];
  dietary_restrictions?: string[];
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fat?: number;
  photo_url?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserProfile() {
  const { user, accessToken, isAuthenticated } = useCustomAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user profile from API
   */
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      } else if (response.status === 404) {
        // Profile doesn't exist yet, create it
        await createProfile();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch profile');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  /**
   * Create initial user profile
   */
  const createProfile = useCallback(async () => {
    if (!isAuthenticated || !accessToken || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          displayName: user.email?.split('@')[0],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
      } else {
        setError(data.error || 'Failed to create profile');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken, user]);

  /**
   * Update user profile (onboarding data)
   */
  const updateProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'user_id' | 'email' | 'created_at' | 'updated_at'>>) => {
    if (!isAuthenticated || !accessToken) {
      throw new Error('Not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      // Convert snake_case to camelCase for API
      const payload: any = {};
      
      if (updates.display_name !== undefined) payload.displayName = updates.display_name;
      if (updates.date_of_birth !== undefined) payload.dateOfBirth = updates.date_of_birth;
      if (updates.height !== undefined) payload.height = updates.height;
      if (updates.weight !== undefined) payload.weight = updates.weight;
      if (updates.sex !== undefined) payload.sex = updates.sex;
      if (updates.goals !== undefined) payload.goals = updates.goals;
      if (updates.health_conditions !== undefined) payload.healthConditions = updates.health_conditions;
      if (updates.dietary_restrictions !== undefined) payload.dietaryRestrictions = updates.dietary_restrictions;
      if (updates.target_calories !== undefined) payload.targetCalories = updates.target_calories;
      if (updates.target_protein !== undefined) payload.targetProtein = updates.target_protein;
      if (updates.target_carbs !== undefined) payload.targetCarbs = updates.target_carbs;
      if (updates.target_fat !== undefined) payload.targetFat = updates.target_fat;
      if (updates.photo_url !== undefined) payload.photoURL = updates.photo_url;
      if (updates.onboarding_completed !== undefined) payload.onboardingCompleted = updates.onboarding_completed;

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
        return data.profile;
      } else {
        setError(data.error || 'Failed to update profile');
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  /**
   * Auto-fetch profile when user logs in
   */
  useEffect(() => {
    if (isAuthenticated && accessToken && !profile) {
      fetchProfile();
    }
  }, [isAuthenticated, accessToken, profile, fetchProfile]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    createProfile,
    updateProfile,
    isOnboardingComplete: profile?.onboarding_completed || false,
  };
}
