import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily, shadows } from '@/src/design/tokens';

interface Props {
  /** First or full name; we show the first letter when present. */
  name?: string | null;
  /** Optional remote avatar URL. Falls back to initial. */
  avatarUrl?: string | null;
  onPress: () => void;
}

/**
 * Glassy circular profile chip for the top-right corner. Uses a real
 * BlurView on iOS for an Apple-glass surface; falls back to a tinted
 * white on Android. The user's initial sits in the primary green.
 */
export function ProfileButton({ name, onPress }: Props) {
  const initial = (name?.trim()?.[0] ?? '').toUpperCase();
  const isAndroidFallback = Platform.OS === 'android';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={styles.shadow}>
        <View style={styles.clip}>
          {isAndroidFallback ? (
            <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
          ) : (
            <BlurView tint="light" intensity={50} style={StyleSheet.absoluteFill} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.frost]} />
          <View style={styles.highlight} pointerEvents="none" />
          <View style={styles.center}>
            {initial ? (
              <Text style={styles.initial}>{initial}</Text>
            ) : (
              <MaterialIcons name="person" size={20} color={colors.primary[700]} />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const SIZE = 42;

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  shadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    ...shadows.soft,
  },
  clip: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
  },
  androidFill: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  frost: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.primary[700],
    letterSpacing: -0.2,
  },
});
