import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius, shadows } from '@/src/design/tokens';

interface SliderInputProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  label?: string;
  formatValue?: (value: number) => string;
  leftLabel?: string;
  rightLabel?: string;
}

export function SliderInput({
  value,
  onValueChange,
  minimumValue,
  maximumValue,
  step = 1,
  label,
  formatValue,
  leftLabel,
  rightLabel,
}: SliderInputProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <Animated.View entering={FadeInDown.duration(200).delay(50)} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.content}>
          {label && <Text style={styles.label}>{label}</Text>}
          
          <View style={styles.valueContainer}>
            <Text style={styles.value}>{displayValue}</Text>
          </View>

          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              value={value}
              onValueChange={onValueChange}
              minimumValue={minimumValue}
              maximumValue={maximumValue}
              step={step}
              minimumTrackTintColor={colors.primary[600]}
              maximumTrackTintColor={colors.neutral.gray100}
              thumbTintColor={colors.primary[600]}
            />
          </View>

          {(leftLabel || rightLabel) && (
            <View style={styles.labelsContainer}>
              <Text style={styles.rangeLabel}>{leftLabel}</Text>
              <Text style={styles.rangeLabel}>{rightLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray100,
    ...shadows.card,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  label: {
    ...typography.caption,
    color: colors.neutral.gray600,
    textAlign: 'left',
    marginBottom: spacing.md,
  },
  valueContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  value: {
    ...typography.titleXL,
    color: colors.primary[600],
  },
  sliderContainer: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  rangeLabel: {
    ...typography.caption,
    color: colors.neutral.gray600,
  },
});
