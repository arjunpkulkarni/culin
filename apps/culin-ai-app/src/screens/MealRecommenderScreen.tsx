import { useAuth } from '@/src/contexts/AuthContext';
import { CalorieRing } from '@/src/components/CalorieRing';
import { MacroProgressBar } from '@/src/components/MacroProgressBar';
import { MealIdeaModal, type MealIdeaSubmit } from '@/src/components/MealIdeaModal';
import { PrimaryActionBar, type PrimaryAction } from '@/src/components/PrimaryActionBar';
import { ProfileButton } from '@/src/components/ProfileButton';
import { QuickLogModal } from '@/src/components/QuickLogModal';
import { StatusLine } from '@/src/components/StatusLine';
import { Suggestion, SuggestionCard } from '@/src/components/SuggestionCard';
import { colors, fontFamily, radius, shadows } from '@/src/design/tokens';
import { isNutritionApiConfigured } from '@/src/config/api';
import { createCulinAIApi } from '@/src/services/culinaiApi';
import { formatDateForLog, getDefaultMealType } from '@/src/services/fatSecretApi';
import {
  computeDailyTotals,
  deleteMeal,
  getMealsByDate,
  saveMeal,
  type DailyTotals,
  type MealEntry,
} from '@/src/services/mealStore';
import {
  estimateFromText,
  formatMacrosForLogConfirmation,
  isZeroEstimate,
  logQuickMealLogFailure,
  userMessageForError,
} from '@/src/services/nutritionApi';
import { deleteRecipe, getSavedRecipes, SavedRecipe } from '@/src/services/recipeStore';
import { formatDayAndTime, formatMealTime, getGreeting } from '@/src/utils/dateUtils';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  bmr?: number;
  tdee?: number;
  weightKg?: number;
}

export default function MealRecommenderScreen() {
  const router = useRouter();
  const { userData, idToken, getUserId } = useAuth();
  const uid = getUserId();
  const userName = userData?.displayName?.split(' ')[0] || 'User';
  const greeting = getGreeting();

  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    mealCount: 0,
  });
  const [todaysMeals, setTodaysMeals] = useState<MealEntry[]>([]);

  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [ideaPrefill, setIdeaPrefill] = useState('');
  const [ideaFilters, setIdeaFilters] = useState<string[]>(['high-protein']);

  // Initial load
  useEffect(() => {
    fetchNutritionGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, userData]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (uid) {
        fetchSavedRecipes();
        fetchDailyTotals();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid])
  );

  const fetchSavedRecipes = async () => {
    if (!uid) return;
    try {
      const recipes = await getSavedRecipes(uid, 20);
      setSavedRecipes(recipes);
    } catch (e) {
      console.error('Failed to load saved recipes:', e);
    }
  };

  const fetchDailyTotals = async () => {
    if (!uid) return;
    try {
      const todayISO = formatDateForLog();
      const meals = await getMealsByDate(uid, todayISO);
      setTodaysMeals(meals);
      setDailyTotals(computeDailyTotals(meals));
    } catch (e) {
      console.error('Failed to load daily totals:', e);
      setDailyTotals({ calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
      setTodaysMeals([]);
    }
  };

  const fetchNutritionGoals = async () => {
    if (!userData) return;
    try {
      setLoadingGoals(true);

      if (idToken) {
        try {
          const api = createCulinAIApi(idToken);
          const height = userData.height || 178;
          const weight = userData.weight || 165;
          const age = userData.age || 22;
          const sex = userData.sex === 'M' || userData.sex === 'F' ? userData.sex : 'unknown';

          let goal: 'cut' | 'maintain' | 'bulk' = 'maintain';
          if (userData.goals?.includes('lose_fat')) goal = 'cut';
          if (userData.goals?.includes('gain_muscle')) goal = 'bulk';

          const response = await api.getNutritionGoals({
            goal,
            height,
            weight,
            age,
            sex,
            heightUnit: 'cm',
            weightUnit: 'lb',
            activityLevel: 'moderate',
            goalPace: 'normal',
          });
          if (response.success) {
            setNutritionGoals(response.goals);
            return;
          }
        } catch {
          // fall through to defaults
        }
      }

      let calories = 2400;
      let protein = 180;
      let carbs = 240;
      let fat = 80;
      if (userData.goals?.includes('lose_fat')) {
        calories = 2000;
        protein = 180;
        carbs = 150;
        fat = 65;
      } else if (userData.goals?.includes('gain_muscle')) {
        calories = 2800;
        protein = 200;
        carbs = 320;
        fat = 90;
      }
      setNutritionGoals({ calories, protein, carbs, fat });
    } catch (e) {
      console.error('Failed to load nutrition goals:', e);
    } finally {
      setLoadingGoals(false);
    }
  };

  // ----- Actions -----

  const handleQuickLogSubmit = async (description: string) => {
    if (!uid) return;
    const descriptionSnippet = description.trim().slice(0, 120);
    const logCtx = { uid, descriptionSnippet };

    try {
      let cal = 0;
      let prot = 0;
      let carb = 0;
      let fatG = 0;
      let estimateFailed = false;
      /** Shown after save when macros are missing (HTTP/network vs vague text). */
      let estimateFailureDetail: string | null = null;

      if (isNutritionApiConfigured()) {
        try {
          const result = await estimateFromText(description);
          // Server already runs plausibility + final LLM polish; if we get a non-zero 200, use it.
          if (result?.macros && !isZeroEstimate(result.macros)) {
            cal = result.macros.calories ?? 0;
            prot = result.macros.protein ?? 0;
            carb = result.macros.carbs ?? 0;
            fatG = result.macros.fat ?? 0;
          } else {
            estimateFailed = true;
            estimateFailureDetail =
              'Could not infer calories from that description. Try naming ingredients (for example: "grilled chicken, rice, and broccoli").';
          }
        } catch (err) {
          logQuickMealLogFailure(err, { ...logCtx, phase: 'estimate' });
          estimateFailed = true;
          estimateFailureDetail = userMessageForError(err);
        }
      }

      const todayISO = formatDateForLog();
      const macrosSaved = {
        calories: cal,
        protein: prot,
        carbs: carb,
        fat: fatG,
      };

      try {
        await saveMeal(uid, {
          foodName: description,
          ...macrosSaved,
          mealType: getDefaultMealType(),
          date: todayISO,
        });
      } catch (err) {
        logQuickMealLogFailure(err, { ...logCtx, phase: 'save_meal' });
        throw err;
      }

      try {
        await fetchDailyTotals();
      } catch (err) {
        logQuickMealLogFailure(err, { ...logCtx, phase: 'refresh_totals' });
        throw err;
      }

      const usedNutritionEstimate =
        isNutritionApiConfigured() &&
        !estimateFailed &&
        (cal > 0 || prot > 0 || carb > 0 || fatG > 0);

      if (usedNutritionEstimate) {
        const macroLine = formatMacrosForLogConfirmation(macrosSaved);
        console.log('[CulinAI][MealLogged]', macroLine);
        Alert.alert('Meal logged', macroLine);
      } else if (estimateFailed) {
        Alert.alert(
          'Meal logged',
          `Saved without macro totals.\n\n${estimateFailureDetail ?? 'Nutrition estimate was not available.'}`,
        );
      }

      setQuickLogOpen(false);
    } catch (err: any) {
      Alert.alert('Failed to log meal', userMessageForError(err));
    }
  };

  const handleRemoveMeal = async (mealId: string | undefined) => {
    if (!uid || !mealId) return;
    try {
      await deleteMeal(uid, mealId);
      await fetchDailyTotals();
    } catch (e) {
      console.error('Failed to remove meal:', e);
    }
  };

  const openMealIdea = (prefill = '', filters: string[] = ['high-protein']) => {
    setIdeaPrefill(prefill);
    setIdeaFilters(filters);
    setIdeaModalOpen(true);
  };

  const handleMealIdeaSubmit = (params: MealIdeaSubmit) => {
    const trimmed = params.prompt.trim();
    if (!trimmed) return;
    setIdeaModalOpen(false);
    router.push({
      pathname: '/meal-results' as any,
      params: {
        mode: 'cook',
        prompt: trimmed,
        filters: JSON.stringify(params.filters),
        complexity: params.complexity.toString(),
      },
    });
  };

  const resolveEatNextRecipe = useCallback(
    (s: Suggestion) =>
      (s.storedRecipeId ? savedRecipes.find((r) => r.id === s.storedRecipeId) : undefined) ||
      savedRecipes.find((r) => r.id === s.id) ||
      savedRecipes.find((r) => r.name === s.name),
    [savedRecipes],
  );

  const handleSuggestionLog = async (s: Suggestion) => {
    if (!uid) return;
    const recipe = resolveEatNextRecipe(s);
    if (!recipe) return;
    try {
      const todayISO = formatDateForLog();
      let calories = recipe.calories;
      let protein = recipe.protein;
      let carbs = recipe.carbs;
      let fat = recipe.fat;

      // Re-run nutrition engine every time — saved recipe macros may be stale (e.g. old 0-protein estimates).
      if (isNutritionApiConfigured()) {
        try {
          const blob = [
            recipe.name,
            recipe.ingredients?.length
              ? `Ingredients:\n${recipe.ingredients.slice(0, 20).join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 12000);
          const result = await estimateFromText(blob);
          if (result?.macros && !isZeroEstimate(result.macros)) {
            calories = result.macros.calories ?? calories;
            protein = result.macros.protein ?? protein;
            carbs = result.macros.carbs ?? carbs;
            fat = result.macros.fat ?? fat;
          }
        } catch (e) {
          console.warn('[CulinAI] Eat-next re-estimate failed; using saved recipe macros', e);
        }
      }

      await saveMeal(uid, {
        foodName: recipe.name,
        calories,
        protein,
        carbs,
        fat,
        mealType: getDefaultMealType(),
        date: todayISO,
      });
      await fetchDailyTotals();
    } catch (e) {
      console.error('Failed to log suggestion:', e);
    }
  };

  const handleEatNextRemove = async (s: Suggestion) => {
    if (!uid) return;
    const recipe = resolveEatNextRecipe(s);
    if (!recipe?.id) {
      Alert.alert('Cannot remove', 'This recipe is missing an id. Try again after refreshing.');
      return;
    }
    try {
      await deleteRecipe(uid, recipe.id);
      await fetchSavedRecipes();
    } catch (e) {
      console.error('Failed to delete saved recipe:', e);
      Alert.alert('Remove failed', 'Could not remove this recipe. Please try again.');
    }
  };

  const handleSuggestionCook = (s: Suggestion) => {
    const recipe = resolveEatNextRecipe(s);
    if (!recipe) return;
    router.push({
      pathname: '/meal-results' as any,
      params: {
        mode: recipe.mode,
        prompt: recipe.prompt,
        filters: JSON.stringify([]),
        complexity: recipe.complexity.toString(),
        savedRecipe: JSON.stringify(recipe),
      },
    });
  };

  // ----- Derived data -----

  /**
   * Pick up to 4 saved recipes that best fit the remaining-macro gap for today.
   * Scoring: penalize recipes whose protein gives <30% of remaining-protein gap;
   * prefer ones whose calorie cost stays under remaining-calories.
   */
  const eatNextSuggestions: Suggestion[] = useMemo(() => {
    if (!nutritionGoals || savedRecipes.length === 0) return [];
    const proteinLeft = Math.max(0, nutritionGoals.protein - dailyTotals.protein);
    const calLeft = Math.max(0, nutritionGoals.calories - dailyTotals.calories);

    const scored = savedRecipes.map((r) => {
      // closer to fitting remaining cals = better; over-cap = penalty
      const calFit = calLeft > 0 ? Math.min(r.calories / calLeft, 1) : 0.5;
      const proteinFit = proteinLeft > 0 ? Math.min(r.protein / proteinLeft, 1) : 0.5;
      const score = proteinFit * 0.6 + calFit * 0.4;
      return { recipe: r, score };
    });
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 4).map(({ recipe }) => ({
      id: recipe.id ?? recipe.name,
      storedRecipeId: recipe.id,
      name: recipe.name,
      protein: Math.round(recipe.protein),
      calories: Math.round(recipe.calories),
      prepTime: recipe.prepTime,
      badge:
        recipe.protein >= 40
          ? 'HIGH PROTEIN'
          : recipe.calories <= 350
            ? 'LOW CAL'
            : (recipe.prepTime ?? 30) <= 15
              ? 'QUICK'
              : 'BALANCED',
    }));
  }, [savedRecipes, nutritionGoals, dailyTotals]);

  const eatNextSubtitle = useMemo(() => {
    if (!nutritionGoals) return '';
    const proteinLeft = Math.max(0, Math.round(nutritionGoals.protein - dailyTotals.protein));
    if (proteinLeft > 30) {
      return `Picked for the ${proteinLeft}g protein you have left`;
    }
    const calLeft = Math.max(0, Math.round(nutritionGoals.calories - dailyTotals.calories));
    if (calLeft > 0) {
      return `Picked for ${calLeft} cal remaining today`;
    }
    return `Saved ideas for next time`;
  }, [nutritionGoals, dailyTotals]);

  // ----- Primary action bar (contextual) -----

  const primaryAction: PrimaryAction = {
    label: 'Log a meal',
    icon: 'add',
    onPress: () => setQuickLogOpen(true),
  };

  const secondaryAction: PrimaryAction = useMemo(() => {
    if (!nutritionGoals) {
      return { label: 'Eat next', icon: 'restaurant', onPress: () => openMealIdea() };
    }
    const proteinLeft = Math.max(0, Math.round(nutritionGoals.protein - dailyTotals.protein));
    if (proteinLeft >= 30 && dailyTotals.mealCount > 0) {
      return {
        label: `Find ${proteinLeft}g protein`,
        icon: 'fitness-center',
        onPress: () => openMealIdea(`high protein, around ${proteinLeft}g`, ['high-protein']),
      };
    }
    return { label: 'Eat next', icon: 'restaurant', onPress: () => openMealIdea() };
  }, [nutritionGoals, dailyTotals]);

  // ----- Render -----

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FBFFFA', '#F2FBEE', '#E5F6E0']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Soft radial bloom near the top for cinematic depth */}
      <View pointerEvents="none" style={styles.bloomTop} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.dayTime}>{formatDayAndTime()}</Text>
              <Text style={styles.greeting}>
                {greeting}, {userName}
              </Text>
            </View>
            <ProfileButton
              name={userName}
              avatarUrl={userData?.photoURL}
              onPress={() => router.push('/(tabs)/profile' as any)}
            />
          </View>
          <StatusLine goals={nutritionGoals} totals={dailyTotals} />
        </Animated.View>

        {/* Daily Goals Card */}
        {nutritionGoals && (
          <Animated.View
            entering={FadeInDown.duration(220).delay(40)}
            style={styles.goalsCard}
          >
            <View style={styles.goalsTopRow}>
              <CalorieRing
                consumed={dailyTotals.calories}
                goal={nutritionGoals.calories}
                size={92}
              />
              <View style={styles.goalsRight}>
                <View style={styles.goalsTitleRow}>
                  <Text style={styles.goalsTitle}>Daily goals</Text>
                  <Text
                    style={[
                      styles.goalsTotal,
                      dailyTotals.calories > nutritionGoals.calories && styles.goalsTotalOver,
                    ]}
                  >
                    {Math.round(dailyTotals.calories)} / {Math.round(nutritionGoals.calories)} cal
                  </Text>
                </View>
                <MacroProgressBar
                  label="Protein"
                  consumed={dailyTotals.protein}
                  goal={nutritionGoals.protein}
                  color={colors.primary[600]}
                />
                <MacroProgressBar
                  label="Carbs"
                  consumed={dailyTotals.carbs}
                  goal={nutritionGoals.carbs}
                  color={colors.accent.teal}
                />
                <MacroProgressBar
                  label="Fat"
                  consumed={dailyTotals.fat}
                  goal={nutritionGoals.fat}
                  color={colors.semantic.warning}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {loadingGoals && !nutritionGoals && (
          <View style={styles.loadingGoals}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading your nutrition goals…</Text>
          </View>
        )}

        {/* Today's Meals */}
        {todaysMeals.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(220).delay(100)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today</Text>
              <Text style={styles.sectionMeta}>
                {todaysMeals.length} {todaysMeals.length === 1 ? 'meal' : 'meals'} ·{' '}
                {Math.round(dailyTotals.calories)} cal
              </Text>
            </View>
            <View style={styles.mealsList}>
              {todaysMeals.map((meal) => {
                const matchingRecipe = savedRecipes.find((r) => r.name === meal.foodName);
                return (
                  <Pressable
                    key={meal.id}
                    style={styles.mealRow}
                    onPress={() => {
                      if (matchingRecipe) {
                        router.push({
                          pathname: '/meal-results' as any,
                          params: {
                            mode: matchingRecipe.mode,
                            prompt: matchingRecipe.prompt,
                            filters: JSON.stringify([]),
                            complexity: matchingRecipe.complexity.toString(),
                            savedRecipe: JSON.stringify(matchingRecipe),
                          },
                        });
                      }
                    }}
                  >
                    <View style={styles.mealAvatar}>
                      <MaterialIcons
                        name={mealIconFor(meal.mealType)}
                        size={18}
                        color={colors.primary[700]}
                      />
                    </View>
                    <View style={styles.mealCenter}>
                      <Text style={styles.mealName} numberOfLines={1}>
                        {meal.foodName}
                      </Text>
                      <Text style={styles.mealStats}>
                        {Math.round(meal.protein)}g protein · {Math.round(meal.calories)} cal
                        {meal.createdAt ? ` · ${formatMealTime(meal.createdAt)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.removeBtn}
                      hitSlop={10}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveMeal(meal.id);
                      }}
                    >
                      <MaterialIcons name="close" size={16} color={colors.neutral.gray600} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Eat Next */}
        {eatNextSuggestions.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(220).delay(130)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Eat next</Text>              
            </View>
            <Text style={styles.sectionSubtitle}>{eatNextSubtitle}</Text>
            <View style={styles.suggestionsGrid}>
              {eatNextSuggestions.map((s) => (
                <View style={styles.suggestionCol} key={s.id}>
                  <SuggestionCard
                    suggestion={s}
                    onLog={handleSuggestionLog}
                    onCook={handleSuggestionCook}
                    onRemove={handleEatNextRemove}
                  />
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Empty state when no meals + no recipes */}
        {todaysMeals.length === 0 && savedRecipes.length === 0 && (
          <Animated.View
            entering={FadeInDown.duration(220).delay(120)}
            style={styles.emptyCard}
          >
            <MaterialIcons name="restaurant-menu" size={36} color={colors.neutral.gray300} />
            <Text style={styles.emptyTitle}>Start your day</Text>
            <Text style={styles.emptySubtitle}>
              Log your first meal or get an AI-picked idea tailored to your goals.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Contextual sticky action bar */}
      <PrimaryActionBar primary={primaryAction} secondary={secondaryAction} />

      {/* Modals */}
      <QuickLogModal
        visible={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        onSubmit={handleQuickLogSubmit}
      />
      <MealIdeaModal
        visible={ideaModalOpen}
        onClose={() => setIdeaModalOpen(false)}
        onSubmit={handleMealIdeaSubmit}
        initialPrompt={ideaPrefill}
        initialFilters={ideaFilters}
      />
    </View>
  );
}

function mealIconFor(mealType: MealEntry['mealType']): keyof typeof MaterialIcons.glyphMap {
  switch (mealType) {
    case 'Breakfast':
      return 'free-breakfast';
    case 'Lunch':
      return 'lunch-dining';
    case 'Dinner':
      return 'dinner-dining';
    case 'Snack':
      return 'cookie';
    default:
      return 'restaurant';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bloomTop: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(207, 247, 214, 0.55)',
    opacity: 0.9,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 96,
    paddingBottom: 160,
  },
  header: {
    marginBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    paddingTop: 2,
  },
  dayTime: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  greeting: {
    fontFamily: fontFamily.primaryLight,
    fontSize: 26,
    fontWeight: '300',
    color: colors.neutral.blackSoft,
    letterSpacing: -0.5,
  },
  goalsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.cardLarge,
    paddingHorizontal: 16,
    paddingVertical: 22,
    marginBottom: 28,
    ...shadows.hero,
  },
  goalsTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  goalsRight: {
    flex: 1,
  },
  goalsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  goalsTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.1,
  },
  goalsTotal: {
    fontFamily: fontFamily.primary,
    fontSize: 10,
    color: colors.neutral.gray300,
    letterSpacing: 0.2,
  },
  goalsTotalOver: {
    color: colors.semantic.warning,
    fontFamily: fontFamily.primaryMedium,
  },
  loadingGoals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
    marginBottom: 24,
  },
  loadingText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 19,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray300,
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    marginBottom: 16,
  },
  sectionLink: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 13,
    color: colors.primary[700],
  },
  mealsList: {
    gap: 8,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    ...shadows.soft,
  },
  mealAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCenter: {
    flex: 1,
  },
  mealName: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  mealStats: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
    letterSpacing: 0.1,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.offWhite,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  suggestionCol: {
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.cardLarge,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    ...shadows.card,
  },
  emptyTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 18,
    color: colors.neutral.blackSoft,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
});
