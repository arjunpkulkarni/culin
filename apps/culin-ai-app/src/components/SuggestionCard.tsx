import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows } from '@/src/design/tokens';

export type SuggestionBadge = 'HIGH PROTEIN' | 'BALANCED' | 'LOW CAL' | 'QUICK' | 'AI PICK';

export interface Suggestion {
  id: string;
  name: string;
  badge?: SuggestionBadge;
  protein: number;
  calories: number;
  prepTime?: number;
  /** Optional override for the leading icon. Defaults to icon derived from badge. */
  icon?: keyof typeof MaterialIcons.glyphMap;
}

interface Props {
  suggestion: Suggestion;
  onLog: (s: Suggestion) => void;
  onCook: (s: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onLog, onCook }: Props) {
  const iconName = suggestion.icon ?? iconForBadge(suggestion.badge);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialIcons name={iconName} size={18} color={colors.primary[700]} />
        </View>
        {suggestion.badge && (
          <View style={[styles.badge, badgeStyleFor(suggestion.badge)]}>
            <Text style={styles.badgeText}>{suggestion.badge}</Text>
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {suggestion.name}
      </Text>

      <View style={styles.statsRow}>
        <Text style={styles.statValue}>
          {suggestion.protein}g{' '}
          <Text style={styles.statLabel}>protein</Text>
        </Text>
        <View style={styles.statDot} />
        <Text style={styles.statValue}>
          {suggestion.calories}{' '}
          <Text style={styles.statLabel}>cal</Text>
        </Text>
        {suggestion.prepTime !== undefined && (
          <>
            <View style={styles.statDot} />
            <View style={styles.statTime}>
              <MaterialIcons name="schedule" size={12} color={colors.neutral.gray600} />
              <Text style={[styles.statValue, styles.statTimeText]}>{suggestion.prepTime}m</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => onLog(suggestion)}
        >
          <Text style={[styles.btnText, styles.btnTextPrimary]}>Log</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => onCook(suggestion)}
        >
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Cook</Text>
        </Pressable>
      </View>
    </View>
  );
}

function badgeStyleFor(badge: SuggestionBadge) {
  switch (badge) {
    case 'HIGH PROTEIN':
      return { backgroundColor: colors.primary.soft };
    case 'BALANCED':
      return { backgroundColor: colors.accent.skyBlue + '40' };
    case 'LOW CAL':
      return { backgroundColor: colors.accent.mint };
    case 'QUICK':
      return { backgroundColor: colors.semantic.warning + '30' };
    case 'AI PICK':
    default:
      return { backgroundColor: colors.primary.soft };
  }
}

function iconForBadge(badge?: SuggestionBadge): keyof typeof MaterialIcons.glyphMap {
  switch (badge) {
    case 'HIGH PROTEIN':
      return 'fitness-center';
    case 'BALANCED':
      return 'balance';
    case 'LOW CAL':
      return 'eco';
    case 'QUICK':
      return 'bolt';
    case 'AI PICK':
    default:
      return 'restaurant';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: 14,
    width: 180,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.primary[700],
  },
  name: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    lineHeight: 19,
    color: colors.neutral.blackSoft,
    marginBottom: 10,
    minHeight: 38,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  statValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.neutral.blackSoft,
  },
  statLabel: {
    fontFamily: fontFamily.primary,
    color: colors.neutral.gray600,
    fontWeight: '400',
  },
  statTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statTimeText: {
    color: colors.neutral.gray600,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.neutral.gray300,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary[600],
  },
  btnSecondary: {
    backgroundColor: colors.neutral.offWhite,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  btnText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
  },
  btnTextPrimary: {
    color: colors.neutral.white,
  },
  btnTextSecondary: {
    color: colors.neutral.blackSoft,
  },
});
