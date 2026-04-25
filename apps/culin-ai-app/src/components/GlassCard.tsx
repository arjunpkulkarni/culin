import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, shadows } from '@/src/design/tokens';

type GlassVariant = 'soft' | 'card' | 'hero';

interface Props extends ViewProps {
  /** Visual lift level. 'card' (default) for normal surfaces, 'hero' for the
   *  dominant card, 'soft' for tiny surfaces like rows. */
  variant?: GlassVariant;
  /** BlurView intensity (0..100). Defaults to a tasteful 50. */
  intensity?: number;
  /** Override the corner radius. Defaults to radius.card / cardLarge. */
  borderRadius?: number;
  /** When true, removes the inner highlight stroke. */
  noHighlight?: boolean;
  /** Override the white tint overlay strength (0..1). Defaults match variant. */
  tintOpacity?: number;
  containerStyle?: ViewStyle;
}

/**
 * Apple-glass-style surface. Renders a BlurView with:
 *  - a translucent white overlay (the "frost"),
 *  - a 1px white-at-0.6 inset highlight at the top edge,
 *  - a soft drop shadow,
 *  - all clipped to the card's radius.
 *
 * Usage: same as a <View>. Children sit on top of the glass.
 *
 *   <GlassCard variant="hero" style={styles.goalsCard}>
 *     ...content...
 *   </GlassCard>
 */
export function GlassCard({
  variant = 'card',
  intensity = 50,
  borderRadius: borderRadiusOverride,
  noHighlight = false,
  tintOpacity,
  style,
  children,
  ...rest
}: Props) {
  const cornerRadius =
    borderRadiusOverride ?? (variant === 'hero' ? radius.cardLarge : radius.card);

  const tint = tintOpacity ?? defaultTintFor(variant);
  const shadowStyle = shadowFor(variant);

  // expo-blur on iOS gives a real system blur. On Android the blur is
  // simulated; fall back to a heavier white overlay so the surface still
  // reads as elevated and milky.
  const isAndroidFallback = Platform.OS === 'android';

  return (
    <View
      {...rest}
      style={[
        styles.shadowWrap,
        shadowStyle,
        { borderRadius: cornerRadius },
        style,
      ]}
    >
      <View
        style={[
          styles.clip,
          { borderRadius: cornerRadius },
        ]}
      >
        {isAndroidFallback ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(255,255,255,${Math.min(1, tint + 0.3)})` },
            ]}
          />
        ) : (
          <BlurView
            tint="light"
            intensity={intensity}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* White frost overlay sitting on top of the blur */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(255,255,255,${tint})` },
          ]}
        />

        {/* Inset highlight stroke for the glass edge */}
        {!noHighlight && (
          <View
            pointerEvents="none"
            style={[
              styles.highlight,
              { borderRadius: cornerRadius },
            ]}
          />
        )}

        {children}
      </View>
    </View>
  );
}

function defaultTintFor(variant: GlassVariant): number {
  switch (variant) {
    case 'hero':
      return 0.55;
    case 'soft':
      return 0.5;
    case 'card':
    default:
      return 0.6;
  }
}

function shadowFor(variant: GlassVariant) {
  switch (variant) {
    case 'hero':
      return shadows.hero;
    case 'soft':
      return shadows.soft;
    case 'card':
    default:
      return shadows.card;
  }
}

const styles = StyleSheet.create({
  shadowWrap: {
    backgroundColor: 'transparent',
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    // Note: on RN we can't do an inset border, but a subtle 1px outline at
    // the top of the radius reads as a glass edge highlight on a colored bg.
  },
});

// Re-export so callers can build glass-styled surfaces when they don't want
// the wrapping shadow View (e.g. a meal row that's already inside a list).
export const glassPalette = {
  whiteSoft: 'rgba(255, 255, 255, 0.55)',
  whiteMedium: 'rgba(255, 255, 255, 0.65)',
  whiteHigh: 'rgba(255, 255, 255, 0.78)',
  edgeHighlight: 'rgba(255, 255, 255, 0.65)',
  edgeShadow: 'rgba(10, 31, 15, 0.06)',
};

// Token re-export for convenience to consumers
export const _internalRefs = { colors };
