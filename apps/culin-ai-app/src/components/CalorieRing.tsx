import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '@/src/design/tokens';

interface Props {
  consumed: number;
  goal: number;
  size?: number;
  thickness?: number;
}

/**
 * Pure-RN approximation of a circular progress ring built from two
 * half-circle clips. Renders a large number for "left" and "LEFT" caption.
 *
 * No external SVG dependency — uses View clipping + transform: rotate.
 */
export function CalorieRing({ consumed, goal, size = 110, thickness = 7 }: Props) {
  const safeGoal = Math.max(1, goal);
  const isOver = consumed > safeGoal;
  // When over, show full ring at warning color and big-number = overage.
  const pct = Math.max(0, Math.min(1, consumed / safeGoal));
  const angle = pct * 360;
  const bigNumber = isOver
    ? Math.round(consumed - safeGoal)
    : Math.round(safeGoal - consumed);
  const caption = isOver ? 'OVER' : 'LEFT';
  const arcColor = isOver ? colors.semantic.warning : colors.primary[600];

  // Two halves: left half handles 0..180deg, right half handles 180..360deg.
  // Each half uses an inner rotation to expose progress.
  const rightRotation = pct <= 0.5 ? -180 + angle : 0;
  const leftRotation = pct <= 0.5 ? -180 : -180 + (angle - 180);
  const showLeftHalf = pct > 0.5;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          styles.track,
          { width: size, height: size, borderRadius: size / 2, borderWidth: thickness },
        ]}
      />

      {/* Right half progress (0–50%) */}
      <View
        style={[
          styles.halfClipRight,
          {
            width: size / 2,
            height: size,
            left: size / 2,
          },
        ]}
      >
        <View
          style={[
            styles.halfRotator,
            {
              width: size,
              height: size,
              left: -size / 2,
              transform: [{ rotate: `${rightRotation}deg` }],
            },
          ]}
        >
          <View
            style={[
              styles.halfFill,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: thickness,
                borderRightColor: arcColor,
                borderTopColor: arcColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Left half progress (50–100%) */}
      {showLeftHalf && (
        <View
          style={[
            styles.halfClipLeft,
            {
              width: size / 2,
              height: size,
              left: 0,
            },
          ]}
        >
          <View
            style={[
              styles.halfRotator,
              {
                width: size,
                height: size,
                left: 0,
                transform: [{ rotate: `${leftRotation}deg` }],
              },
            ]}
          >
            <View
              style={[
                styles.halfFill,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: thickness,
                  borderRightColor: arcColor,
                  borderTopColor: arcColor,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Center label */}
      <View style={styles.centerLabel} pointerEvents="none">
        <Text style={[styles.bigNumber, isOver && styles.bigNumberOver]}>
          {bigNumber.toLocaleString()}
        </Text>
        <Text style={[styles.caption, isOver && styles.captionOver]}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: colors.neutral.gray100,
  },
  halfClipRight: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  halfClipLeft: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  halfRotator: {
    position: 'absolute',
    top: 0,
  },
  halfFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'transparent',
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigNumber: {
    fontFamily: fontFamily.primaryLight,
    fontSize: 22,
    fontWeight: '300',
    color: colors.neutral.blackSoft,
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  bigNumberOver: {
    color: colors.semantic.warning,
  },
  caption: {
    fontFamily: fontFamily.primary,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.neutral.gray300,
    marginTop: 4,
  },
  captionOver: {
    color: colors.semantic.warning,
    fontFamily: fontFamily.primaryMedium,
  },
});
