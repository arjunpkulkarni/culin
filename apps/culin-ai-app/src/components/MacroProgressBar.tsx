import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/src/design/tokens';

interface Props {
  label: string;
  consumed: number;
  goal: number;
  unit?: string;
  color?: string;
}

/**
 * Single macro row: label on left, value on right, progress bar underneath.
 */
export function MacroProgressBar({
  label,
  consumed,
  goal,
  unit = 'g',
  color = colors.primary[600],
}: Props) {
  const isOver = goal > 0 && consumed > goal;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const fillWidth = `${Math.round(pct * 100)}%` as const;
  const fillColor = isOver ? colors.semantic.warning : color;

  return (
    <View style={styles.row}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          <Text style={[styles.consumed, isOver && styles.consumedOver]}>
            {Math.round(consumed)}
          </Text>
          <Text style={styles.divider}> / </Text>
          <Text style={styles.goal}>
            {Math.round(goal)}
            {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 7,
  },
  label: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    letterSpacing: 0.1,
  },
  value: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  consumed: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.neutral.blackSoft,
  },
  consumedOver: {
    color: colors.semantic.warning,
  },
  divider: {
    color: colors.neutral.gray300,
  },
  goal: {
    color: colors.neutral.gray300,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(229, 234, 231, 0.7)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
