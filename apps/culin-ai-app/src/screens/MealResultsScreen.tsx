import Logo from '@/src/components/Logo';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { createCulinAIApi } from '@/src/services/culinaiApi';
import { estimateFromText, isZeroEstimate, userMessageForError } from '@/src/services/nutritionApi';
import { getSavedRecipes, saveRecipe } from '@/src/services/recipeStore';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EnrichedMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime?: number;
  cost?: number;
  difficulty?: string;
  deliveryTime?: number;
  restaurant?: string;
  aiDescription?: string;
  instacartLink?: string;
  nutritionUnavailable?: boolean;
}

/** Expo Router passes many params as `string | string[]`; coerce before use. */
function paramToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

export default function MealResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { idToken, getUserId, loading: authLoading } = useAuth();
  const uid = getUserId();

  const modeParam = paramToString(params.mode);
  const mode: 'cook' | 'order' = modeParam === 'order' ? 'order' : 'cook';

  const routePromptRaw = paramToString(params.prompt);
  const effectivePrompt = useMemo(() => routePromptRaw.trim(), [routePromptRaw]);

  const filters = useMemo((): string[] => {
    try {
      const raw = params.filters;
      const s =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw) && typeof raw[0] === 'string'
            ? raw[0]
            : '';
      if (!s) return [];
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }, [params.filters]);

  const complexity = useMemo(() => {
    const raw = parseInt(paramToString(params.complexity) || '', 10);
    return Number.isFinite(raw) ? raw : 3;
  }, [params.complexity]);

  const savedRecipe = useMemo(() => {
    try {
      const raw = params.savedRecipe;
      const s =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw) && typeof raw[0] === 'string'
            ? raw[0]
            : '';
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, [params.savedRecipe]);

  const [loading, setLoading] = useState(!savedRecipe);
  const [meal, setMeal] = useState<EnrichedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseRecipeDescription = (description: string) => {
    const cleanText = (text: string) =>
      text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/###\s*/g, '')
        .replace(/####\s*/g, '')
        .replace(/^[-•]\s*/g, '')
        .trim();

    const ingredientsMatch = description.match(
      /(?:\*\*|####)\s*Ingredients[:\s]*(?:\*\*)?[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:\*\*|####)\s*Instructions|$)/i
    );
    const ingredients = ingredientsMatch
      ? ingredientsMatch[1]
          .trim()
          .split('\n')
          .filter((line) => {
            const trimmed = line.trim();
            return trimmed && (trimmed.startsWith('-') || /^\d+\./.test(trimmed));
          })
          .map((line) => cleanText(line))
      : [];

    const instructionsMatch = description.match(
      /(?:\*\*|####)\s*Instructions[:\s]*(?:\*\*)?[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:\*\*Note|\*\*Nutritional|###\s*Nutritional|###\s*Serving)|$)/i
    );
    let instructions: string[] = [];

    if (instructionsMatch) {
      const instructionText = instructionsMatch[1].trim();
      const numberedSteps = instructionText.split(/\n(?=\d+\.\s+)/);
      if (numberedSteps.length > 1) {
        instructions = numberedSteps
          .map((step) => {
            const cleaned = step.replace(/^\d+\.\s+/, '').trim();
            const lines = cleaned.split('\n').map((l) => l.trim()).filter((l) => l);
            return lines.join(' ');
          })
          .map((s) => cleanText(s))
          .filter((s) => s.length > 10);
      }
    }

    return { ingredients, instructions };
  };

  const loadSavedRecipe = useCallback(() => {
    if (!savedRecipe) return;
    try {
      const enrichedMeal: EnrichedMeal = {
        id: savedRecipe.id || Date.now().toString(),
        name: savedRecipe.name,
        calories: savedRecipe.calories,
        protein: savedRecipe.protein,
        carbs: savedRecipe.carbs,
        fat: savedRecipe.fat,
        aiDescription: savedRecipe.aiDescription,
        instacartLink: savedRecipe.instacartLink,
        ...(savedRecipe.mode === 'cook' && {
          prepTime: savedRecipe.prepTime || 15,
          cost: savedRecipe.cost || 5.0,
          difficulty: savedRecipe.difficulty || 'Medium',
        }),
        ...(savedRecipe.mode === 'order' && {
          deliveryTime: savedRecipe.deliveryTime || 25,
          cost: savedRecipe.cost || 12.0,
          restaurant: savedRecipe.restaurant || 'Restaurant',
        }),
      };
      setMeal(enrichedMeal);
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error('Failed to load saved recipe:', e);
      setError('Failed to load recipe');
      setLoading(false);
    }
  }, [savedRecipe]);

  const fetchRecommendations = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    if (!effectivePrompt) {
      setError('We could not load your meal idea. Go back and add what you’re in the mood for, then try again.');
      setLoading(false);
      return;
    }

    if (!idToken) {
      setError('Your session expired. Sign in again, then retry.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const api = createCulinAIApi(idToken);
      const modeContext = mode === 'cook' ? 'I want to cook a meal.' : 'I want to order food.';
      const filterContext = filters.length ? `Preferences: ${filters.join(', ')}.` : '';
      const fullQuery = `${modeContext} ${filterContext} ${effectivePrompt}`.trim();

      const response = await api.sendChatMessage(fullQuery, { complexity });
      const aiDescription = response.enhancedResponse || '';

      let mealName = effectivePrompt;
      const heading3Match = aiDescription.match(/###\s+(?:Enhanced\s+)?([^\n]+)/i);
      if (heading3Match) {
        mealName = heading3Match[1].trim();
      } else {
        const boldMatch = aiDescription.match(/\*\*([^*]+(?:Chicken|Recipe|Bowl|Salad|Meal|Grilled|Herb)[^*]*)\*\*/i);
        if (boldMatch) mealName = boldMatch[1].trim();
      }
      mealName = mealName
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/###\s*/g, '')
        .trim();

      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;

      const nutritionMatch1 = aiDescription.match(
        /###\s*Nutritional Information[\s\S]*?-\s*\*\*Protein\*\*:\s*Approximately\s*(\d+)\s*grams[\s\S]*?-\s*\*\*Fats\*\*:\s*Approximately\s*(\d+)\s*grams/i
      );
      const nutritionMatch2 = aiDescription.match(
        /\*\*Nutrition Information[^:]*:\*\*[\s\S]*?- Calories:\s*Approximately\s*(\d+)\s*kcal[\s\S]*?- Protein:\s*(\d+)g[\s\S]*?- Carbohydrates:\s*(\d+)g[\s\S]*?- Fat:\s*(\d+)g/i
      );

      if (nutritionMatch1) {
        protein = parseInt(nutritionMatch1[1]) || 0;
        fat = parseInt(nutritionMatch1[2]) || 0;
        calories = Math.round(protein * 4 + fat * 9);
        carbs = 2;
      } else if (nutritionMatch2) {
        calories = parseInt(nutritionMatch2[1]) || 0;
        protein = parseInt(nutritionMatch2[2]) || 0;
        carbs = parseInt(nutritionMatch2[3]) || 0;
        fat = parseInt(nutritionMatch2[4]) || 0;
      }

      let nutritionUnavailable = false;
      if (!nutritionMatch1 && !nutritionMatch2) {
        try {
          const result = await estimateFromText(`${mealName}. ${aiDescription}`);
          if (result?.macros && !isZeroEstimate(result.macros)) {
            calories = result.macros.calories ?? 0;
            protein = result.macros.protein ?? 0;
            carbs = result.macros.carbs ?? 0;
            fat = result.macros.fat ?? 0;
          } else {
            nutritionUnavailable = true;
          }
        } catch (err: any) {
          console.warn('Nutrition Engine error:', userMessageForError(err));
          nutritionUnavailable = true;
        }
      }

      const instacartLink = response.instacart?.products_link_url || null;

      const enrichedMeal: EnrichedMeal = {
        id: Date.now().toString(),
        name: mealName,
        calories,
        protein,
        carbs,
        fat,
        nutritionUnavailable,
        aiDescription,
        instacartLink,
        ...(mode === 'cook' && { prepTime: 15, cost: 5.0, difficulty: 'Medium' }),
        ...(mode === 'order' && { deliveryTime: 25, cost: 12.0, restaurant: 'Restaurant' }),
      };

      setMeal(enrichedMeal);

      if (uid) {
        try {
          const { ingredients, instructions } = parseRecipeDescription(aiDescription);
          const recipeData: any = {
            name: mealName,
            emoji: '',
            calories,
            protein,
            carbs,
            fat,
            mode,
            prompt: effectivePrompt,
            ingredients,
            instructions,
            aiDescription,
            complexity,
          };
          if (instacartLink) recipeData.instacartLink = instacartLink;
          if (enrichedMeal.restaurant) recipeData.restaurant = enrichedMeal.restaurant;
          if (enrichedMeal.prepTime) recipeData.prepTime = enrichedMeal.prepTime;
          if (enrichedMeal.cost) recipeData.cost = enrichedMeal.cost;
          if (enrichedMeal.difficulty) recipeData.difficulty = enrichedMeal.difficulty;
          if (enrichedMeal.deliveryTime) recipeData.deliveryTime = enrichedMeal.deliveryTime;
          await saveRecipe(uid, recipeData);
        } catch (saveError) {
          console.error('Failed to save recipe:', saveError);
        }
      }
    } catch (e: any) {
      console.error('Error fetching recommendations:', e);
      setError(e.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  }, [authLoading, complexity, effectivePrompt, filters, idToken, mode, uid]);

  useEffect(() => {
    if (savedRecipe) {
      loadSavedRecipe();
      return;
    }
    void fetchRecommendations();
  }, [savedRecipe, loadSavedRecipe, fetchRecommendations]);

  const parsed = useMemo(
    () => (meal ? parseRecipeDescription(meal.aiDescription || '') : { ingredients: [], instructions: [] }),
    [meal]
  );

  const tagChips = useMemo(() => {
    if (!meal) return [];
    const chips: { id: string; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [];
    if (meal.protein >= 30) chips.push({ id: 'hp', icon: 'fitness-center', label: 'High protein' });
    if (meal.carbs <= 20) chips.push({ id: 'lc', icon: 'eco', label: 'Low carb' });
    if (meal.prepTime !== undefined) chips.push({ id: 't', icon: 'schedule', label: `${meal.prepTime} min` });
    if (meal.deliveryTime !== undefined) chips.push({ id: 'd', icon: 'delivery-dining', label: `${meal.deliveryTime} min` });
    if (meal.difficulty) chips.push({ id: 'lvl', icon: 'tune', label: meal.difficulty });
    return chips;
  }, [meal]);

  // Look up whether this recipe is already in the saved list (by name).
  // Lets us show "Saved" on the button immediately when the user re-opens
  // a generated recipe (auto-save during fetch already wrote it).
  useEffect(() => {
    if (!uid || !meal) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getSavedRecipes(uid);
        if (cancelled) return;
        const exists = list.some((r) => r.name.trim() === meal.name.trim());
        setIsSaved(exists);
      } catch {
        // Best-effort; default to "not saved"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, meal]);

  const handleSaveLocal = async () => {
    if (!uid || !meal || saving || isSaved) return;
    try {
      setSaving(true);
      const recipeData: any = {
        name: meal.name,
        emoji: '',
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        mode,
        prompt: effectivePrompt,
        ingredients: parsed.ingredients,
        instructions: parsed.instructions,
        aiDescription: meal.aiDescription || '',
        complexity,
      };
      if (meal.instacartLink) recipeData.instacartLink = meal.instacartLink;
      if (meal.restaurant) recipeData.restaurant = meal.restaurant;
      if (meal.prepTime) recipeData.prepTime = meal.prepTime;
      if (meal.cost) recipeData.cost = meal.cost;
      if (meal.difficulty) recipeData.difficulty = meal.difficulty;
      if (meal.deliveryTime) recipeData.deliveryTime = meal.deliveryTime;

      await saveRecipe(uid, recipeData);
      setIsSaved(true);
    } catch (e: any) {
      Alert.alert('Failed to save', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOrderInstacart = () => {
    if (!meal?.instacartLink) {
      Alert.alert('Not available', 'No Instacart link was returned for this recipe.');
      return;
    }
    Linking.openURL(meal.instacartLink).catch(() => {
      Alert.alert('Could not open', 'Failed to open the Instacart link.');
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FBFFFA', '#F2FBEE', '#E5F6E0']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header — back left, logo visually centered */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.neutral.blackSoft} />
        </Pressable>
        <View style={styles.headerLogoCenter} pointerEvents="none">
          <Logo size={34} />
        </View>
        <View style={styles.headerEndSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 96 + insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Finding the perfect meal for you…</Text>
          </View>
        )}

        {error && !loading && (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={40} color={colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={fetchRecommendations}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </Animated.View>
        )}

        {!loading && !error && meal && (
          <Animated.View entering={FadeIn.duration(240)}>
            {/* Title */}
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{meal.name}</Text>
              {meal.restaurant && (
                <Text style={styles.subtitle}>From {meal.restaurant}</Text>
              )}
              {tagChips.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {tagChips.map((chip) => (
                    <View key={chip.id} style={styles.chip}>
                      <MaterialIcons name={chip.icon} size={13} color={colors.primary[700]} />
                      <Text style={styles.chipText}>{chip.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Nutrition hero */}
            {meal.nutritionUnavailable ? (
              <View style={styles.nutritionUnavailable}>
                <MaterialIcons name="info-outline" size={16} color={colors.neutral.gray600} />
                <Text style={styles.nutritionUnavailableText}>
                  Couldn&apos;t estimate nutrition. Try describing specific ingredients.
                </Text>
              </View>
            ) : (
              <View style={styles.nutritionWrap}>
                <View style={styles.calorieCard}>
                  <Text style={styles.calorieValue}>{meal.calories.toLocaleString()}</Text>
                  <Text style={styles.calorieLabel}>calories</Text>
                </View>
                <View style={styles.macroGrid}>
                  <MacroCell label="Protein" value={`${meal.protein}g`} accent={colors.primary[600]} />
                  <MacroCell label="Carbs" value={`${meal.carbs}g`} accent={colors.accent.teal} />
                  <MacroCell label="Fat" value={`${meal.fat}g`} accent={colors.semantic.warning} />
                </View>
              </View>
            )}

            {/* Ingredients */}
            {parsed.ingredients.length > 0 && (
              <Section title="Ingredients" count={parsed.ingredients.length}>
                <View style={styles.listCard}>
                  {parsed.ingredients.map((ingredient, idx) => {
                    const cleaned = ingredient.replace(/^[-\d+\.•]\s*/, '').trim();
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.listRow,
                          idx === parsed.ingredients.length - 1 && styles.listRowLast,
                        ]}
                      >
                        <View style={styles.listDot} />
                        <Text style={styles.listText}>{cleaned}</Text>
                      </View>
                    );
                  })}
                </View>
              </Section>
            )}

            {/* Instructions */}
            {parsed.instructions.length > 0 && (
              <Section title="Instructions" count={parsed.instructions.length}>
                <View style={styles.listCard}>
                  {parsed.instructions.map((instruction, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.stepRow,
                        idx === parsed.instructions.length - 1 && styles.stepRowLast,
                      ]}
                    >
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{instruction.trim()}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Sticky bottom CTAs */}
      {!loading && !error && meal && (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={({ pressed }) => [
              styles.bottomBtn,
              styles.bottomBtnSecondary,
              pressed && !isSaved && styles.bottomBtnPressed,
              isSaved && styles.bottomBtnSecondarySaved,
            ]}
            onPress={handleSaveLocal}
            disabled={saving || isSaved}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral.blackSoft} />
            ) : (
              <MaterialIcons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? colors.primary[600] : colors.neutral.blackSoft}
              />
            )}
            <Text
              style={[
                styles.bottomBtnSecondaryText,
                isSaved && styles.bottomBtnSecondaryTextSaved,
              ]}
            >
              {isSaved ? 'Saved' : saving ? 'Saving…' : 'Save recipe'}
            </Text>
          </Pressable>

          {Boolean(meal.instacartLink?.trim()) && (
            <Pressable
              style={({ pressed }) => [
                styles.bottomBtn,
                styles.bottomBtnPrimary,
                pressed && styles.bottomBtnPressed,
              ]}
              onPress={handleOrderInstacart}
            >
              <MaterialIcons name="shopping-cart" size={18} color={colors.neutral.white} />
              <Text style={styles.bottomBtnPrimaryText}>Order ingredients</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MacroCell({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.macroCell}>
      <View style={[styles.macroDot, { backgroundColor: accent }]} />
      <View style={styles.macroCellRight}>
        <Text style={styles.macroValue}>{value}</Text>
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
    </View>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && <Text style={styles.sectionCount}>{count}</Text>}
      </View>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  headerLogoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEndSpacer: {
    width: 36,
    height: 36,
  },

  // Loading / error / empty
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  loadingText: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.gray600,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.gray600,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.button,
    marginTop: spacing.sm,
  },
  retryBtnText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.white,
  },

  // Title block
  titleBlock: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 26,
    lineHeight: 32,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: spacing.md,
    paddingRight: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 12,
    color: colors.neutral.blackSoft,
  },

  // Nutrition hero
  nutritionWrap: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  calorieCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.cardLarge,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.hero,
  },
  calorieValue: {
    fontFamily: fontFamily.primaryLight,
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 46,
    color: colors.neutral.blackSoft,
    letterSpacing: -1,
  },
  calorieLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...shadows.soft,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroCellRight: {
    flex: 1,
  },
  macroValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.2,
  },
  macroLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
    marginTop: 1,
  },
  nutritionUnavailable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  nutritionUnavailableText: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    lineHeight: 18,
  },

  // Sections
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 18,
    color: colors.neutral.blackSoft,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray300,
    letterSpacing: 0.4,
  },
  listCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    ...shadows.soft,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.gray100,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary[600],
    marginTop: 9,
  },
  listText: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.blackSoft,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.gray100,
  },
  stepRowLast: {
    borderBottomWidth: 0,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 12,
    color: colors.primary[700],
  },
  stepText: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.blackSoft,
    lineHeight: 21,
  },

  // Sticky bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.button,
    ...shadows.floating,
  },
  bottomBtnPrimary: {
    backgroundColor: colors.primary[600],
  },
  bottomBtnSecondary: {
    backgroundColor: colors.neutral.white,
  },
  bottomBtnSecondarySaved: {
    backgroundColor: colors.primary.soft,
    borderColor: colors.primary[600],
  },
  bottomBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  bottomBtnPrimaryText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.white,
  },
  bottomBtnSecondaryText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
  bottomBtnSecondaryTextSaved: {
    color: colors.primary[600],
  },
});
