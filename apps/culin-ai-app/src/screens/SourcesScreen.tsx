import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { HEALTH_DISCLAIMER, NUTRITION_SOURCES } from '@/src/constants/sources';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function SourcesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.neutral.blackSoft} />
        </Pressable>
        <Text style={styles.headerTitle}>Sources</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Where our nutrition information comes from</Text>
          <Text style={styles.introBody}>{HEALTH_DISCLAIMER}</Text>
        </View>

        <View style={styles.list}>
          {NUTRITION_SOURCES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => openUrl(s.url)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="link"
              accessibilityLabel={`${s.title} from ${s.organization}. Opens in browser.`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <MaterialIcons name="open-in-new" size={16} color={colors.neutral.gray300} />
              </View>
              <Text style={styles.cardOrg}>{s.organization}</Text>
              <Text style={styles.cardDesc}>{s.description}</Text>
              <Text style={styles.cardUrl} numberOfLines={1}>
                {s.url.replace(/^https?:\/\//, '')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>
          Have a suggestion or correction? Email{' '}
          <Text
            style={styles.footerLink}
            onPress={() => openUrl('mailto:support@culinai.app?subject=Nutrition%20sources')}
          >
            support@culinai.app
          </Text>
          .
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 17,
    color: colors.neutral.blackSoft,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  introCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadows.soft,
  },
  introTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.neutral.blackSoft,
    marginBottom: spacing.sm,
  },
  introBody: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    lineHeight: 19,
    color: colors.neutral.gray600,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadows.soft,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
  cardOrg: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
    marginTop: 2,
  },
  cardDesc: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    lineHeight: 19,
    color: colors.neutral.blackSoft,
    marginTop: spacing.sm,
  },
  cardUrl: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  footer: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral.gray600,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footerLink: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.primary[700],
  },
});
