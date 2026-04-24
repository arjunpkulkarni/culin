import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { AnimatedPressableComponent } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, spacing, radius, shadows } from '@/src/design/tokens';

export function FloatingLogButton() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = pathname === '/(tabs)' || pathname === '/(tabs)/';

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isActive ? 0.9 : 1, {
            damping: 20,
            stiffness: 200,
          }),
        },
      ],
    };
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { top: insets.top + spacing.lg },
        animatedStyle,
      ]}
    >
      <AnimatedPressableComponent
        style={[styles.button, isActive && styles.buttonActive]}
        onPress={() => router.push('/(tabs)' as any)}
        haptic={true}
      >
        <MaterialIcons
          name="add"
          size={20}
          color={colors.neutral.white}
        />
      </AnimatedPressableComponent>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 1000,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  buttonActive: {
    backgroundColor: colors.primary[700],
  },
});
