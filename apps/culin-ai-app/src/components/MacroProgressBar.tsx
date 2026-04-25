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
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const fillWidth = `${Math.round(pct * 100)}%` as const;

  return (
    <View style={styles.row}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          <Text style={styles.consumed}>{Math.round(consumed)}</Text>
          <Text style={styles.divider}> / </Text>
          <Text style={styles.goal}>
            {Math.round(goal)}
            {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
  },
  value: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
  },
  consumed: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.neutral.blackSoft,
  },
  divider: {
    color: colors.neutral.gray300,
  },
  goal: {
    color: colors.neutral.gray300,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral.gray100,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
