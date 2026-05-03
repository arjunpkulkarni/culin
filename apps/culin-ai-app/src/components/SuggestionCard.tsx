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
  /** Local storage id when this row maps to a saved recipe (Eat next deletes). */
  storedRecipeId?: string;
}

interface Props {
  suggestion: Suggestion;
  onLog: (s: Suggestion) => void;
  onCook: (s: Suggestion) => void;
  /** When set, shows a dismiss control so the backing saved recipe can be removed. */
  onRemove?: (s: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onLog, onCook, onRemove }: Props) {
  const iconName = suggestion.icon ?? iconForBadge(suggestion.badge);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <MaterialIcons name={iconName} size={16} color={colors.primary[700]} />
        </View>
        <View style={styles.headerSpacer} />
        {suggestion.badge && (
          <View style={[styles.badge, badgeStyleFor(suggestion.badge)]}>
            <Text style={styles.badgeText}>{suggestion.badge}</Text>
          </View>
        )}
        {onRemove && (
          <Pressable
            style={styles.removeBtn}
            onPress={() => onRemove(suggestion)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove recipe from Eat next"
          >
            <MaterialIcons name="close" size={16} color={colors.neutral.gray600} />
          </Pressable>
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {suggestion.name}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{suggestion.protein}g</Text>
          <Text style={styles.statLbl}>protein</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{suggestion.calories}</Text>
          <Text style={styles.statLbl}>cal</Text>
        </View>
        {suggestion.prepTime !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{suggestion.prepTime}m</Text>
            <Text style={styles.statLbl}>time</Text>
          </View>
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
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 6,
  },
  headerSpacer: {
    flex: 1,
    minWidth: 0,
    minHeight: 1,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.offWhite,
    flexShrink: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.primary[700],
  },
  name: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    lineHeight: 18,
    color: colors.neutral.blackSoft,
    marginBottom: 10,
    minHeight: 36,
    letterSpacing: -0.2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statNum: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 12,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.2,
  },
  statLbl: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    color: colors.neutral.gray600,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
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
    fontSize: 13,
  },
  btnTextPrimary: {
    color: colors.neutral.white,
  },
  btnTextSecondary: {
    color: colors.neutral.blackSoft,
  },
});
