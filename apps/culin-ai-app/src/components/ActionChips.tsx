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
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  chipPrimary: {
    backgroundColor: colors.primary[600],
  },
  chipSecondary: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
  },
  labelPrimary: {
    color: colors.neutral.white,
  },
  labelSecondary: {
    color: colors.neutral.blackSoft,
  },
});
