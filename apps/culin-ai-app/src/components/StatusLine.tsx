import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/src/design/tokens';
import type { DailyTotals } from '@/src/services/mealStore';

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Macro = 'protein' | 'carbs' | 'fat';

interface Props {
  goals: NutritionGoals | null;
  totals: DailyTotals;
}

interface StatusContent {
  prefix: string;
  highlight: string;
  suffix: string;
}

/**
 * Picks the most actionable line based on the user's remaining macros.
 * Returns the macro the user is most behind on (lowest % of goal).
 */
function pickStatus(goals: NutritionGoals, totals: DailyTotals): StatusContent {
  const calLeft = Math.max(0, Math.round(goals.calories - totals.calories));
  const calOver = Math.max(0, Math.round(totals.calories - goals.calories));
  const proteinLeft = Math.max(0, Math.round(goals.protein - totals.protein));
  const carbsLeft = Math.max(0, Math.round(goals.carbs - totals.carbs));
  const fatLeft = Math.max(0, Math.round(goals.fat - totals.fat));

  const macroPct = (totals: number, goal: number) => (goal > 0 ? totals / goal : 1);
  const pcts: Array<{ macro: Macro; pct: number; left: number }> = [
    { macro: 'protein', pct: macroPct(totals.protein, goals.protein), left: proteinLeft },
    { macro: 'carbs', pct: macroPct(totals.carbs, goals.carbs), left: carbsLeft },
    { macro: 'fat', pct: macroPct(totals.fat, goals.fat), left: fatLeft },
  ];

  // No meals logged today
  if (totals.mealCount === 0) {
    return {
      prefix: '',
      highlight: 'Start your day.',
      suffix: ` ${calLeft} cal to go.`,
    };
  }

  // OVER on calories — highest priority once they've eaten enough
  if (calOver > 0) {
    // Still missing protein? Mention it because protein-light overshoots happen.
    if (proteinLeft > 30) {
      return {
        prefix: "You're ",
        highlight: `${calOver} cal over`,
        suffix: ` and still need ${proteinLeft}g protein.`,
      };
    }
    return {
      prefix: "You're ",
      highlight: `${calOver} cal over`,
      suffix: ` for today.`,
    };
  }

  // On track — all macros within 10% of goal
  const allOnTrack = pcts.every((p) => p.pct >= 0.9);
  if (allOnTrack && calLeft < goals.calories * 0.1) {
    return {
      prefix: "You're ",
      highlight: 'on track',
      suffix: '. Nice work.',
    };
  }

  // Find the most-behind macro that still has meaningful gap
  pcts.sort((a, b) => a.pct - b.pct);
  const weakest = pcts[0];

  if (weakest.left > 0) {
    return {
      prefix: "You're ",
      highlight: `low on ${weakest.macro}`,
      suffix: `. ${weakest.left}g ${weakest.macro} left, ${calLeft} cal to go.`,
    };
  }

  // Fallback: just show calories remaining
  return {
    prefix: '',
    highlight: `${calLeft} cal to go`,
    suffix: ` today.`,
  };
}

export function StatusLine({ goals, totals }: Props) {
  if (!goals) return null;
  const { prefix, highlight, suffix } = pickStatus(goals, totals);
  const isOver = goals.calories > 0 && totals.calories > goals.calories;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {prefix}
        <Text style={[styles.highlight, isOver && styles.highlightWarning]}>
          {highlight}
        </Text>
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 16,
  },
  text: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.gray600,
  },
  highlight: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.primary[700],
  },
  highlightWarning: {
    color: colors.semantic.warning,
  },
});
