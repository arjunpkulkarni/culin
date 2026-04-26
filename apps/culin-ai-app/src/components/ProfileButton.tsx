import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fontFamily } from '@/src/design/tokens';

interface Props {
  /** First or full name; we show the first letter when present. */
  name?: string | null;
  /** Optional remote avatar URL. Falls back to initial. */
  avatarUrl?: string | null;
  onPress: () => void;
}

/**
 * Solid primary-green circular profile button for the top-right corner.
 * If an `avatarUrl` is provided we render the photo; otherwise we fall back
 * to the user's first initial on a green gradient disc.
 */
export function ProfileButton({ name, avatarUrl, onPress }: Props) {
  const initial = (name?.trim()?.[0] ?? '').toUpperCase();
  const [imgError, setImgError] = useState(false);
  const showImage = !!avatarUrl && !imgError;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <View style={styles.shadowWrap}>
        {showImage ? (
          <View style={styles.avatar}>
            <Image
              source={{ uri: avatarUrl as string }}
              style={styles.avatarImg}
              onError={() => setImgError(true)}
            />
          </View>
        ) : (
          <LinearGradient
            colors={[colors.primary[500], colors.primary[600], colors.primary[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <View pointerEvents="none" style={styles.innerHighlight} />
            {initial ? (
              <Text style={styles.initial}>{initial}</Text>
            ) : (
              <MaterialIcons name="person" size={22} color={colors.neutral.white} />
            )}
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
}

const SIZE = 52;

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  shadowWrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    shadowColor: colors.primary[700],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.neutral.white,
    backgroundColor: colors.primary.soft,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  innerHighlight: {
    position: 'absolute',
    top: -SIZE * 0.45,
    left: -SIZE * 0.25,
    width: SIZE * 1.3,
    height: SIZE * 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: SIZE,
  },
  initial: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.white,
    letterSpacing: -0.3,
  },
});
