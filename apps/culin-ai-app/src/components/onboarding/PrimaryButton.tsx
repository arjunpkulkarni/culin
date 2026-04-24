import React from 'react';
import { StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, spacing, typography, radius, shadows } from '@/src/design/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function PrimaryButton({ 
  label, 
  onPress, 
  disabled = false, 
  loading = false,
  icon,
  variant = 'primary',
}: PrimaryButtonProps) {
  const [pressed, setPressed] = React.useState(false);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withTiming(pressed ? 0.98 : 1, {
            duration: 150,
          }),
        },
      ],
    };
  });

  const handlePressIn = () => setPressed(true);
  const handlePressOut = () => setPressed(false);

  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <AnimatedPressable
      style={[
        styles.button,
        isPrimary ? styles.buttonPrimary : isOutline ? styles.buttonSecondary : styles.buttonSecondary,
        animatedStyle,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.neutral.white : colors.primary[600]} size="small" />
      ) : (
        <>
          <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
            {label}
          </Text>
          {icon && (
            <MaterialIcons 
              name={icon} 
              size={20} 
              color={isPrimary ? colors.neutral.white : colors.primary[600]} 
              style={styles.iconRight} 
            />
          )}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary[600],
    ...shadows.button,
  },
  buttonSecondary: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
  },
  buttonText: {
    ...typography.button,
  },
  buttonTextPrimary: {
    color: colors.neutral.white,
  },
  buttonTextSecondary: {
    color: colors.primary[600],
  },
  iconRight: {
    marginLeft: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
