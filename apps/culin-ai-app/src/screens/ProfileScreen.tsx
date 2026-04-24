import Logo from "@/src/components/Logo";
import { useAuth } from "@/src/contexts/AuthContext";
import { getMemberSinceYear, calculateAge } from "@/src/utils/dateUtils";
import {
  cmToFeetInches,
  feetInchesToCm,
  formatFeetInches,
  kgToPounds,
  poundsToKg,
} from "@/src/utils/unitConverters";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { updateProfile } from "firebase/auth";
import {
  getMealsByDate,
  computeDailyTotals,
  DEFAULT_TARGETS,
  type DailyTotals,
} from "@/src/services/mealStore";
import { formatDateForLog } from "@/src/services/fatSecretApi";

const GOALS = [
  'Boost Energy',
  'Lose Weight',
  'Gain Muscle',
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
  'Other',
];

export default function ProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { userData, currentUser, logout, updateUserData, deleteAccount, getUserEmail, getUserId } = useAuth();
  const userName = userData?.displayName || "User";
  const userEmail = getUserEmail() || userData?.email || "";
  const memberSince = getMemberSinceYear(userData?.createdAt);
  
  const [isEditing, setIsEditing] = useState(false);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [editHeightCm, setEditHeightCm] = useState(userData?.height?.toString() || "");
  const [editHeightFeet, setEditHeightFeet] = useState("");
  const [editHeightInches, setEditHeightInches] = useState("");
  const [editWeightKg, setEditWeightKg] = useState(userData?.weight?.toString() || "");
  const [editWeightLbs, setEditWeightLbs] = useState("");
  const [editProfilePhoto, setEditProfilePhoto] = useState<string | null>(null);
  const [editGoals, setEditGoals] = useState<string[]>([]);
  const [editHealthConditions, setEditHealthConditions] = useState<string[]>([]);

  // Update edit values when userData changes
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
    if (userData?.goals) {
      setEditGoals([...userData.goals]);
    }
    if (userData?.healthConditions) {
      setEditHealthConditions([...userData.healthConditions]);
    }
  }, [userData?.height, userData?.weight, userData?.goals, userData?.healthConditions]);

  const [totals, setTotals] = useState<DailyTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
  const targets = DEFAULT_TARGETS;

  const loadTodayTotals = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    try {
      const entries = await getMealsByDate(uid, formatDateForLog());
      setTotals(computeDailyTotals(entries));
    } catch (e) {
      console.error("Failed to load daily totals:", e);
    }
  }, [getUserId]);

  useEffect(() => {
    loadTodayTotals();
  }, [loadTodayTotals]);

  const age = userData?.dateOfBirth ? calculateAge(userData.dateOfBirth) : null;

  const stats = [
    { label: "Age", value: age?.toString() || "N/A" },
    { label: "Weight", value: userData?.weight?.toString() || "N/A", unit: "kg", editable: true },
    { label: "Height", value: userData?.height?.toString() || "N/A", unit: "cm", editable: true },
    { label: "Sex", value: userData?.sex || "N/A" },
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setEditProfilePhoto(result.assets[0].uri);
    }
  };

  const toggleGoal = (goal: string) => {
    setEditGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleHealthCondition = (condition: string) => {
    setEditHealthConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  };

  const handleSaveEdit = async () => {
    // Convert to standard units (cm and kg) for storage
    let heightInCm: number;
    let weightInKg: number;

    if (heightUnit === 'cm') {
      if (!editHeightCm || isNaN(Number(editHeightCm)) || Number(editHeightCm) < 50 || Number(editHeightCm) > 250) {
        Alert.alert('Invalid Height', 'Please enter a valid height (50-250 cm)');
        return;
      }
      heightInCm = Number(editHeightCm);
    } else {
      const feet = Number(editHeightFeet);
      const inches = Number(editHeightInches);
      if (!editHeightFeet || !editHeightInches || isNaN(feet) || isNaN(inches) || feet < 2 || feet > 8 || inches < 0 || inches >= 12) {
        Alert.alert('Invalid Height', 'Please enter a valid height (feet: 2-8, inches: 0-11)');
        return;
      }
      heightInCm = feetInchesToCm(feet, inches);
    }

    if (weightUnit === 'kg') {
      if (!editWeightKg || isNaN(Number(editWeightKg)) || Number(editWeightKg) < 20 || Number(editWeightKg) > 300) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight (20-300 kg)');
        return;
      }
      weightInKg = Number(editWeightKg);
    } else {
      if (!editWeightLbs || isNaN(Number(editWeightLbs)) || Number(editWeightLbs) < 44 || Number(editWeightLbs) > 660) {
        Alert.alert('Invalid Weight', 'Please enter a valid weight (44-660 lbs)');
        return;
      }
      weightInKg = poundsToKg(Number(editWeightLbs));
    }

    // Validate goals
    if (editGoals.length === 0) {
      Alert.alert('Required', 'Please select at least one goal');
      return;
    }

    try {
      // Prepare update data
      // Health conditions are optional - can be empty array
      const updateData: any = {
        height: heightInCm,
        weight: weightInKg,
        goals: editGoals,
        healthConditions: editHealthConditions, // Always include, even if empty array
      };

      // Update profile photo if changed
      if (editProfilePhoto && currentUser) {
        // For Cognito, we store the photo URL in userData (AsyncStorage)
        // In production, you'd upload to S3 and get the URL
        updateData.photoURL = editProfilePhoto;
      }

      await updateUserData(updateData);
      setIsEditing(false);
      setEditProfilePhoto(null);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const macros = [
    {
      label: "Protein",
      value: `${Math.round(totals.protein)}g`,
      target: `${targets.protein}g`,
      progress: Math.min(100, Math.round((totals.protein / targets.protein) * 100)),
      color: "#137fec",
    },
    {
      label: "Carbs",
      value: `${Math.round(totals.carbs)}g`,
      target: `${targets.carbs}g`,
      progress: Math.min(100, Math.round((totals.carbs / targets.carbs) * 100)),
      color: "#10b981",
    },
    {
      label: "Fats",
      value: `${Math.round(totals.fat)}g`,
      target: `${targets.fat}g`,
      progress: Math.min(100, Math.round((totals.fat / targets.fat) * 100)),
      color: "#f59e0b",
    },
  ];

  const dietTypes = ["Flexitarian", "Vegetarian", "Keto", "Paleo"];
  const allergies = userData?.healthConditions || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size={28} style={styles.logo} />
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="#111418" />
          </Pressable>
        </View>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: editProfilePhoto || userData?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuBFwwonrSGgRj-4AKHeMm3x9BsF381dB0Zll1tChBXR_od-MOlk4SHXhs3sQLX2wwOSiafp60emO9G2jmFcd5m2eH_ZL0MJNS1BmEIA01XG8OZ2CG-UqDw-m9bfHEhGFEGPsfkQaWnkY1ZwcLAtQyMX1TDCUQfLuqoViDhUbq095SOc1USTwaj_bC58bta6j8WBXWRM3VOXOVFep-2J-nAF3ht-qG7ofXyFGIV0mlFY7s5Bm1QAn0GQP4qoMNb5vlRLO_PiykIZSQIJ",
              }}
              style={styles.avatar}
            />
            <Pressable 
              style={styles.editAvatarButton}
              onPress={pickImage}
            >
              <MaterialIcons name="edit" size={18} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.name}>{userName}</Text>
          {!isEditing && userData?.goals && userData.goals.length > 0 && (
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>
                Goals: {userData.goals.join(', ')}
              </Text>
            </View>
          )}
          {isEditing && (
            <View style={styles.goalsEditContainer}>
              <Text style={styles.editLabel}>Goals</Text>
              <View style={styles.goalsEditGrid}>
                {GOALS.map((goal) => (
                  <Pressable
                    key={goal}
                    style={[
                      styles.goalEditButton,
                      editGoals.includes(goal) && styles.goalEditButtonActive,
                    ]}
                    onPress={() => toggleGoal(goal)}
                  >
                    <Text
                      style={[
                        styles.goalEditButtonText,
                        editGoals.includes(goal) && styles.goalEditButtonTextActive,
                      ]}
                    >
                      {goal}
                    </Text>
                    {editGoals.includes(goal) && (
                      <MaterialIcons name="check" size={18} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Basic Info</Text>
            <Pressable
              onPress={() => {
                if (isEditing) {
                  handleSaveEdit();
                } else {
                  setIsEditing(true);
                  // Initialize edit values
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
                  if (userData?.goals) {
                    setEditGoals([...userData.goals]);
                  } else {
                    setEditGoals([]);
                  }
                  if (userData?.healthConditions) {
                    setEditHealthConditions([...userData.healthConditions]);
                  } else {
                    setEditHealthConditions([]);
                  }
                  setEditProfilePhoto(null);
                }
              }}
              style={styles.editButton}
            >
              <MaterialIcons
                name={isEditing ? "check" : "edit"}
                size={20}
                color={isEditing ? "#10b981" : "#137fec"}
              />
            </Pressable>
          </View>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => {
              if (isEditing && stat.editable) {
                // Show editable fields for height and weight with unit toggles
                if (stat.label === "Height") {
                  return (
                    <View key={index} style={[styles.statCard, { gap: 8 }]}>
                      <View style={styles.unitToggleContainer}>
                        <Pressable
                          style={[styles.unitToggle, heightUnit === 'cm' && styles.unitToggleActive]}
                          onPress={() => setHeightUnit('cm')}
                        >
                          <Text style={[styles.unitToggleText, heightUnit === 'cm' && styles.unitToggleTextActive]}>
                            cm
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.unitToggle, heightUnit === 'ft' && styles.unitToggleActive]}
                          onPress={() => setHeightUnit('ft')}
                        >
                          <Text style={[styles.unitToggleText, heightUnit === 'ft' && styles.unitToggleTextActive]}>
                            ft/in
                          </Text>
                        </Pressable>
                      </View>
                      {heightUnit === 'cm' ? (
                        <TextInput
                          style={styles.statInput}
                          value={editHeightCm}
                          onChangeText={setEditHeightCm}
                          keyboardType="number-pad"
                          placeholder="Height (cm)"
                        />
                      ) : (
                        <View style={styles.feetInchesEditContainer}>
                          <TextInput
                            style={[styles.statInput, { flex: 1 }]}
                            value={editHeightFeet}
                            onChangeText={setEditHeightFeet}
                            keyboardType="number-pad"
                            placeholder="Feet"
                          />
                          <TextInput
                            style={[styles.statInput, { flex: 1 }]}
                            value={editHeightInches}
                            onChangeText={setEditHeightInches}
                            keyboardType="number-pad"
                            placeholder="Inches"
                          />
                        </View>
                      )}
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  );
                }
                if (stat.label === "Weight") {
                  return (
                    <View key={index} style={[styles.statCard, { gap: 8 }]}>
                      <View style={styles.unitToggleContainer}>
                        <Pressable
                          style={[styles.unitToggle, weightUnit === 'kg' && styles.unitToggleActive]}
                          onPress={() => setWeightUnit('kg')}
                        >
                          <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitToggleTextActive]}>
                            kg
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.unitToggle, weightUnit === 'lbs' && styles.unitToggleActive]}
                          onPress={() => setWeightUnit('lbs')}
                        >
                          <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitToggleTextActive]}>
                            lbs
                          </Text>
                        </Pressable>
                      </View>
                      <TextInput
                        style={styles.statInput}
                        value={weightUnit === 'kg' ? editWeightKg : editWeightLbs}
                        onChangeText={weightUnit === 'kg' ? setEditWeightKg : setEditWeightLbs}
                        keyboardType="number-pad"
                        placeholder={weightUnit === 'kg' ? 'Weight (kg)' : 'Weight (lbs)'}
                      />
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  );
                }
              }
              return (
                <View key={index} style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {stat.value}
                    {stat.unit && (
                      <Text style={styles.statUnit}> {stat.unit}</Text>
                    )}
                  </Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              );
            })}
          </View>
          {isEditing && (
            <Pressable
              onPress={() => {
                setIsEditing(false);
                setEditProfilePhoto(null);
                // Reset to original values
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
                if (userData?.goals) {
                  setEditGoals([...userData.goals]);
                } else {
                  setEditGoals([]);
                }
                if (userData?.healthConditions) {
                  setEditHealthConditions([...userData.healthConditions]);
                } else {
                  setEditHealthConditions([]);
                }
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>

        {/* Nutritional Goals */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Nutritional Goals</Text>
            <Pressable>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.calorieSection}>
            <View style={styles.calorieRow}>
              <Text style={styles.calorieLabel}>Daily Calorie Target</Text>
              <Text style={styles.calorieValue}>
                {totals.calories.toLocaleString()} / {targets.calories.toLocaleString()} kcal
              </Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground} />
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((totals.calories / targets.calories) * 100))}%` }]} />
              <View style={[styles.progressThumb, { left: `${Math.min(100, Math.round((totals.calories / targets.calories) * 100))}%` }]} />
            </View>
          </View>
          <View style={styles.macrosSection}>
            {macros.map((macro, index) => (
              <View key={index} style={styles.macroRow}>
                <View style={styles.macroHeader}>
                  <Text style={styles.macroLabel}>{macro.label}</Text>
                  <Text style={styles.macroValue}>
                    {macro.value} / {macro.target}
                  </Text>
                </View>
                <View style={styles.macroProgressBg}>
                  <View
                    style={[
                      styles.macroProgressFill,
                      { width: `${macro.progress}%`, backgroundColor: macro.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Preferences & Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences & Health</Text>
          <View style={styles.card}>
            {/* Diet Type */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.preferenceLabel}>DIET TYPE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dietTypeContainer}
              >
                {dietTypes.map((diet, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.dietTypeButton,
                      index === 0 && styles.dietTypeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dietTypeText,
                        index === 0 && styles.dietTypeTextActive,
                      ]}
                    >
                      {diet}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Allergies & Health Conditions */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.preferenceLabel}>ALLERGIES & CONDITIONS</Text>
              {isEditing ? (
                <View style={styles.conditionsEditContainer}>
                  {HEALTH_CONDITIONS.map((condition) => (
                    <Pressable
                      key={condition}
                      style={[
                        styles.conditionEditButton,
                        editHealthConditions.includes(condition) && styles.conditionEditButtonActive,
                      ]}
                      onPress={() => toggleHealthCondition(condition)}
                    >
                      <Text
                        style={[
                          styles.conditionEditButtonText,
                          editHealthConditions.includes(condition) && styles.conditionEditButtonTextActive,
                        ]}
                      >
                        {condition}
                      </Text>
                      {editHealthConditions.includes(condition) && (
                        <MaterialIcons name="check" size={18} color="#137fec" />
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.allergiesContainer}>
                  {allergies.length > 0 ? (
                    allergies.map((condition, index) => (
                      <View key={index} style={styles.allergyTag}>
                        <MaterialIcons name="warning" size={20} color="#ef4444" />
                        <Text style={styles.allergyText}>{condition}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noConditionsText}>No health conditions selected</Text>
                  )}
                </View>
              )}
            </View>

            {/* Health Conditions Detail */}
            {!isEditing && allergies.length > 0 && (
              <View style={styles.preferenceGroup}>
                <Text style={styles.preferenceLabel}>HEALTH CONDITIONS</Text>
                {allergies.map((condition, index) => (
                  <View key={index} style={styles.healthCondition}>
                    <View style={styles.checkboxContainer}>
                      <View style={styles.checkbox} />
                      <MaterialIcons
                        name="check"
                        size={16}
                        color="#fff"
                        style={styles.checkboxIcon}
                      />
                    </View>
                    <View style={styles.healthConditionInfo}>
                      <Text style={styles.healthConditionTitle}>{condition}</Text>
                      <Text style={styles.healthConditionSubtitle}>
                        {condition === 'Type 2 Diabetes' && 'Modifies sugar intake recommendations'}
                        {condition === 'High Blood Pressure' && 'Adjusts sodium and potassium recommendations'}
                        {condition === 'Heart Disease' && 'Focuses on heart-healthy nutrition'}
                        {condition === 'PCOS' && 'Tailors recommendations for hormonal balance'}
                        {condition === 'IBS' && 'Considers digestive sensitivities'}
                        {condition === 'Celiac Disease' && 'Ensures gluten-free recommendations'}
                        {condition === 'Food Allergies' && 'Excludes allergenic ingredients'}
                        {!['Type 2 Diabetes', 'High Blood Pressure', 'Heart Disease', 'PCOS', 'IBS', 'Celiac Disease', 'Food Allergies'].includes(condition) && 'Customized nutrition recommendations'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Account & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account & Security</Text>
          <View style={styles.card}>
            <Pressable style={styles.accountItem}>
              <View style={styles.accountItemLeft}>
                <View style={styles.accountIcon}>
                  <MaterialIcons name="mail" size={20} color="#475569" />
                </View>
                <View style={styles.accountInfo}>
                  <View style={styles.accountInfoRow}>
                    <Text style={styles.accountLabel}>Email</Text>
                    <MaterialIcons name="verified" size={16} color="#10b981" />
                  </View>
                  <Text style={styles.accountValue}>{userEmail}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accountItem}>
              <View style={styles.accountItemLeft}>
                <View style={styles.accountIcon}>
                  <MaterialIcons name="lock" size={20} color="#475569" />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountLabel}>Password</Text>
                  <Text style={styles.accountValue}>Last changed 3 months ago</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.accountItem}>
              <View style={styles.accountItemLeft}>
                <View style={styles.accountIcon}>
                  <MaterialIcons name="link" size={20} color="#475569" />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountLabel}>Linked Accounts</Text>
                  <Text style={styles.accountValue}>Google, Apple Health</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Pressable style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </Pressable>
          <Pressable
            style={styles.signOutButton}
            onPress={async () => {
              await logout();
            }}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
          <Pressable
            style={styles.deleteAccountButton}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted from both Firestore and Firebase Authentication.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        console.log('Attempting to delete account...');
                        await deleteAccount();
                        console.log('Account deleted successfully');
                        // User will be automatically logged out and redirected to auth screen
                        // The AuthContext will handle the redirect via onAuthStateChanged
                      } catch (error: any) {
                        console.error('Delete account error:', error);
                        Alert.alert(
                          'Error',
                          error.message || 'Failed to delete account. Please try again or contact support.'
                        );
                      }
                    },
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
          </Pressable>
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7f8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
    backgroundColor: "#f6f7f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111418",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "#fff",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#137fec",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111418",
  },
  goalBadge: {
    backgroundColor: "rgba(19, 127, 236, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  goalBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#137fec",
  },
  goalsEditContainer: {
    width: "100%",
    marginTop: 12,
    marginBottom: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0d141b",
    marginBottom: 12,
  },
  goalsEditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  goalEditButtonActive: {
    backgroundColor: "#137fec",
    borderColor: "#137fec",
  },
  goalEditButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0d141b",
  },
  goalEditButtonTextActive: {
    color: "#fff",
  },
  memberSince: {
    fontSize: 14,
    color: "#64748b",
  },
  statsSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111418",
  },
  editButton: {
    padding: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111418",
  },
  statInput: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111418",
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#137fec",
    paddingVertical: 4,
    minWidth: 60,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  unitToggleContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  unitToggle: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  unitToggleActive: {
    backgroundColor: "#137fec",
    borderColor: "#137fec",
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  unitToggleTextActive: {
    color: "#fff",
  },
  feetInchesEditContainer: {
    flexDirection: "row",
    gap: 8,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: "400",
    color: "#94a3b8",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111418",
  },
  editLink: {
    fontSize: 14,
    fontWeight: "500",
    color: "#137fec",
  },
  calorieSection: {
    marginBottom: 24,
  },
  calorieRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calorieLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111418",
  },
  calorieValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#137fec",
  },
  progressContainer: {
    height: 24,
    position: "relative",
    justifyContent: "center",
  },
  progressBackground: {
    position: "absolute",
    width: "100%",
    height: 6,
    backgroundColor: "#cbd5e1",
    borderRadius: 999,
  },
  progressFill: {
    position: "absolute",
    height: 6,
    backgroundColor: "#137fec",
    borderRadius: 999,
  },
  progressThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#137fec",
    marginLeft: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  macrosSection: {
    gap: 16,
  },
  macroRow: {
    gap: 8,
  },
  macroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111418",
  },
  macroValue: {
    fontSize: 14,
    color: "#64748b",
  },
  macroProgressBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    overflow: "hidden",
  },
  macroProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111418",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  preferenceGroup: {
    gap: 8,
    marginBottom: 20,
  },
  preferenceLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dietTypeContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  dietTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dietTypeButtonActive: {
    backgroundColor: "#137fec",
    borderColor: "#137fec",
  },
  dietTypeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },
  dietTypeTextActive: {
    color: "#fff",
  },
  allergiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  allergyTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  allergyText: {
    fontSize: 14,
    color: "#111418",
  },
  addAllergyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
  },
  addAllergyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  noConditionsText: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
    marginTop: 8,
  },
  conditionsEditContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  conditionEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  conditionEditButtonActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#137fec",
  },
  conditionEditButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0d141b",
  },
  conditionEditButtonTextActive: {
    color: "#137fec",
  },
  healthCondition: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    marginTop: 8,
  },
  checkboxContainer: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#137fec",
    backgroundColor: "#137fec",
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  checkboxIcon: {
    position: "absolute",
  },
  healthConditionInfo: {
    flex: 1,
  },
  healthConditionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111418",
  },
  healthConditionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  accountItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  accountInfo: {
    flex: 1,
  },
  accountInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  accountLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111418",
  },
  accountValue: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  actionButtons: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: "#137fec",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#137fec",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  signOutButton: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ef4444",
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: "center",
  },
  deleteAccountButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  bottomSpacer: {
    height: 100,
  },
});

