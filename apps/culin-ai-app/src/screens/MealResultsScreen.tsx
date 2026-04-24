import { useAuth } from '@/src/contexts/AuthContext';
import { colors, fontFamily, radius, shadows, spacing } from '@/src/design/tokens';
import { createCulinAIApi } from '@/src/services/culinaiApi';
import { estimateFromText, isZeroEstimate, userMessageForError } from '@/src/services/nutritionApi';
import { saveRecipe } from '@/src/services/recipeStore';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface EnrichedMeal {
  id: string;
  name: string;
  emoji: string;
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

export default function MealResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userData, idToken, getUserId } = useAuth();
  const uid = getUserId();

  const mode = params.mode as 'cook' | 'order';
  const prompt = params.prompt as string;
  const filters = (() => { try { return params.filters ? JSON.parse(params.filters as string) : []; } catch { return []; } })();
  const complexity = params.complexity ? parseInt(params.complexity as string) : 3;
  const savedRecipe = (() => { try { return params.savedRecipe ? JSON.parse(params.savedRecipe as string) : null; } catch { return null; } })();

  const [loading, setLoading] = useState(!savedRecipe); // Don't show loading if we have saved recipe
  const [meals, setMeals] = useState<EnrichedMeal[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Helper function to parse recipe description
  const parseRecipeDescription = (description: string) => {
    // Helper function to clean markdown formatting
    const cleanText = (text: string) => {
      return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
        .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
        .replace(/###\s*/g, '')             // Remove ### headers
        .replace(/####\s*/g, '')            // Remove #### headers
        .replace(/^[-•]\s*/g, '')           // Remove leading dashes and bullets
        .trim();
    };

    // Extract ingredients section - handle both **Ingredients:** and #### Ingredients:
    const ingredientsMatch = description.match(/(?:\*\*|####)\s*Ingredients[:\s]*(?:\*\*)?[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:\*\*|####)\s*Instructions|$)/i);
    const ingredients = ingredientsMatch 
      ? ingredientsMatch[1].trim().split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && (trimmed.startsWith('-') || /^\d+\./.test(trimmed));
        }).map(line => cleanText(line))
      : [];

    // Extract instructions section - handle multiple formats and stop before **Note:**
    const instructionsMatch = description.match(/(?:\*\*|####)\s*Instructions[:\s]*(?:\*\*)?[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:\*\*Note|\*\*Nutritional|###\s*Nutritional|###\s*Serving)|$)/i);
    let instructions: string[] = [];
    
    if (instructionsMatch) {
      const instructionText = instructionsMatch[1].trim();
      console.log('🔍 Raw instruction text:', instructionText.substring(0, 200));
      
      // Split by numbered items (1. 2. 3. etc.)
      // Handle format: "1. **Title:**\n   - details"
      const numberedSteps = instructionText.split(/\n(?=\d+\.\s+)/);
      
      if (numberedSteps.length > 1) {
        instructions = numberedSteps
          .map(step => {
            // Remove the number prefix and clean the text
            const cleaned = step.replace(/^\d+\.\s+/, '').trim();
            // Combine multi-line steps into one instruction
            const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l);
            return lines.join(' ');
          })
          .map(s => cleanText(s))
          .filter(s => s.length > 10); // Filter out very short/empty steps
        
        console.log(`✅ Parsed ${instructions.length} instructions`);
      }
    } else {
      console.log('⚠️ No instructions match found in description');
    }

    return { ingredients, instructions };
  };

  useEffect(() => {
    // If we have a saved recipe, use it directly instead of fetching
    if (savedRecipe) {
      loadSavedRecipe();
    } else {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSavedRecipe = () => {
    try {
      // Convert saved recipe to EnrichedMeal format
      const enrichedMeal: EnrichedMeal = {
        id: savedRecipe.id || Date.now().toString(),
        name: savedRecipe.name,
        emoji: savedRecipe.emoji,
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

      setMeals([enrichedMeal]);
      setLoading(false);
      console.log('✅ Loaded saved recipe:', enrichedMeal.name);
    } catch (e) {
      console.error('Failed to load saved recipe:', e);
      setError('Failed to load recipe');
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!idToken || !prompt) {
      setError('Missing authentication or prompt');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const api = createCulinAIApi(idToken);

      const modeContext = mode === 'cook' ? 'I want to cook a meal.' : 'I want to order food.';
      const filterContext = filters.length
        ? `Preferences: ${filters.join(', ')}.`
        : '';
      const fullQuery = `${modeContext} ${filterContext} ${prompt}`.trim();

      console.log('🔍 Sending query to Recommender:', fullQuery);

      const response = await api.sendChatMessage(fullQuery, { complexity });

      console.log('✅ Recommender response:', response);

      const aiDescription = response.enhancedResponse || '';
      
      // Extract meal name from the recipe title - try multiple patterns
      let mealName = prompt; // Default fallback
      
      // Try ### heading format first (most common)
      const heading3Match = aiDescription.match(/###\s+(?:Enhanced\s+)?([^\n]+)/i);
      if (heading3Match) {
        mealName = heading3Match[1].trim();
      } else {
        // Try **bold** format
        const boldMatch = aiDescription.match(/\*\*([^*]+(?:Chicken|Recipe|Bowl|Salad|Meal|Grilled|Herb)[^*]*)\*\*/i);
        if (boldMatch) {
          mealName = boldMatch[1].trim();
        }
      }
      
      // Clean markdown from meal name
      mealName = mealName
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
        .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
        .replace(/###\s*/g, '')             // Remove ### headers
        .trim();
      
      console.log('📝 Extracted meal name:', mealName);

      // Extract nutrition info - try multiple formats
      let calories = 0, protein = 0, carbs = 0, fat = 0;
      
      // Format 1: ### Nutritional Information (per serving): with **bold** labels
      const nutritionMatch1 = aiDescription.match(/###\s*Nutritional Information[\s\S]*?-\s*\*\*Protein\*\*:\s*Approximately\s*(\d+)\s*grams[\s\S]*?-\s*\*\*Fats\*\*:\s*Approximately\s*(\d+)\s*grams/i);
      
      // Format 2: **Nutrition Information per Serving:** with regular labels  
      const nutritionMatch2 = aiDescription.match(/\*\*Nutrition Information[^:]*:\*\*[\s\S]*?- Calories:\s*Approximately\s*(\d+)\s*kcal[\s\S]*?- Protein:\s*(\d+)g[\s\S]*?- Carbohydrates:\s*(\d+)g[\s\S]*?- Fat:\s*(\d+)g/i);
      
      if (nutritionMatch1) {
        protein = parseInt(nutritionMatch1[1]) || 0;
        fat = parseInt(nutritionMatch1[2]) || 0;
        // Estimate calories from macros: protein(4 cal/g) + fat(9 cal/g) + minimal carbs
        calories = Math.round(protein * 4 + fat * 9);
        carbs = 2; // Minimal from herbs/lemon
        console.log('📊 Parsed nutrition (format 1):', { calories, protein, carbs, fat });
      } else if (nutritionMatch2) {
        calories = parseInt(nutritionMatch2[1]) || 0;
        protein = parseInt(nutritionMatch2[2]) || 0;
        carbs = parseInt(nutritionMatch2[3]) || 0;
        fat = parseInt(nutritionMatch2[4]) || 0;
        console.log('📊 Parsed nutrition (format 2):', { calories, protein, carbs, fat });
      }
      
      // If no nutrition found in the text, call the Nutrition Estimation Engine
      let nutritionUnavailable = false;
      if (!nutritionMatch1 && !nutritionMatch2) {
        console.log('⚠️ No nutrition in text, calling Nutrition Engine for:', mealName);
        try {
          const result = await estimateFromText(`${mealName}. ${aiDescription}`);
          console.log('✅ Nutrition estimate:', result);
          
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
        console.log('📊 Using Nutrition Engine values:', { calories, protein, carbs, fat });
      }

      // Get Instacart link if available
      const instacartLink = response.instacart?.products_link_url || null;

      // Create enriched meal object
      const enrichedMeal: EnrichedMeal = {
        id: Date.now().toString(),
        name: mealName,
        emoji: mode === 'cook' ? '🍳' : '🌯',
        calories,
        protein,
        carbs,
        fat,
        nutritionUnavailable,
        aiDescription,
        instacartLink,
        ...(mode === 'cook' && {
          prepTime: 15,
          cost: 5.0,
          difficulty: 'Medium',
        }),
        ...(mode === 'order' && {
          deliveryTime: 25,
          cost: 12.0,
          restaurant: 'Restaurant',
        }),
      };

      setMeals([enrichedMeal]);

      // Save recipe to Firestore automatically
      if (uid) {
        try {
          const { ingredients, instructions } = parseRecipeDescription(aiDescription);
          
          // Build recipe object with only defined values to avoid Firestore errors
          const recipeData: any = {
            name: mealName,
            emoji: enrichedMeal.emoji,
            calories,
            protein,
            carbs,
            fat,
            mode,
            prompt,
            ingredients,
            instructions,
            aiDescription,
            complexity,
          };
          
          // Only add optional fields if they have values
          if (instacartLink) recipeData.instacartLink = instacartLink;
          if (enrichedMeal.restaurant) recipeData.restaurant = enrichedMeal.restaurant;
          if (enrichedMeal.prepTime) recipeData.prepTime = enrichedMeal.prepTime;
          if (enrichedMeal.cost) recipeData.cost = enrichedMeal.cost;
          if (enrichedMeal.difficulty) recipeData.difficulty = enrichedMeal.difficulty;
          if (enrichedMeal.deliveryTime) recipeData.deliveryTime = enrichedMeal.deliveryTime;
          
          await saveRecipe(uid, recipeData);
          console.log('💾 Recipe auto-saved to Firestore');
        } catch (saveError: any) {
          console.error('⚠️ Failed to save recipe:', saveError);
          // Don't block the UI if save fails
        }
      }
    } catch (e: any) {
      console.error('❌ Error fetching recommendations:', e);
      setError(e.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const renderMealCard = (meal: EnrichedMeal) => {
    const { ingredients, instructions } = parseRecipeDescription(meal.aiDescription || '');
    
    return (
      <Animated.View
        key={meal.id}
        entering={FadeInDown.duration(300)}
        style={styles.mealCard}
      >
        <View style={styles.mealHeader}>
          <Text style={styles.mealEmoji}>{meal.emoji}</Text>
          {meal.restaurant && (
            <View style={styles.restaurantBadge}>
              <Text style={styles.badgeText}>{meal.restaurant}</Text>
            </View>
          )}
        </View>

        <Text style={styles.mealName}>{meal.name}</Text>

        {/* Nutrition Stats */}
        {meal.nutritionUnavailable ? (
          <View style={styles.nutritionUnavailable}>
            <MaterialIcons name="info-outline" size={16} color={colors.neutral.gray600} />
            <Text style={styles.nutritionUnavailableText}>
              {"Couldn't estimate nutrition. Try describing specific ingredients (e.g. \"grilled chicken breast with rice\")."}
            </Text>
          </View>
        ) : (
          <View style={styles.nutritionContainer}>
            <View style={styles.mealStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="local-fire-department" size={16} color={colors.semantic.warning} />
                <Text style={styles.statText}>{meal.calories} cal</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialIcons name="fitness-center" size={16} color={colors.primary[600]} />
                <Text style={styles.statText}>{meal.protein}g protein</Text>
              </View>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Carbs</Text>
                <Text style={styles.macroValue}>{meal.carbs}g</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroLabel}>Fat</Text>
                <Text style={styles.macroValue}>{meal.fat}g</Text>
              </View>
            </View>
          </View>
        )}

        {/* Ingredients Section */}
        {ingredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="shopping-cart" size={18} color={colors.primary[600]} />
              <Text style={styles.sectionTitle}>Ingredients</Text>
            </View>
            {ingredients.map((ingredient, idx) => {
              // Clean and format ingredient text
              const cleanIngredient = ingredient
                .replace(/^[-\d+\.•]\s*/, '')  // Remove leading dash, number, or bullet
                .trim();
              
              return (
                <Text key={idx} style={styles.ingredientText}>
                  {cleanIngredient}
                </Text>
              );
            })}
            
            {/* Instacart Link */}
            {meal.instacartLink && (
              <Pressable 
                style={styles.instacartButton}
                onPress={() => {
                  console.log('Opening Instacart:', meal.instacartLink);
                }}
              >
                <MaterialIcons name="shopping-bag" size={16} color={colors.primary[700]} />
                <Text style={styles.instacartButtonText}>Order ingredients on Instacart</Text>
                <MaterialIcons name="open-in-new" size={14} color={colors.primary[600]} />
              </Pressable>
            )}
          </View>
        )}

        {/* Instructions Section */}
        {instructions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="restaurant" size={18} color={colors.primary[600]} />
              <Text style={styles.sectionTitle}>Instructions</Text>
            </View>
            {instructions.map((instruction, idx) => (
              <View key={idx} style={styles.instructionItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction.trim()}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.mealFooter}>
          {mode === 'cook' ? (
            <>
              <View style={styles.footerItem}>
                <MaterialIcons name="schedule" size={14} color={colors.neutral.gray600} />
                <Text style={styles.footerText}>{meal.prepTime} min</Text>
              </View>
              <Text style={styles.costText}>${meal.cost?.toFixed(2)}</Text>
            </>
          ) : (
            <>
              <View style={styles.footerItem}>
                <MaterialIcons name="delivery-dining" size={14} color={colors.neutral.gray600} />
                <Text style={styles.footerText}>{meal.deliveryTime} min</Text>
              </View>
              <Text style={styles.costText}>${meal.cost?.toFixed(2)}</Text>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F2FFF2', '#E8FBE3', '#CFF7D6']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.neutral.blackSoft} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {mode === 'cook' ? 'Cook' : 'Order'} Results
          </Text>
          <Text style={styles.headerSubtitle}>{prompt}</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Finding the perfect meal for you...</Text>
          </View>
        )}

        {error && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color={colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchRecommendations}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </Animated.View>
        )}

        {!loading && !error && meals.length === 0 && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.emptyContainer}>
            <MaterialIcons name="restaurant" size={48} color={colors.neutral.gray300} />
            <Text style={styles.emptyText}>No meals found. Try a different search.</Text>
          </Animated.View>
        )}

        {!loading && !error && meals.map(renderMealCard)}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 24,
    color: colors.neutral.blackSoft,
  },
  headerSubtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  loadingText: {
    fontFamily: fontFamily.primary,
    fontSize: 16,
    color: colors.neutral.gray600,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  errorText: {
    fontFamily: fontFamily.primary,
    fontSize: 16,
    color: colors.neutral.gray600,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    marginTop: spacing.md,
  },
  retryButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 15,
    color: colors.neutral.white,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  emptyText: {
    fontFamily: fontFamily.primary,
    fontSize: 16,
    color: colors.neutral.gray600,
    textAlign: 'center',
  },
  mealCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.lg,
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
    fontFamily: fontFamily.primaryMedium,
    fontSize: 20,
    color: colors.neutral.blackSoft,
    marginBottom: spacing.md,
    lineHeight: 26,
  },
  nutritionContainer: {
    marginBottom: spacing.lg,
  },
  nutritionUnavailable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.neutral.offWhite,
    padding: spacing.md,
    borderRadius: radius.button,
    marginBottom: spacing.lg,
  },
  nutritionUnavailableText: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 13,
    color: colors.neutral.gray600,
    lineHeight: 18,
  },
  mealDescription: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    lineHeight: 20,
    marginBottom: spacing.md,
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
  macroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  macroItem: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
    padding: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  macroLabel: {
    fontFamily: fontFamily.primary,
    fontSize: 11,
    color: colors.neutral.gray600,
    marginBottom: 2,
  },
  macroValue: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.neutral.blackSoft,
  },
  section: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.gray100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 16,
    color: colors.neutral.blackSoft,
  },
  ingredientText: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    lineHeight: 24,
    marginBottom: 8,
  },
  instacartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.soft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    marginTop: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  instacartButtonText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 14,
    color: colors.primary[700],
    flex: 1,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontFamily: fontFamily.primaryMedium,
    fontSize: 12,
    color: colors.neutral.white,
  },
  instructionText: {
    flex: 1,
    fontFamily: fontFamily.primary,
    fontSize: 14,
    color: colors.neutral.gray600,
    lineHeight: 22,
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
});