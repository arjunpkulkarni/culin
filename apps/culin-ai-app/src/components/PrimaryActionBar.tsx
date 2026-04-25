import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
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
  const isAndroidFallback = Platform.OS === 'android';

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.wrapper, { paddingBottom: bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={styles.dockShadow}>
        <View style={styles.dockClip}>
          {isAndroidFallback ? (
            <View style={[StyleSheet.absoluteFill, styles.dockAndroidFill]} />
          ) : (
            <BlurView tint="light" intensity={60} style={StyleSheet.absoluteFill} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.dockFrost]} />
          <View pointerEvents="none" style={styles.dockHighlight} />
          <View style={styles.dockRow}>
            {secondary && <SecondaryButton action={secondary} />}
            <PrimaryButton action={primary} expanded={!secondary} />
          </View>
        </View>
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

const DOCK_RADIUS = 32;
const BTN_HEIGHT = 52;
const BTN_RADIUS = 26;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dockShadow: {
    borderRadius: DOCK_RADIUS,
    ...shadows.floating,
  },
  dockClip: {
    borderRadius: DOCK_RADIUS,
    overflow: 'hidden',
  },
  dockAndroidFill: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  dockFrost: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  dockHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOCK_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  dockRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
  },
  btnBase: {
    height: BTN_HEIGHT,
    borderRadius: BTN_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnExpanded: {
    flex: 1,
  },
  btnHalf: {
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
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
