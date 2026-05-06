import { colors, fontFamily, spacing } from '@/src/design/tokens';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  /** Optional custom leading copy (defaults to "Nutrition info is an estimate"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact, low-visual-weight footer pointing users at the dedicated
 * Sources screen. Used on screens that surface calorie/macro estimates
 * to satisfy App Store Review Guideline 1.4.1 (sources easy to find).
 */
export default function SourcesFooter({
  label = 'Nutrition info is an estimate',
  style,
}: Props) {
  const router = useRouter();
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => router.push('/sources' as any)}
        hitSlop={8}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="link"
        accessibilityLabel="View nutrition information and sources"
      >
        <MaterialIcons name="info-outline" size={13} color={colors.neutral.gray300} />
        <Text style={styles.text}>
          {label} · <Text style={styles.link}>View sources</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowPressed: {
    opacity: 0.6,
  },
  text: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray300,
    letterSpacing: 0.2,
  },
  link: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.neutral.gray600,
    textDecorationLine: 'underline',
  },
});
