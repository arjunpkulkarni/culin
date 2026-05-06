import { useAuth } from '@/src/contexts/AuthContext';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { getMemberSinceYear } from '@/src/utils/dateUtils';
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToPounds,
  poundsToKg,
} from '@/src/utils/unitConverters';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOALS = [
  'Lose Weight',
  'Gain Muscle',
  'Boost Energy',
  'Gut Health',
  'Metabolism Boost',
];

const HEALTH_CONDITIONS = [
  'Type 2 Diabetes',
  'High Blood Pressure',
  'Heart Disease',
  'PCOS',
  'IBS',
  'Celiac Disease',
  'Food Allergies',
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData, logout, updateUserData, deleteAccount, getUserEmail } = useAuth();

  const userName = userData?.displayName || 'User';
  const userEmail = getUserEmail() || userData?.email || '';
  const memberSince = getMemberSinceYear(userData?.createdAt);

  // Edit state
  const [editingBasic, setEditingBasic] = useState(false);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [editHeightCm, setEditHeightCm] = useState('');
  const [editHeightFeet, setEditHeightFeet] = useState('');
  const [editHeightInches, setEditHeightInches] = useState('');
  const [editWeightKg, setEditWeightKg] = useState('');
  const [editWeightLbs, setEditWeightLbs] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.height) {
      setEditHeightCm(userData.height.toString());
      const { feet, inches } = cmToFeetInches(userData.height);
      setEditHeightFeet(feet.toString());
      setEditHeightInches(inches.toString());
    }
    if (userData?.weight) {
      setEditWeightKg(userData.weight.toString());
      setEditWeightLbs(kgToPounds(userData.weight).toString());
    }
  }, [userData?.height, userData?.weight]);

  // -- Photo picker --
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setEditPhoto(uri);
      try {
        await updateUserData({ photoURL: uri });
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to update photo');
      }
    }
  };

  // -- Basic info save --
  const saveBasicInfo = async () => {
    let heightInCm: number;
    let weightInKg: number;

    if (heightUnit === 'cm') {
      const n = Number(editHeightCm);
      if (!editHeightCm || isNaN(n) || n < 50 || n > 250) {
        Alert.alert('Invalid height', 'Enter a value between 50 and 250 cm.');
        return;
      }
      heightInCm = n;
    } else {
      const f = Number(editHeightFeet);
      const i = Number(editHeightInches);
      if (
        !editHeightFeet ||
        !editHeightInches ||
        isNaN(f) ||
        isNaN(i) ||
        f < 2 ||
        f > 8 ||
        i < 0 ||
        i >= 12
      ) {
        Alert.alert('Invalid height', 'Feet between 2 and 8, inches between 0 and 11.');
        return;
      }
      heightInCm = feetInchesToCm(f, i);
    }

    if (weightUnit === 'kg') {
      const n = Number(editWeightKg);
      if (!editWeightKg || isNaN(n) || n < 20 || n > 300) {
        Alert.alert('Invalid weight', 'Enter a value between 20 and 300 kg.');
        return;
      }
      weightInKg = n;
    } else {
      const n = Number(editWeightLbs);
      if (!editWeightLbs || isNaN(n) || n < 44 || n > 660) {
        Alert.alert('Invalid weight', 'Enter a value between 44 and 660 lbs.');
        return;
      }
      weightInKg = poundsToKg(n);
    }

    try {
      await updateUserData({ height: heightInCm, weight: weightInKg });
      setEditingBasic(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update.');
    }
  };

  // -- Goals + conditions: live save on toggle --
  const toggleGoal = async (goal: string) => {
    const current = userData?.goals ?? [];
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    try {
      await updateUserData({ goals: next });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update.');
    }
  };

  const toggleCondition = async (condition: string) => {
    const current = userData?.healthConditions ?? [];
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    try {
      await updateUserData({ healthConditions: next });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Sign out of CulinAI?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          try {
            await logout();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your CulinAI account, profile, and meal history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete account.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const photoUri = editPhoto || userData?.photoURL;
  const initial = userName.trim()[0]?.toUpperCase() ?? 'U';
  const heightDisplay = userData?.height
    ? heightUnit === 'cm'
      ? `${userData.height} cm`
      : (() => {
          const { feet, inches } = cmToFeetInches(userData.height);
          return `${feet}' ${inches}"`;
        })()
    : '—';
  const weightDisplay = userData?.weight
    ? weightUnit === 'kg'
      ? `${userData.weight} kg`
      : `${kgToPounds(userData.weight)} lb`
    : '—';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.neutral.blackSoft} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar block */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={handlePickPhoto} style={styles.avatarPressable}>
            <View style={styles.avatar}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="edit" size={14} color={colors.neutral.white} />
            </View>
          </Pressable>
          <Text style={styles.name}>{userName}</Text>
          {userEmail ? <Text style={styles.subtitle}>{userEmail}</Text> : null}
          <Text style={styles.subtle}>Member since {memberSince}</Text>
        </View>

        {/* Basic info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Basic info</Text>
            {editingBasic ? (
              <View style={styles.headerActions}>
                <Pressable onPress={() => setEditingBasic(false)} hitSlop={6}>
                  <Text style={styles.cancelLink}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveBasicInfo} hitSlop={6}>
                  <Text style={styles.saveLink}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingBasic(true)} hitSlop={6}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.statsGrid}>
            <Stat label="Sex" value={userData?.sex || '—'} />

            {editingBasic ? (
              <View style={styles.editStat}>
                <UnitToggle
                  options={[
                    { id: 'cm', label: 'cm' },
                    { id: 'ft', label: 'ft/in' },
                  ]}
                  value={heightUnit}
                  onChange={(v) => setHeightUnit(v as 'cm' | 'ft')}
                />
                {heightUnit === 'cm' ? (
                  <TextInput
                    style={styles.editInput}
                    value={editHeightCm}
                    onChangeText={setEditHeightCm}
                    keyboardType="number-pad"
                    placeholder="170"
                    placeholderTextColor={colors.neutral.gray300}
                  />
                ) : (
                  <View style={styles.feetInchRow}>
                    <TextInput
                      style={[styles.editInput, styles.editInputHalf]}
                      value={editHeightFeet}
                      onChangeText={setEditHeightFeet}
                      keyboardType="number-pad"
                      placeholder="ft"
                      placeholderTextColor={colors.neutral.gray300}
                    />
                    <TextInput
                      style={[styles.editInput, styles.editInputHalf]}
                      value={editHeightInches}
                      onChangeText={setEditHeightInches}
                      keyboardType="number-pad"
                      placeholder="in"
                      placeholderTextColor={colors.neutral.gray300}
                    />
                  </View>
                )}
                <Text style={styles.statLabel}>Height</Text>
              </View>
            ) : (
              <Stat label="Height" value={heightDisplay} />
            )}

            {editingBasic ? (
              <View style={styles.editStat}>
                <UnitToggle
                  options={[
                    { id: 'kg', label: 'kg' },
                    { id: 'lbs', label: 'lbs' },
                  ]}
                  value={weightUnit}
                  onChange={(v) => setWeightUnit(v as 'kg' | 'lbs')}
                />
                <TextInput
                  style={styles.editInput}
                  value={weightUnit === 'kg' ? editWeightKg : editWeightLbs}
                  onChangeText={
                    weightUnit === 'kg' ? setEditWeightKg : setEditWeightLbs
                  }
                  keyboardType="number-pad"
                  placeholder={weightUnit === 'kg' ? '70' : '154'}
                  placeholderTextColor={colors.neutral.gray300}
                />
                <Text style={styles.statLabel}>Weight</Text>
              </View>
            ) : (
              <Stat label="Weight" value={weightDisplay} />
            )}
          </View>
        </View>

        {/* Goals */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Goals</Text>
            <Text style={styles.cardHint}>Tap to toggle</Text>
          </View>
          <View style={styles.chipGrid}>
            {GOALS.map((goal) => {
              const active = userData?.goals?.includes(goal) ?? false;
              return (
                <Pressable
                  key={goal}
                  onPress={() => toggleGoal(goal)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {active && (
                    <MaterialIcons name="check" size={14} color={colors.neutral.white} />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {goal}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Health conditions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Health conditions</Text>
            <Text style={styles.cardHint}>Tap to toggle</Text>
          </View>
          <View style={styles.chipGrid}>
            {HEALTH_CONDITIONS.map((cond) => {
              const active = userData?.healthConditions?.includes(cond) ?? false;
              return (
                <Pressable
                  key={cond}
                  onPress={() => toggleCondition(cond)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {active && (
                    <MaterialIcons name="check" size={14} color={colors.neutral.white} />
                  )}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cond}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.actionsCard}>
          <Pressable
            style={styles.signOutRow}
            onPress={() => router.push('/sources' as any)}
          >
            <MaterialIcons name="menu-book" size={20} color={colors.neutral.blackSoft} />
            <Text style={styles.signOutText}>Nutrition information &amp; sources</Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.neutral.gray300}
              style={styles.actionChevron}
            />
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable style={styles.signOutRow} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={20} color={colors.neutral.blackSoft} />
            <Text style={styles.signOutText}>Sign out</Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.neutral.gray300}
              style={styles.actionChevron}
            />
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable style={styles.signOutRow} onPress={handleDeleteAccount}>
            <MaterialIcons name="delete-outline" size={20} color={colors.semantic.error} />
            <Text style={styles.deleteText}>Delete account</Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.neutral.gray300}
              style={styles.actionChevron}
            />
          </Pressable>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.unitRow}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.unitBtn, active && styles.unitBtnActive]}
          >
            <Text style={[styles.unitText, active && styles.unitTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

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
    paddingBottom: spacing.xl,
  },
  avatarBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  avatarPressable: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 36,
    color: colors.primary[700],
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.neutral.offWhite,
  },
  name: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
  },
  subtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
  },
  subtle: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray300,
    marginTop: 2,
  },

  // Cards
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.neutral.blackSoft,
  },
  cardHint: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray300,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editLink: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.primary[700],
  },
  saveLink: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.primary[700],
  },
  cancelLink: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 18,
    color: colors.neutral.blackSoft,
  },
  statLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Edit stat (height/weight in edit mode)
  editStat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    padding: spacing.sm,
    gap: 6,
  },
  editInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.neutral.blackSoft,
    textAlign: 'center',
  },
  editInputHalf: {
    flex: 1,
  },
  feetInchRow: {
    flexDirection: 'row',
    gap: 4,
  },

  // Unit toggle
  unitRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.neutral.white,
    borderRadius: 8,
    padding: 2,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: colors.primary[600],
  },
  unitText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
  },
  unitTextActive: {
    color: colors.neutral.white,
    fontFamily: fontFamily.primaryMedium,
  },

  // Chip grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.neutral.offWhite,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  chipText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  chipTextActive: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.neutral.white,
  },

  // Actions
  actionsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 16,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.neutral.gray100,
    marginLeft: 36, // align with text after icon
  },
  actionChevron: {
    marginLeft: 'auto',
  },
  signOutText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
  deleteText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.semantic.error,
  },
});
