import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
      {chips.map((chip) => (
        <ChipButton key={chip.id} chip={chip} />
      ))}
    </ScrollView>
  );
}

function ChipButton({ chip }: { chip: ActionChip }) {
  const isPrimary = chip.variant === 'primary';
  const isAndroidFallback = Platform.OS === 'android';

  return (
    <Pressable
      disabled={chip.disabled}
      onPress={chip.onPress}
      style={[
        styles.chipShadow,
        isPrimary && styles.chipPrimaryShadow,
        chip.disabled && styles.chipDisabled,
      ]}
    >
      <View style={styles.chipClip}>
        {isPrimary ? (
          <View style={[StyleSheet.absoluteFill, styles.chipPrimaryFill]} />
        ) : isAndroidFallback ? (
          <View style={[StyleSheet.absoluteFill, styles.chipSecondaryAndroid]} />
        ) : (
          <BlurView tint="light" intensity={50} style={StyleSheet.absoluteFill} />
        )}
        {!isPrimary && (
          <>
            <View style={[StyleSheet.absoluteFill, styles.chipSecondaryFrost]} />
            <View pointerEvents="none" style={styles.chipHighlight} />
          </>
        )}
        <View style={styles.chipContent}>
          <MaterialIcons
            name={chip.icon}
            size={16}
            color={isPrimary ? colors.neutral.white : colors.neutral.blackSoft}
          />
          <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
            {chip.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const CHIP_HEIGHT = 44;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  chipShadow: {
    height: CHIP_HEIGHT,
    borderRadius: radius.full,
  },
  chipPrimaryShadow: {
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipClip: {
    height: CHIP_HEIGHT,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  chipPrimaryFill: {
    backgroundColor: colors.primary[600],
  },
  chipSecondaryAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  chipSecondaryFrost: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  chipHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  chipContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
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
