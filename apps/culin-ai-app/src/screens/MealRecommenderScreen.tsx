import { useAuth } from '@/src/contexts/AuthContext';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { createCulinAIApi } from '@/src/services/culinaiApi';
import { formatDateForLog, getDefaultMealType } from '@/src/services/fatSecretApi';
import { computeDailyTotals, deleteMeal, getMealsByDate, saveMeal, type DailyTotals, type MealEntry } from '@/src/services/mealStore';
import { estimateFromText, isZeroEstimate, userMessageForError } from '@/src/services/nutritionApi';
import { getSavedRecipes, SavedRecipe } from '@/src/services/recipeStore';
import { getGreeting } from '@/src/utils/dateUtils';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// Real meal data
const COOK_MEALS = [
  {
    id: 'beef-rice',
    name: 'Rice + 90/10 Ground Beef Bowl',
    emoji: '🍚',
    calories: 520,
    protein: 45,
    prepTime: 15,
    cost: 3.5,
    difficulty: 'Easy',
  },
  {
    id: 'eggs-toast',
    name: 'Scrambled Eggs + Toast',
    emoji: '🍳',
    calories: 340,
    protein: 28,
    prepTime: 8,
    cost: 2.0,
    difficulty: 'Easy',
  },
  {
    id: 'chicken-broccoli',
    name: 'Chicken + Broccoli + Rice',
    emoji: '🍗',
    calories: 580,
    protein: 52,
    prepTime: 20,
    cost: 4.5,
    difficulty: 'Medium',
  },
  {
    id: 'yogurt-banana',
    name: 'Oikos Yogurt + Banana',
    emoji: '🥛',
    calories: 180,
    protein: 20,
    prepTime: 1,
    cost: 2.5,
    difficulty: 'Instant',
  },
];

const ORDER_MEALS = [
  {
    id: 'chipotle',
    name: 'Chipotle Double Chicken Bowl',
    emoji: '🌯',
    restaurant: 'Chipotle',
    calories: 680,
    protein: 72,
    cost: 12.5,
    deliveryTime: 25,
  },
  {
    id: 'subway',
    name: 'Subway Turkey + Double Meat',
    emoji: '🥖',
    restaurant: 'Subway',
    calories: 520,
    protein: 54,
    cost: 9.5,
    deliveryTime: 20,
  },
  {
    id: 'sweetgreen',
    name: 'Sweetgreen Protein Bowl',
    emoji: '🥗',
    restaurant: 'Sweetgreen',
    calories: 450,
    protein: 42,
    cost: 14.0,
    deliveryTime: 30,
  },
];

const FILTER_CHIPS = [
  { id: 'high-protein', label: 'High protein', icon: 'fitness-center' },
  { id: 'cheap', label: 'Cheap', icon: 'attach-money' },
  { id: 'fast', label: 'Fast', icon: 'bolt' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'eco' },
  { id: 'low-carb', label: 'Low carb', icon: 'trending-down' },
];

export default function MealRecommenderScreen() {
  const router = useRouter();
  const { userData, idToken, getUserId } = useAuth();
  const uid = getUserId();
  const userName = userData?.displayName?.split(' ')[0] || 'User';
  const greeting = getGreeting();
  const [selectedMode, setSelectedMode] = useState<'cook' | 'order' | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['high-protein']);
  const [showCookOptions, setShowCookOptions] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [complexity, setComplexity] = useState(3);
  const [nutritionGoals, setNutritionGoals] = useState<any>(null);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals>({ 
    calories: 0, 
    protein: 0, 
    carbs: 0, 
    fat: 0, 
    mealCount: 0 
  });
  const [todaysMeals, setTodaysMeals] = useState<MealEntry[]>([]);
  const [quickDishName, setQuickDishName] = useState('');
  const [quickIngredients, setQuickIngredients] = useState('');
  const [quickPortion, setQuickPortion] = useState('');
  const [quickLogLoading, setQuickLogLoading] = useState(false);

  const cookScale = useSharedValue(1);
  const orderScale = useSharedValue(1);

  // Fetch nutrition goals on mount
  useEffect(() => {
    fetchNutritionGoals();
  }, [idToken, userData]);

  // Refresh recipes and daily totals when screen comes into focus
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
      setLoadingRecipes(true);
      const recipes = await getSavedRecipes(uid, 10);
      setSavedRecipes(recipes);
      console.log('✅ Loaded saved recipes:', recipes.length);
    } catch (e) {
      console.error('Failed to load saved recipes:', e);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const fetchDailyTotals = async () => {
    if (!uid) return;
    
    try {
      const todayISO = formatDateForLog();
      const meals = await getMealsByDate(uid, todayISO);
      const totals = computeDailyTotals(meals);
      setDailyTotals(totals);
      setTodaysMeals(meals);
      console.log('✅ Loaded daily totals:', totals);
    } catch (e) {
      console.error('Failed to load daily totals:', e);
      // Reset to zero on error
      setDailyTotals({ calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
      setTodaysMeals([]);
    }
  };

  const handleDeleteRecipe = async (recipeId: string | undefined) => {
    if (!uid || !recipeId) return;
    
    try {
      const { deleteRecipe } = await import('@/src/services/recipeStore');
      await deleteRecipe(uid, recipeId);
      // Refresh the list
      fetchSavedRecipes();
    } catch (e) {
      console.error('Failed to delete recipe:', e);
    }
  };

  const handleAteRecipe = async (recipe: SavedRecipe) => {
    if (!uid) return;
    
    try {
      const todayISO = formatDateForLog();
      await saveMeal(uid, {
        foodName: recipe.name,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        mealType: getDefaultMealType(),
        date: todayISO,
      });
      
      // Refresh daily totals to show updated macros
      fetchDailyTotals();
      
      console.log('✅ Meal logged:', recipe.name);
    } catch (e) {
      console.error('Failed to log meal:', e);
    }
  };

  const handleRemoveMeal = async (mealId: string | undefined) => {
    if (!uid || !mealId) return;
    
    try {
      await deleteMeal(uid, mealId);
      // Refresh daily totals to show updated macros
      fetchDailyTotals();
      console.log('✅ Meal removed:', mealId);
    } catch (e) {
      console.error('Failed to remove meal:', e);
    }
  };

  const handleQuickLogMeal = async () => {
    if (!uid) return;
    if (!quickDishName.trim()) {
      Alert.alert('Required', 'Please enter a dish name.');
      return;
    }
    if (!quickIngredients.trim()) {
      Alert.alert('Required', 'Please enter at least one main ingredient.');
      return;
    }
    if (!quickPortion.trim()) {
      Alert.alert('Required', 'Please enter an estimated portion.');
      return;
    }

    try {
      setQuickLogLoading(true);
      const estimateText = `${quickDishName.trim()}. Main ingredients: ${quickIngredients.trim()}. Estimated portion: ${quickPortion.trim()}.`;
      const result = await estimateFromText(estimateText);

      if (!result?.macros || isZeroEstimate(result.macros)) {
        Alert.alert(
          'Could not estimate',
          'Nutrition engine could not estimate this meal. Try a more specific description.'
        );
        return;
      }

      const todayISO = formatDateForLog();
      await saveMeal(uid, {
        foodName: quickDishName.trim(),
        calories: result.macros.calories ?? 0,
        protein: result.macros.protein ?? 0,
        carbs: result.macros.carbs ?? 0,
        fat: result.macros.fat ?? 0,
        servingSize: quickPortion.trim(),
        mealType: getDefaultMealType(),
        date: todayISO,
      });

      // Immediately reflect in progress bars and today's meals list.
      await fetchDailyTotals();

      setQuickDishName('');
      setQuickIngredients('');
      setQuickPortion('');
      Alert.alert('Logged', 'Meal added to today\'s tracking.');
    } catch (err: any) {
      Alert.alert('Failed to log meal', userMessageForError(err));
    } finally {
      setQuickLogLoading(false);
    }
  };

  const fetchNutritionGoals = async () => {
    if (!userData) return;

    try {
      setLoadingGoals(true);
      
      // Try to fetch from API if available
      if (idToken) {
        try {
          const api = createCulinAIApi(idToken);
          
          const height = userData.height || 178;
          const weight = userData.weight || 165;
          const age = userData.age || 22;
          const sex = (userData.sex === 'M' || userData.sex === 'F') ? userData.sex : 'unknown';
          
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
            console.log('✅ Nutrition goals loaded from API:', response.goals);
            return;
          }
        } catch (apiError) {
          console.log('⚠️ API not available, using defaults');
        }
      }

      // Fallback: Use reasonable defaults based on user goals
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

      setNutritionGoals({
        calories,
        protein,
        carbs,
        fat,
        bmr: 1800,
        tdee: calories,
        weightKg: 75,
      });
      console.log('✅ Using default nutrition goals:', { calories, protein, carbs, fat });
    } catch (e) {
      console.error('Failed to load nutrition goals:', e);
    } finally {
      setLoadingGoals(false);
    }
  };

  const cookAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cookScale.value }],
  }));

  const orderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orderScale.value }],
  }));

  const handleCookPress = () => {
    cookScale.value = withSpring(0.95, { damping: 10 }, () => {
      cookScale.value = withSpring(1);
    });
    
    if (!prompt.trim()) {
      setSelectedMode('cook');
      return;
    }
    
    // Navigate to results screen with state
    router.push({
      pathname: '/meal-results' as any,
      params: {
        mode: 'cook',
        prompt: prompt.trim(),
        filters: JSON.stringify(selectedFilters),
        complexity: complexity.toString(),
      },
    });
  };

  const handleOrderPress = () => {
    orderScale.value = withSpring(0.95, { damping: 10 }, () => {
      orderScale.value = withSpring(1);
    });
    
    if (!prompt.trim()) {
      setSelectedMode('order');
      return;
    }
    
    // Navigate to results screen with state
    router.push({
      pathname: '/meal-results' as any,
      params: {
        mode: 'order',
        prompt: prompt.trim(),
        filters: JSON.stringify(selectedFilters),
        complexity: complexity.toString(),
      },
    });
  };

  const toggleFilter = (filterId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  const buildSuggestionPrompt = (meal: any, type: 'cook' | 'order') => {
    const filterContext = selectedFilters.length
      ? `Focus on: ${selectedFilters.join(', ')}.`
      : '';
    const userPromptContext = prompt.trim()
      ? `Additional user preference: ${prompt.trim()}.`
      : '';

    if (type === 'cook') {
      return [
        `Generate a practical home-cook recipe for: ${meal.name}.`,
        `Target around ${meal.calories} calories and ${meal.protein}g protein.`,
        `Prep time should be about ${meal.prepTime} minutes and difficulty ${meal.difficulty}.`,
        filterContext,
        userPromptContext,
      ]
        .filter(Boolean)
        .join(' ');
    }

    return [
      `Generate an order-friendly meal breakdown for: ${meal.name}.`,
      `Assume restaurant style meal, around ${meal.calories} calories and ${meal.protein}g protein.`,
      filterContext,
      userPromptContext,
    ]
      .filter(Boolean)
      .join(' ');
  };

  const handleSuggestedMealSelect = (meal: any, type: 'cook' | 'order') => {
    const generatedPrompt = buildSuggestionPrompt(meal, type);
    router.push({
      pathname: '/meal-results' as any,
      params: {
        mode: type,
        prompt: generatedPrompt,
        filters: JSON.stringify(selectedFilters),
        complexity: complexity.toString(),
      },
    });
  };

  const renderMealCard = (meal: any, type: 'cook' | 'order') => (
    <Pressable
      key={meal.id}
      style={styles.mealCard}
      onPress={() => handleSuggestedMealSelect(meal, type)}
    >
      <View style={styles.mealHeader}>
        <Text style={styles.mealEmoji}>{meal.emoji}</Text>
        {type === 'order' && (
          <View style={styles.restaurantBadge}>
            <Text style={styles.badgeText}>{meal.restaurant}</Text>
          </View>
        )}
      </View>

      <Text style={styles.mealName}>{meal.name}</Text>

      <View style={styles.mealStats}>
        <View style={styles.statItem}>
          <MaterialIcons name="local-fire-department" size={14} color={colors.semantic.warning} />
          <Text style={styles.statText}>{meal.calories} cal</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialIcons name="fitness-center" size={14} color={colors.primary[600]} />
          <Text style={styles.statText}>{meal.protein}g protein</Text>
        </View>
      </View>

      <View style={styles.mealFooter}>
        {type === 'cook' ? (
          <>
            <View style={styles.footerItem}>
              <MaterialIcons name="schedule" size={14} color={colors.neutral.gray600} />
              <Text style={styles.footerText}>{meal.prepTime} min</Text>
            </View>
            <Text style={styles.costText}>${meal.cost.toFixed(2)}</Text>
          </>
        ) : (
          <>
            <View style={styles.footerItem}>
              <MaterialIcons name="delivery-dining" size={14} color={colors.neutral.gray600} />
              <Text style={styles.footerText}>{meal.deliveryTime} min</Text>
            </View>
            <Text style={styles.costText}>${meal.cost.toFixed(2)}</Text>
          </>
        )}
      </View>

      <Pressable
        style={styles.selectButton}
        onPress={() => handleSuggestedMealSelect(meal, type)}
      >
        <Text style={styles.selectButtonText}>Choose this meal</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F2FFF2', '#E8FBE3', '#CFF7D6']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <Text style={styles.greeting}>
            {greeting}, {userName}
          </Text>
        </Animated.View>

        {/* Nutrition Goals */}
        {nutritionGoals && (
          <Animated.View entering={FadeInDown.duration(200).delay(25)} style={styles.goalsCard}>
            <View style={styles.goalsHeader}>
              <MaterialIcons name="track-changes" size={18} color={colors.primary[600]} />
              <Text style={styles.goalsTitle}>Your Daily Goals</Text>
              {dailyTotals.mealCount > 0 && (
                <View style={styles.mealCountBadge}>
                  <Text style={styles.mealCountText}>{dailyTotals.mealCount} meals</Text>
                </View>
              )}
            </View>
            <View style={styles.goalsGrid}>
              <View style={styles.goalItem}>
                <Text style={styles.goalValue}>
                  {Math.max(0, Math.round(nutritionGoals.calories - dailyTotals.calories))}
                </Text>
                <Text style={styles.goalLabel}>Calories Left</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalValue}>
                  {Math.max(0, Math.round(nutritionGoals.protein - dailyTotals.protein))}g
                </Text>
                <Text style={styles.goalLabel}>Protein Left</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalValue}>
                  {Math.max(0, Math.round(nutritionGoals.carbs - dailyTotals.carbs))}g
                </Text>
                <Text style={styles.goalLabel}>Carbs Left</Text>
              </View>
              <View style={styles.goalItem}>
                <Text style={styles.goalValue}>
                  {Math.max(0, Math.round(nutritionGoals.fat - dailyTotals.fat))}g
                </Text>
                <Text style={styles.goalLabel}>Fat Left</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {loadingGoals && (
          <View style={styles.loadingGoals}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading your nutrition goals...</Text>
          </View>
        )}

        {/* Today's Meals */}
        {todaysMeals.length > 0 && (
          <Animated.View entering={FadeInDown.duration(200).delay(50)} style={styles.todaysMealsCard}>
            <View style={styles.todaysMealsHeader}>
              <MaterialIcons name="restaurant" size={18} color={colors.primary[600]} />
              <Text style={styles.todaysMealsTitle}>Today&apos;s Meals</Text>
              <View style={styles.mealCountBadge}>
                <Text style={styles.mealCountText}>{todaysMeals.length} logged</Text>
              </View>
            </View>
            <View style={styles.todaysMealsList}>
              {todaysMeals.map((meal) => {
                // Try to find matching recipe from saved recipes
                const matchingRecipe = savedRecipes.find(r => r.name === meal.foodName);
                
                return (
                  <Pressable
                    key={meal.id}
                    style={styles.todaysMealRow}
                    onPress={() => {
                      if (matchingRecipe) {
                        // Navigate to full recipe view
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
                    <View style={styles.todaysMealLeft}>
                      <Text style={styles.todaysMealName}>{meal.foodName}</Text>
                      <Text style={styles.todaysMealStats}>
                        {meal.protein}g protein · {meal.calories} cal
                      </Text>
                    </View>
                    <Pressable
                      style={styles.removeMealButton}
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

        {/* Separator Line */}
        {todaysMeals.length > 0 && (
          <View style={styles.sectionSeparator} />
        )}

        {/* Quick Manual Log */}
        <Animated.View entering={FadeInDown.duration(200).delay(65)} style={styles.quickLogCard}>
          <View style={styles.quickLogHeader}>
            <MaterialIcons name="edit-note" size={18} color={colors.primary[600]} />
            <Text style={styles.quickLogTitle}>Quick Log Meal</Text>
          </View>
          <Text style={styles.quickLogSubtitle}>
            Log made meals or anything you ate. We&apos;ll estimate macros with the nutrition engine.
          </Text>

          <View style={styles.quickInputWrapper}>
            <TextInput
              style={styles.quickInput}
              placeholder="Dish name (e.g. Chicken biryani)"
              placeholderTextColor={colors.neutral.gray300}
              value={quickDishName}
              onChangeText={setQuickDishName}
            />
          </View>

          <View style={styles.quickInputWrapper}>
            <TextInput
              style={styles.quickInput}
              placeholder="Main ingredients (e.g. chicken, rice, yogurt)"
              placeholderTextColor={colors.neutral.gray300}
              value={quickIngredients}
              onChangeText={setQuickIngredients}
            />
          </View>

          <View style={styles.quickInputWrapper}>
            <TextInput
              style={styles.quickInput}
              placeholder="Estimated portion (e.g. 1 medium bowl)"
              placeholderTextColor={colors.neutral.gray300}
              value={quickPortion}
              onChangeText={setQuickPortion}
            />
          </View>

          <Pressable
            style={[styles.quickLogButton, quickLogLoading && styles.quickLogButtonDisabled]}
            onPress={handleQuickLogMeal}
            disabled={quickLogLoading}
          >
            {quickLogLoading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <MaterialIcons name="add-circle-outline" size={18} color={colors.neutral.white} />
                <Text style={styles.quickLogButtonText}>Estimate &amp; Log Meal</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.sectionSeparator} />

        {/* Main Decision Title */}
        <Animated.View entering={FadeInDown.duration(200).delay(50)} style={styles.titleSection}>
          <Text style={styles.mainTitle}>What should you eat next?</Text>
        </Animated.View>

        {/* Prompt Input */}
        <Animated.View entering={FadeInDown.duration(200).delay(75)} style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="search" size={20} color={colors.neutral.gray600} />
            <TextInput
              style={styles.textInput}
              placeholder="e.g. high protein, under 30 min..."
              placeholderTextColor={colors.neutral.gray300}
              value={prompt}
              onChangeText={setPrompt}
              returnKeyType="done"
            />
            {prompt.length > 0 && (
              <Pressable onPress={() => setPrompt('')}>
                <MaterialIcons name="close" size={18} color={colors.neutral.gray600} />
              </Pressable>
            )}
          </View>
          <Text style={styles.inputHint}>
            💡 Tip: Enter your preferences, then tap Cook or Order
          </Text>
          
          {/* Complexity Slider */}
          <View style={styles.complexitySection}>
            <View style={styles.complexityHeader}>
              <MaterialIcons name="tune" size={18} color={colors.primary[600]} />
              <Text style={styles.complexityLabel}>Recipe Complexity: {complexity}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={5}
              step={1}
              value={complexity}
              onValueChange={setComplexity}
              minimumTrackTintColor={colors.primary[600]}
              maximumTrackTintColor={colors.neutral.gray100}
              thumbTintColor={colors.primary[600]}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Simple</Text>
              <Text style={styles.sliderLabelText}>Complex</Text>
            </View>
          </View>

          {/* Past Recipes Section - Always visible */}
          <View style={styles.pastRecipesSection}>
            <View style={styles.pastRecipesHeader}>
              <MaterialIcons name="history" size={18} color={colors.primary[600]} />
              <Text style={styles.pastRecipesTitle}>Past Recipes</Text>
              <Text style={styles.pastRecipesHint}>Tap to add</Text>
            </View>
            
            {loadingRecipes ? (
              <View style={styles.loadingRecipes}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
                <Text style={styles.loadingText}>Loading recipes...</Text>
              </View>
            ) : savedRecipes.length > 0 ? (
              <View style={styles.recipesList}>
                {savedRecipes.slice(0, 5).map((recipe) => (
                  <Pressable
                    key={recipe.id}
                    style={styles.recipeRow}
                    onPress={() => {
                      // Tap to add to today's meals
                      handleAteRecipe(recipe);
                    }}
                    onLongPress={() => {
                      // Long press to view full recipe
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
                    }}
                  >
                    <View style={styles.recipeRowLeft}>
                      <Text style={styles.recipeRowName}>{recipe.name}</Text>
                      <Text style={styles.recipeRowStats}>
                        {recipe.protein}g protein · {recipe.calories} cal
                      </Text>
                    </View>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteRecipe(recipe.id);
                      }}
                    >
                      <MaterialIcons name="close" size={16} color={colors.neutral.gray600} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRecipesPlaceholder}>
                <MaterialIcons name="restaurant-menu" size={32} color={colors.neutral.gray300} />
                <Text style={styles.emptyRecipesText}>No recipes yet</Text>
                <Text style={styles.emptyRecipesSubtext}>
                  Your generated recipes will appear here
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Cook or Order Cards - Commented out, moved to bottom */}
        {/* <Animated.View entering={FadeInDown.duration(200).delay(100)} style={styles.decisionCards}>
          <Pressable onPress={handleCookPress} style={styles.decisionCardWrapper}>
            <Animated.View style={[styles.decisionCard, cookAnimatedStyle]}>
              <View style={styles.cardIconContainer}>
                <MaterialIcons name="restaurant" size={40} color={colors.primary[600]} />
              </View>
              <Text style={styles.cardTitle}>Cook</Text>
              <Text style={styles.cardSubtitle}>Make a quick healthy meal</Text>
            </Animated.View>
          </Pressable>
        </Animated.View> */}

        {/* Show meals based on selection */}
        {selectedMode && (
          <>
            {/* Filter Chips */}
            <Animated.View entering={FadeInDown.duration(200).delay(150)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersContainer}
              >
                {FILTER_CHIPS.map((filter) => {
                  const isSelected = selectedFilters.includes(filter.id);
                  return (
                    <Pressable
                      key={filter.id}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => toggleFilter(filter.id)}
                    >
                      <MaterialIcons
                        name={filter.icon as any}
                        size={14}
                        color={isSelected ? colors.primary[700] : colors.neutral.gray600}
                      />
                      <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* Meal Suggestions */}
            <Animated.View entering={FadeInDown.duration(200).delay(200)} style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>
                {selectedMode === 'cook' ? 'Quick recipes' : 'Best options near you'}
              </Text>
              <View style={styles.mealsGrid}>
                {selectedMode === 'cook'
                  ? COOK_MEALS.map((meal) => renderMealCard(meal, 'cook'))
                  : ORDER_MEALS.map((meal) => renderMealCard(meal, 'order'))}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
      
      {/* Sticky Cook Button at Bottom */}
      <Animated.View entering={FadeInDown.duration(200).delay(100)} style={styles.stickyButtonContainer}>
        <Pressable onPress={handleCookPress} style={styles.cookButton}>
          <Animated.View style={cookAnimatedStyle}>
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600], colors.primary[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cookButtonGradient}
            >
              <MaterialIcons name="restaurant" size={24} color={colors.neutral.white} />
              <Text style={styles.cookButtonText}>What should I eat?</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 16,
  },
  greeting: {
    fontFamily: fontFamily.primary,
    fontSize: 28,
    fontWeight: '300',
    color: colors.neutral.blackSoft,
  },
  goalsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  goalsTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
  },
  goalsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  goalItem: {
    flex: 1,
    alignItems: 'center',
  },
  goalValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 18,
    color: colors.primary[700],
    marginBottom: 4,
  },
  goalLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
  },
  mealCountBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  mealCountText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 11,
    color: colors.neutral.white,
  },
  miniProgressBar: {
    height: 3,
    backgroundColor: colors.neutral.gray100,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
    width: '100%',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: 2,
  },
  loadingGoals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  todaysMealsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  todaysMealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todaysMealsTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
    flex: 1,
  },
  todaysMealsList: {
    gap: 0,
  },
  todaysMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.gray100,
    backgroundColor: 'transparent',
  },
  todaysMealLeft: {
    flex: 1,
  },
  todaysMealName: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    marginBottom: 4,
  },
  todaysMealStats: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  removeMealButton: {
    padding: 8,
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: colors.neutral.gray100,
    marginVertical: 24,
  },
  quickLogCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  quickLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  quickLogTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
  },
  quickLogSubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
    marginBottom: 12,
  },
  quickInputWrapper: {
    backgroundColor: colors.neutral.offWhite,
    borderRadius: radius.button,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  quickInput: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.blackSoft,
    paddingVertical: 12,
  },
  quickLogButton: {
    marginTop: 4,
    backgroundColor: colors.primary[600],
    borderRadius: radius.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickLogButtonDisabled: {
    opacity: 0.75,
  },
  quickLogButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.white,
  },
  loadingText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  titleSection: {
    marginBottom: 16,
  },
  mainTitle: {
    fontFamily: fontFamily.primaryLight,
    fontSize: 20,
    color: colors.neutral.blackSoft,
    lineHeight: 28,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    ...shadows.card,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.blackSoft,
  },
  inputHint: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
    textAlign: 'center',
    marginTop: 8,
  },
  complexitySection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: radius.card,
  },
  complexityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  complexityLabel: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
  },
  pastRecipesSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: radius.card,
  },
  pastRecipesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pastRecipesTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.blackSoft,
    flex: 1,
  },
  pastRecipesHint: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
  },
  loadingRecipes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  recipesList: {
    gap: 0,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.gray100,
  },
  recipeRowLeft: {
    flex: 1,
  },
  recipeRowName: {
    fontFamily: fontFamily.primary,
    fontSize: 15,
    color: colors.neutral.blackSoft,
    marginBottom: 4,
  },
  recipeRowStats: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  deleteButton: {
    padding: 8,
  },
  emptyRecipesPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyRecipesText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.neutral.gray600,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyRecipesSubtext: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray300,
    textAlign: 'center',
  },
  decisionCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  decisionCardWrapper: {
    flex: 1,
  },
  decisionCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    textAlign: 'center',
    lineHeight: 18,
  },
  filtersContainer: {
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: radius.chip,
    marginRight: spacing.sm,
    gap: spacing.xs,
    ...shadows.card,
  },
  filterChipActive: {
    backgroundColor: colors.primary.soft,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  filterText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  filterTextActive: {
    fontFamily: fontFamily.primaryMedium,
    color: colors.primary[700],
  },
  mealsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fontFamily.primary,
    fontSize: 17,
    fontWeight: '500',
    color: colors.neutral.blackSoft,
    marginBottom: spacing.lg,
  },
  mealsGrid: {
    gap: spacing.lg,
  },
  mealCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  mealEmoji: {
    fontSize: 48,
  },
  restaurantBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
  },
  badgeText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 11,
    color: colors.neutral.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealName: {
    fontFamily: fontFamily.primary,
    fontSize: 18,
    color: colors.neutral.blackSoft,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  mealStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.neutral.gray100,
    marginHorizontal: spacing.md,
  },
  statText: {
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
  },
  mealFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    color: colors.neutral.gray600,
  },
  costText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.primary[700],
  },
  selectButton: {
    backgroundColor: colors.primary.soft,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  selectButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.primary[700],
  },
  floatingButton: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
  },
  voiceButton: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...shadows.floating,
    height: 56,
  },
  voiceButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 17,
    color: colors.neutral.white,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  cookButton: {
    borderRadius: radius.button,
    overflow: 'hidden',
    ...shadows.floating,
    elevation: 8,
  },
  cookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    height: 60,
    gap: 12,
  },
  cookButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 18,
    color: colors.neutral.white,
    fontWeight: '600',
  },
});
