/**
 * useNutritionGoals
 *
 * Computes the user's daily macro targets from their stored profile
 * (height, weight, date_of_birth, sex) plus caller-supplied settings
 * (goal, activity level, goal pace, units).
 *
 * Optionally persists the computed goals back to the profile via
 * `saveGoals()`.
 */

import { useMemo, useCallback, useState } from 'react';
import { useUserProfile } from './useUserProfile';
import {
  calculateNutritionGoals,
  NutritionGoalInput,
  NutritionGoalResult,
  ActivityLevel,
  GoalType,
  GoalPace,
  HeightUnit,
  WeightUnit,
} from '@/lib/nutritionGoals';

// ─── Public types ─────────────────────────────────────────────────────────────

export type { ActivityLevel, GoalType, GoalPace, HeightUnit, WeightUnit };

export interface NutritionGoalSettings {
  goal: GoalType;
  activityLevel?: ActivityLevel;
  goalPace?: GoalPace;
  /** Override age (e.g. if date_of_birth not yet in profile) */
  ageOverride?: number;
  /** Override height (useful if user entered imperial during onboarding) */
  heightOverride?: number;
  heightUnit?: HeightUnit;
  /** Override weight */
  weightOverride?: number;
  weightUnit?: WeightUnit;
}

export interface UseNutritionGoalsReturn {
  /** Computed macro targets — null while profile is loading or inputs are missing */
  goals: NutritionGoalResult | null;
  /** True while the profile is being fetched */
  loading: boolean;
  /** Any error from profile fetching */
  error: string | null;
  /**
   * Persist the current computed goals to the user profile as
   * target_calories / target_protein / target_carbs / target_fat.
   * Throws if not authenticated or goals are null.
   */
  saveGoals: () => Promise<void>;
  /** True while saveGoals() is in flight */
  saving: boolean;
  /** Any error that occurred during saveGoals() */
  saveError: string | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function ageFromDOB(dob: string | undefined, ageOverride: number | undefined): number {
  if (ageOverride !== undefined) return ageOverride;
  if (!dob) return 22; // spec default
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNutritionGoals(settings: NutritionGoalSettings): UseNutritionGoalsReturn {
  const { profile, loading, error, updateProfile } = useUserProfile();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const goals = useMemo<NutritionGoalResult | null>(() => {
    // Resolve height — profile stores cm
    const height = settings.heightOverride ?? profile?.height;
    // Resolve weight — profile stores kg
    const weight = settings.weightOverride ?? profile?.weight;

    if (!height || !weight) return null;

    const input: NutritionGoalInput = {
      height,
      weight,
      age: ageFromDOB(profile?.date_of_birth, settings.ageOverride),
      sex: (profile?.sex as 'M' | 'F') ?? 'unknown',
      activityLevel: settings.activityLevel ?? 'moderate',
      goal: settings.goal,
      goalPace: settings.goalPace ?? 'normal',
      // heightUnit defaults to 'cm' (profile always stores cm)
      heightUnit: settings.heightOverride !== undefined ? (settings.heightUnit ?? 'cm') : 'cm',
      // weightUnit defaults to 'kg' (profile always stores kg)
      weightUnit: settings.weightOverride !== undefined ? (settings.weightUnit ?? 'kg') : 'kg',
    };

    return calculateNutritionGoals(input);
  }, [profile, settings]);

  const saveGoals = useCallback(async () => {
    if (!goals) throw new Error('No goals computed — check height/weight inputs');

    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({
        target_calories: goals.calories,
        target_protein: goals.protein,
        target_carbs: goals.carbs,
        target_fat: goals.fat,
      });
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save goals');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [goals, updateProfile]);

  return { goals, loading, error, saveGoals, saving, saveError };
}
