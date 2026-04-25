import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, shadows } from '@/src/design/tokens';

export interface PrimaryAction {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}

interface Props {
  primary: PrimaryAction;
  secondary?: PrimaryAction;
}

/**
 * Contextual bottom-of-screen action bar.
 *
 * - With one action: full-width primary CTA.
 * - With two actions: 50/50 split. Primary uses the green gradient,
 *   secondary uses a subtle outlined style.
 *
 * The label/icon/onPress are passed in by each screen so the bar morphs
 * based on context (no internal state, no global store).
 */
export function PrimaryActionBar({ primary, secondary }: Props) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.wrapper, { paddingBottom: bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        {secondary && <SecondaryButton action={secondary} />}
        <PrimaryButton action={primary} expanded={!secondary} />
      </View>
    </Animated.View>
  );
}

function PrimaryButton({ action, expanded }: { action: PrimaryAction; expanded: boolean }) {
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      style={({ pressed }) => [
        styles.btnBase,
        expanded ? styles.btnExpanded : styles.btnHalf,
        pressed && styles.btnPressed,
        action.disabled && styles.btnDisabled,
      ]}
    >
      <LinearGradient
        colors={[colors.primary[500], colors.primary[600], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <MaterialIcons name={action.icon} size={20} color={colors.neutral.white} />
        <Text style={styles.primaryText} numberOfLines={1}>
          {action.label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({ action }: { action: PrimaryAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      style={({ pressed }) => [
        styles.btnBase,
        styles.btnHalf,
        styles.btnSecondary,
        pressed && styles.btnPressed,
        action.disabled && styles.btnDisabled,
      ]}
    >
      <MaterialIcons name={action.icon} size={20} color={colors.neutral.blackSoft} />
      <Text style={styles.secondaryText} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btnBase: {
    height: 56,
    borderRadius: radius.button,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.floating,
  },
  btnExpanded: {
    flex: 1,
  },
  btnHalf: {
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  gradient: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.white,
  },
  secondaryText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
});
