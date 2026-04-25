import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
 * Solid primary-green circular profile button for the top-right corner.
 * The high-contrast surface against the mint background reads clearly as
 * an avatar / tappable target.
 */
export function ProfileButton({ name, onPress }: Props) {
  const initial = (name?.trim()?.[0] ?? '').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={styles.shadowWrap}>
        <LinearGradient
          colors={[colors.primary[500], colors.primary[600], colors.primary[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          {/* subtle inner highlight at the top to give the disc dimension */}
          <View pointerEvents="none" style={styles.innerHighlight} />
          {initial ? (
            <Text style={styles.initial}>{initial}</Text>
          ) : (
            <MaterialIcons name="person" size={22} color={colors.neutral.white} />
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const SIZE = 44;

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  shadowWrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    ...shadows.button,
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  innerHighlight: {
    position: 'absolute',
    top: -SIZE * 0.4,
    left: -SIZE * 0.3,
    width: SIZE * 1.2,
    height: SIZE * 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: SIZE,
  },
  initial: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 17,
    color: colors.neutral.white,
    letterSpacing: -0.2,
  },
});
