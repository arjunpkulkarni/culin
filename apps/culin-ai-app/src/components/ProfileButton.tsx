import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
 * Compact circular profile button for the top-right corner. Renders the
 * user's initial when no avatar URL is available; otherwise shows a generic
 * person icon. No emoji.
 */
export function ProfileButton({ name, onPress }: Props) {
  const initial = (name?.trim()?.[0] ?? '').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={styles.avatar}>
        {initial ? (
          <Text style={styles.initial}>{initial}</Text>
        ) : (
          <MaterialIcons name="person" size={20} color={colors.primary[700]} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  initial: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.primary[700],
    letterSpacing: -0.2,
  },
});
