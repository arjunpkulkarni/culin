import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily, radius, spacing } from '@/src/design/tokens';

export interface ActionChip {
  id: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
}

interface Props {
  chips: ActionChip[];
}

export function ActionChips({ chips }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const isPrimary = chip.variant === 'primary';
        return (
          <Pressable
            key={chip.id}
            disabled={chip.disabled}
            onPress={chip.onPress}
            style={[
              styles.chip,
              isPrimary ? styles.chipPrimary : styles.chipSecondary,
              chip.disabled && styles.chipDisabled,
            ]}
          >
            <MaterialIcons
              name={chip.icon}
              size={16}
              color={isPrimary ? colors.neutral.white : colors.neutral.blackSoft}
            />
            <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  chipPrimary: {
    backgroundColor: colors.primary[600],
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  chipSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  chipDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  labelPrimary: {
    color: colors.neutral.white,
  },
  labelSecondary: {
    color: colors.neutral.blackSoft,
  },
});
