import { AnimatedPressableComponent } from "@/src/components/AnimatedPressable";
import { AnimatedScreen } from "@/src/components/AnimatedScreen";
import { AnimatedText } from "@/src/components/AnimatedText";
import Logo from "@/src/components/Logo";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatDate, getGreeting } from "@/src/utils/dateUtils";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { estimateFromText, formatMacrosForLogConfirmation, isZeroEstimate, userMessageForError } from "@/src/services/nutritionApi";
import {
  searchFoods,
  autocompleteFoods,
  logFood,
  getDefaultMealType,
  formatDateForLog,
  type FatSecretFood,
} from "@/src/services/fatSecretApi";
import { isNutritionApiConfigured, isFatSecretConfigured } from "@/src/config/api";
import {
  saveMeal,
  getMealsByDate,
  deleteMeal,
  computeDailyTotals,
  DEFAULT_TARGETS,
  type MealEntry,
  type DailyTotals,
} from "@/src/services/mealStore";

  export default function MealLogScreen() {
    const router = useRouter();
    const pathname = usePathname();
    const { userData, currentUser, getUserId } = useAuth();
    const userName = userData?.displayName || "User";
    const greeting = getGreeting();
    const todayDate = formatDate();
    const todayISO = formatDateForLog();
    const uid = getUserId();

    const [mealInput, setMealInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [meals, setMeals] = useState<MealEntry[]>([]);
    const [totals, setTotals] = useState<DailyTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
    const [searchResults, setSearchResults] = useState<FatSecretFood[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const targets = DEFAULT_TARGETS;

    // Load today's meals from Firestore on mount and when uid changes
    const loadMeals = useCallback(async () => {
      if (!uid) return;
      try {
        const entries = await getMealsByDate(uid, todayISO);
        setMeals(entries);
        setTotals(computeDailyTotals(entries));
      } catch (e) {
        console.error("Failed to load meals:", e);
      }
    }, [uid, todayISO]);

    useEffect(() => {
      loadMeals();
    }, [loadMeals]);

    // Debounced predictive search as user types
    useEffect(() => {
      if (!isFatSecretConfigured()) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      const q = mealInput.trim();
      if (q.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await autocompleteFoods(q);
          setSearchResults(results);
        } catch {
          // silent — user can still tap Search
        } finally {
          setSearching(false);
        }
      }, 350);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, [mealInput]);

    const persistMeal = async (entry: Omit<MealEntry, 'id' | 'createdAt'>) => {
      if (!uid) return;
      try {
        const id = await saveMeal(uid, entry);
        const newEntry: MealEntry = { ...entry, id };
        const updated = [newEntry, ...meals];
        setMeals(updated);
        setTotals(computeDailyTotals(updated));
      } catch (e) {
        console.error("Failed to save meal:", e);
      }
    };

    const handleDeleteMeal = async (mealId: string | undefined) => {
      if (!uid || !mealId) return;
      try {
        await deleteMeal(uid, mealId);
        const updated = meals.filter((m) => m.id !== mealId);
        setMeals(updated);
        setTotals(computeDailyTotals(updated));
      } catch (e) {
        Alert.alert("Error", "Could not delete meal.");
      }
    };

    const handleAddMeal = async () => {
      const text = mealInput.trim();
      if (!text) return;

      // Try FatSecret search first (if configured)
      if (isFatSecretConfigured()) {
        setLoading(true);
        setSearchResults([]);
        try {
          const results = await searchFoods(text);
          if (results.length > 0) {
            setSearchResults(results);
            setLoading(false);
            return; // user picks from search results
          }
          // No results — fall through to nutrition estimation
        } catch {
          // FatSecret search failed — fall through to nutrition estimation
        }
        setLoading(false);
      }

      // Fallback: estimate nutrition from the user's text and log directly
      setLoading(true);
      try {
        let cal = 0, prot = 0, carb = 0, fatG = 0;
        let estimateFailed = false;

        if (isNutritionApiConfigured()) {
          try {
            const result = await estimateFromText(text);
            if (result?.macros && !isZeroEstimate(result.macros)) {
              cal = result.macros.calories ?? 0;
              prot = result.macros.protein ?? 0;
              carb = result.macros.carbs ?? 0;
              fatG = result.macros.fat ?? 0;
            } else {
              estimateFailed = true;
            }
          } catch {
            estimateFailed = true;
          }
        }

        if (estimateFailed) {
          Alert.alert(
            "Nutrition Unavailable",
            "Couldn't estimate nutrition for this item. Try describing specific ingredients (e.g. \"grilled chicken breast with rice\"). The meal will still be logged.",
          );
        }

        const macrosSaved = {
          calories: cal,
          protein: prot,
          carbs: carb,
          fat: fatG,
        };
        await persistMeal({
          foodName: text,
          ...macrosSaved,
          mealType: getDefaultMealType(),
          date: todayISO,
        });
        const usedNutritionEstimate =
          isNutritionApiConfigured() &&
          !estimateFailed &&
          (cal > 0 || prot > 0 || carb > 0 || fatG > 0);
        if (usedNutritionEstimate) {
          const macroLine = formatMacrosForLogConfirmation(macrosSaved);
          console.log('[CulinAI][MealLogged]', macroLine);
          Alert.alert('Meal logged', macroLine);
        }
        setMealInput("");
      } catch (e: any) {
        Alert.alert("Error", userMessageForError(e));
      } finally {
        setLoading(false);
      }
    };

    const handleSelectFatSecretFood = async (food: FatSecretFood) => {
      setLoading(true);
      try {
        const serving = food.servings?.[0];
        // Log to FatSecret backend
        await logFood({
          food_id: food.food_id,
          food_name: food.food_name,
          serving_id: serving?.serving_id,
          number_units: 1,
          meal_type: getDefaultMealType(),
          date: todayISO,
        });
        // Persist to Firestore
        await persistMeal({
          foodName: food.food_name,
          calories: food.calories || 0,
          protein: food.protein ?? 0,
          carbs: food.carbohydrate ?? 0,
          fat: food.fat ?? 0,
          servingSize: serving?.serving_description,
          mealType: getDefaultMealType(),
          date: todayISO,
          fatSecretFoodId: food.food_id,
        });
        setMealInput("");
        setSearchResults([]);
      } catch (e) {
        Alert.alert("Error", "Could not log food. Try again.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <AnimatedScreen style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Logo size={28} style={styles.logo} />
            <View style={styles.headerText}>
              <AnimatedText variant="caption" delay={100}>{greeting},</AnimatedText>
              <View style={styles.row}>
                <AnimatedText variant="h1" delay={150}>Today, {todayDate}</AnimatedText>
                <MaterialIcons name="expand-more" size={22} color="#94a3b8" />
              </View>
            </View>
          </View>
          <AnimatedPressableComponent style={styles.iconButton}>
            <MaterialIcons name="settings" size={20} color="#475569" />
          </AnimatedPressableComponent>
        </View>
  
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Goals */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            <Animated.View 
              entering={FadeInRight.delay(200).duration(400).springify()}
              style={styles.goalCardPrimary}
            >
              <MaterialIcons name="local-fire-department" size={20} color="#137fec" />
              <AnimatedText variant="h4" delay={250}>Calories</AnimatedText>
              <AnimatedText variant="caption" delay={300} style={styles.cardSub}>
                {totals.calories.toLocaleString()} / {targets.calories.toLocaleString()} kcal
              </AnimatedText>
              <View style={styles.progressBg}>
                <Animated.View 
                  entering={FadeInDown.delay(350).duration(600)}
                  style={[styles.progressFill, { width: `${Math.min(100, Math.round((totals.calories / targets.calories) * 100))}%` }]} 
                />
              </View>
            </Animated.View>
  
            {(userData?.goals ?? []).map((goal, i) => (
              <Animated.View 
                key={goal}
                entering={FadeInRight.delay(300 + i * 100).duration(400).springify()}
                style={styles.goalCard}
              >
                <MaterialIcons
                  name={goal === 'Lose Weight' ? 'monitor-weight' : goal === 'Gain Muscle' ? 'fitness-center' : 'bolt'}
                  size={20}
                  color="#f97316"
                />
                <AnimatedText variant="h4" delay={350 + i * 100}>{goal}</AnimatedText>
                <AnimatedText variant="caption" delay={400 + i * 100} style={styles.cardSub}>
                  {totals.mealCount} meals logged today
                </AnimatedText>
              </Animated.View>
            ))}
          </ScrollView>
  
          {/* Macros — real data */}
          <Animated.View 
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.macrosRow}
          >
            {[
              { label: "Carbs", value: `${Math.round(totals.carbs)}g`, color: "#60a5fa", delay: 450 },
              { label: "Protein", value: `${Math.round(totals.protein)}g`, color: "#4ade80", delay: 500 },
              { label: "Fat", value: `${Math.round(totals.fat)}g`, color: "#facc15", delay: 550 },
            ].map((m) => (
              <Animated.View 
                key={m.label}
                entering={FadeInDown.delay(m.delay).duration(300).springify()}
                style={styles.macroCard}
              >
                <View style={[styles.macroBar, { backgroundColor: m.color }]} />
                <AnimatedText variant="h3" delay={m.delay + 50}>{m.value}</AnimatedText>
                <AnimatedText variant="caption" delay={m.delay + 100}>{m.label}</AnimatedText>
              </Animated.View>
            ))}
          </Animated.View>
  
          {/* Quick Log */}
          <Animated.View 
            entering={FadeInDown.delay(600).duration(400).springify()}
            style={styles.card}
          >
            <AnimatedText variant="h3" delay={650}>Quick Log</AnimatedText>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="search" size={20} color="#94a3b8" />
              <TextInput
                placeholder="What did you eat?"
                style={[styles.input, { fontSize: 16, fontWeight: '400' }]}
                placeholderTextColor="#94a3b8"
                value={mealInput}
                onChangeText={setMealInput}
                editable={!loading}
              />
            </View>
            {/* Live predictive dropdown */}
            {(searchResults.length > 0 || searching) && mealInput.trim().length >= 2 && (
              <View style={styles.dropdown}>
                {searching && searchResults.length === 0 && (
                  <View style={styles.dropdownLoading}>
                    <ActivityIndicator color="#137fec" size="small" />
                    <AnimatedText variant="caption" style={styles.dropdownLoadingText}>
                      Searching...
                    </AnimatedText>
                  </View>
                )}
                {searchResults.map((food) => (
                  <AnimatedPressableComponent
                    key={food.food_id}
                    style={styles.dropdownRow}
                    onPress={() => handleSelectFatSecretFood(food)}
                  >
                    <MaterialIcons name="restaurant-menu" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <AnimatedText variant="body" style={styles.dropdownFoodName}>
                        {food.food_name}
                      </AnimatedText>
                      {food.brand_name ? (
                        <AnimatedText variant="caption" style={styles.brandName}>
                          {food.brand_name}
                        </AnimatedText>
                      ) : null}
                      {food.food_description ? (
                        <AnimatedText variant="caption" style={styles.dropdownDesc}>
                          {food.food_description}
                        </AnimatedText>
                      ) : null}
                    </View>
                    <AnimatedText variant="h4" style={styles.dropdownKcal}>
                      {food.calories} kcal
                    </AnimatedText>
                  </AnimatedPressableComponent>
                ))}
                {searching && searchResults.length > 0 && (
                  <View style={styles.dropdownLoadingInline}>
                    <ActivityIndicator color="#137fec" size="small" />
                  </View>
                )}
              </View>
            )}

            <AnimatedPressableComponent
              style={styles.addButton}
              onPress={handleAddMeal}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <AnimatedText variant="button" delay={700} style={styles.addText}>
                    {isFatSecretConfigured() ? "Search" : "Add"}
                  </AnimatedText>
                </>
              )}
            </AnimatedPressableComponent>
          </Animated.View>
  
          {/* Recent Meals */}
          <AnimatedText variant="h3" delay={750} style={styles.sectionTitle}>
            Recent Meals {meals.length > 0 ? `(${meals.length})` : ""}
          </AnimatedText>
  
          {meals.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="restaurant" size={40} color="#cbd5e1" />
              <AnimatedText variant="caption" style={styles.emptyText}>No meals logged today. Use Quick Log above!</AnimatedText>
            </View>
          )}

          {meals.map((meal, index) => (
            <AnimatedPressableComponent
              key={meal.id ?? `meal-${index}`}
              style={styles.mealRow}
              onLongPress={() => {
                Alert.alert("Delete meal?", `Remove "${meal.foodName}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => handleDeleteMeal(meal.id) },
                ]);
              }}
            >
              <MaterialIcons name="restaurant" size={24} color="#f97316" />
              <View style={{ flex: 1 }}>
                <AnimatedText variant="body" style={styles.mealName}>{meal.foodName}</AnimatedText>
                <AnimatedText variant="caption" style={styles.mealMeta}>
                  {meal.mealType} · P {Math.round(meal.protein)}g · C {Math.round(meal.carbs)}g · F {Math.round(meal.fat)}g
                </AnimatedText>
              </View>
              <AnimatedText variant="h4" style={styles.kcal}>{meal.calories} kcal</AnimatedText>
            </AnimatedPressableComponent>
          ))}
        </ScrollView>
      </AnimatedScreen>
    );
  }
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f6f7f8" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      backgroundColor: "#fff",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    logo: {
      marginRight: 4,
    },
    headerText: {
      flex: 1,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
    subtle: { fontSize: 12, color: "#64748b", letterSpacing: 0.2 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#f1f5f9",
      alignItems: "center",
      justifyContent: "center",
    },
    goalCardPrimary: {
      width: 220,
      margin: 16,
      padding: 16,
      backgroundColor: "#e0f2fe",
      borderRadius: 16,
    },
    goalCard: {
      width: 220,
      marginVertical: 16,
      padding: 16,
      backgroundColor: "#fff",
      borderRadius: 16,
    },
    progressBg: {
      height: 6,
      backgroundColor: "#bae6fd",
      borderRadius: 999,
      marginTop: 10,
    },
    progressFill: {
      height: 6,
      backgroundColor: "#137fec",
      borderRadius: 999,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginTop: 8,
      letterSpacing: -0.1,
    },
    cardSub: {
      fontSize: 12,
      color: "#64748b",
      marginTop: 4,
      letterSpacing: 0.1,
    },
    macrosRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 10,
    },
    macroCard: {
      flex: 1,
      backgroundColor: "#fff",
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    macroBar: { width: 32, height: 4, borderRadius: 4 },
    macroValue: { fontWeight: "800", fontSize: 16, letterSpacing: -0.2 },
    macroLabel: { fontSize: 12, color: "#64748b", letterSpacing: 0.1 },
    card: {
      margin: 16,
      padding: 16,
      backgroundColor: "#fff",
      borderRadius: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: "700", margin: 16, letterSpacing: -0.2 },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#f1f5f9",
      padding: 12,
      borderRadius: 12,
    },
    input: { flex: 1 },
    addButton: {
      marginTop: 12,
      backgroundColor: "#137fec",
      padding: 14,
      borderRadius: 12,
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    addText: { color: "#fff", fontWeight: "700" },
    dropdown: {
      marginTop: 8,
      backgroundColor: "#fff",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#e2e8f0",
      maxHeight: 260,
      overflow: "hidden",
    },
    dropdownRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#f1f5f9",
    },
    dropdownFoodName: { fontWeight: "600", fontSize: 14 },
    dropdownDesc: { color: "#94a3b8", fontSize: 11, marginTop: 1 },
    dropdownKcal: { fontWeight: "800", fontSize: 13, color: "#137fec", marginLeft: 8 },
    dropdownLoading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      gap: 8,
    },
    dropdownLoadingText: { color: "#64748b" },
    dropdownLoadingInline: {
      alignItems: "center",
      paddingVertical: 6,
    },
    searchResults: { marginTop: 12 },
    searchResultsTitle: { marginBottom: 8, color: "#64748b" },
    searchResultRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: "#f1f5f9",
      marginBottom: 6,
    },
    brandName: { color: "#64748b", marginTop: 2 },
    mealRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: "#fff",
      padding: 14,
      borderRadius: 14,
    },
    mealName: { fontWeight: "600", letterSpacing: 0 },
    mealMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
    kcal: { fontWeight: "800", letterSpacing: -0.2 },
    emptyState: { alignItems: "center", padding: 32, gap: 8 },
    emptyText: { color: "#94a3b8", textAlign: "center" },
  });
  
  