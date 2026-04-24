import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '@/src/design/tokens';

interface ProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressHeader({ currentStep, totalSteps }: ProgressHeaderProps) {
  const insets = useSafeAreaInsets();
  const progress = currentStep / totalSteps;

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${progress * 100}%`, {
        duration: 200,
      }),
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, progressStyle]} />
        </View>
      </View>
      <Text style={styles.stepText}>
        STEP {currentStep} OF {totalSteps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  progressBarContainer: {
    marginBottom: spacing.sm,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.neutral.gray100,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: radius.full,
  },
  stepText: {
    ...typography.caption,
    color: colors.neutral.gray600,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
