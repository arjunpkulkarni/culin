import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { HEALTH_DISCLAIMER, NUTRITION_SOURCES } from '@/src/constants/sources';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  /**
   * When true (default), renders a compact version with the top sources
   * and a "See all" link to the full Sources screen. Set to false to
   * render every source inline.
   */
  compact?: boolean;
  /** Optional override for how many sources to show in compact mode. */
  visibleCount?: number;
}

const openUrl = async (url: string) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Can't open link", url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Can't open link", url);
  }
};

export default function SourcesSection({ compact = true, visibleCount = 3 }: Props) {
  const router = useRouter();
  const sources = compact ? NUTRITION_SOURCES.slice(0, visibleCount) : NUTRITION_SOURCES;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <MaterialIcons name="menu-book" size={16} color={colors.primary[700]} />
        <Text style={styles.title}>Nutrition information &amp; sources</Text>
      </View>

      <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>

      <View style={styles.list}>
        {sources.map((s, idx) => (
          <Pressable
            key={s.id}
            onPress={() => openUrl(s.url)}
            style={({ pressed }) => [
              styles.row,
              idx === sources.length - 1 && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="link"
            accessibilityLabel={`${s.title} from ${s.organization}. Opens in browser.`}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{s.title}</Text>
              <Text style={styles.rowOrg}>{s.organization}</Text>
              {!compact && <Text style={styles.rowDesc}>{s.description}</Text>}
            </View>
            <MaterialIcons
              name="open-in-new"
              size={16}
              color={colors.neutral.gray300}
              style={styles.rowIcon}
            />
          </Pressable>
        ))}
      </View>

      {compact && NUTRITION_SOURCES.length > visibleCount && (
        <Pressable
          onPress={() => router.push('/sources' as any)}
          style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}
          hitSlop={6}
        >
          <Text style={styles.seeAllText}>See all sources</Text>
          <MaterialIcons name="chevron-right" size={16} color={colors.primary[700]} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
  },
  disclaimer: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral.gray600,
    marginBottom: spacing.md,
  },
  list: {
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.gray100,
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.neutral.gray100,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.neutral.blackSoft,
  },
  rowOrg: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
  },
  rowDesc: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    lineHeight: 17,
    color: colors.neutral.gray600,
    marginTop: 4,
  },
  rowIcon: {
    marginLeft: 'auto',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  seeAllPressed: {
    opacity: 0.7,
  },
  seeAllText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.primary[700],
  },
});
