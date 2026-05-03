import { db } from '@/src/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

/** A single logged meal stored in Firestore. */
export interface MealEntry {
  id?: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Firestore server timestamp */
  createdAt?: any;
  /** FatSecret food_id if from FatSecret */
  fatSecretFoodId?: string;
}

/** Daily nutrition totals computed from meals. */
export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

/** Stored daily progress totals keyed by YYYY-MM-DD. */
export type DailyProgressMap = Record<string, DailyTotals>;

function mealsCollection(uid: string) {
  if (!db) throw new Error('Firestore not initialized');
  return collection(db, 'users', uid, 'meals');
}

/** Milliseconds used to sort logged meals (newest first). */
function mealLoggedAtMs(m: MealEntry): number {
  const c = m.createdAt;
  if (c != null) {
    if (typeof c === 'string') {
      const t = Date.parse(c);
      if (Number.isFinite(t)) return t;
    }
    if (typeof c === 'object' && c !== null) {
      const o = c as { toMillis?: () => number; seconds?: number };
      if (typeof o.toMillis === 'function') return o.toMillis();
      if (typeof o.seconds === 'number') return o.seconds * 1000;
    }
  }
  const idNum = Number(m.id);
  return Number.isFinite(idNum) ? idNum : 0;
}

/** Stable order: newest logged first (matches Firestore intent: orderBy createdAt desc). */
export function sortMealsNewestFirst(meals: MealEntry[]): MealEntry[] {
  return [...meals].sort((a, b) => {
    const tb = mealLoggedAtMs(b);
    const ta = mealLoggedAtMs(a);
    if (tb !== ta) return tb - ta;
    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
  });
}

// ===== LOCAL STORAGE FUNCTIONS =====

function getCurrentMonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isDateInCurrentMonth(dateIso: string): boolean {
  return dateIso.startsWith(getCurrentMonthPrefix());
}

function toDailyProgressMap(meals: MealEntry[]): DailyProgressMap {
  const progress: DailyProgressMap = {};

  for (const meal of meals) {
    const key = meal.date;
    if (!progress[key]) {
      progress[key] = { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
    }
    progress[key].calories += meal.calories || 0;
    progress[key].protein += meal.protein || 0;
    progress[key].carbs += meal.carbs || 0;
    progress[key].fat += meal.fat || 0;
    progress[key].mealCount += 1;
  }

  return progress;
}

/**
 * Keep only current-month quick logs/progress in AsyncStorage.
 * This enforces "delete at end of month" automatically on first app use in new month.
 */
async function pruneAndSyncMonthlyData(uid: string): Promise<MealEntry[]> {
  const mealsKey = `${MEALS_STORAGE_KEY}_${uid}`;
  const progressKey = `${PROGRESS_STORAGE_KEY}_${uid}`;

  const data = await AsyncStorage.getItem(mealsKey);
  const meals: MealEntry[] = data ? JSON.parse(data) : [];

  const currentMonthMeals = meals.filter((m) => isDateInCurrentMonth(m.date));
  const progress = toDailyProgressMap(currentMonthMeals);

  await AsyncStorage.setItem(mealsKey, JSON.stringify(currentMonthMeals));
  await AsyncStorage.setItem(progressKey, JSON.stringify(progress));

  return currentMonthMeals;
}

/** Save a meal to local AsyncStorage. */
async function saveMealLocal(uid: string, meal: Omit<MealEntry, 'id' | 'createdAt'>): Promise<string> {
  try {
    const storageKey = `${MEALS_STORAGE_KEY}_${uid}`;
    const progressKey = `${PROGRESS_STORAGE_KEY}_${uid}`;
    const meals = await pruneAndSyncMonthlyData(uid);
    
    const newMeal: MealEntry = {
      ...meal,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    
    meals.unshift(newMeal); // Add to beginning
    await AsyncStorage.setItem(storageKey, JSON.stringify(meals));
    await AsyncStorage.setItem(progressKey, JSON.stringify(toDailyProgressMap(meals)));
    console.log('✅ Meal saved to local storage:', newMeal.id);
    return newMeal.id;
  } catch (e) {
    console.error('Failed to save meal locally:', e);
    throw e;
  }
}

/** Get meals for a specific date from local AsyncStorage. */
async function getMealsByDateLocal(uid: string, date: string): Promise<MealEntry[]> {
  try {
    const meals = await pruneAndSyncMonthlyData(uid);
    // Filter by date, then deterministic sort (storage order alone is unreliable).
    const forDay = meals.filter((m) => m.date === date);
    return sortMealsNewestFirst(forDay);
  } catch (e) {
    console.error('Failed to load meals from local storage:', e);
    return [];
  }
}

/** Delete a meal from local AsyncStorage. */
async function deleteMealLocal(uid: string, mealId: string): Promise<void> {
  try {
    const storageKey = `${MEALS_STORAGE_KEY}_${uid}`;
    const progressKey = `${PROGRESS_STORAGE_KEY}_${uid}`;
    const meals = await pruneAndSyncMonthlyData(uid);
    const filtered = meals.filter(m => m.id !== mealId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
    await AsyncStorage.setItem(progressKey, JSON.stringify(toDailyProgressMap(filtered)));
    console.log('🗑️ Meal deleted from local storage:', mealId);
  } catch (e) {
    console.error('Failed to delete meal locally:', e);
    throw e;
  }
}

/** Save a meal entry (uses local storage for now). */
export async function saveMeal(uid: string, meal: Omit<MealEntry, 'id' | 'createdAt'>): Promise<string> {
  // Use local storage instead of Firestore
  return await saveMealLocal(uid, meal);
  
  /* Firestore version (disabled due to permissions):
  const ref = await addDoc(mealsCollection(uid), {
    ...meal,
    createdAt: Timestamp.now(),
  });
  return ref.id;
  */
}

/** Get all meals for a user on a given date (uses local storage for now). */
export async function getMealsByDate(uid: string, date: string): Promise<MealEntry[]> {
  // Use local storage instead of Firestore
  return await getMealsByDateLocal(uid, date);
  
  /* Firestore version (disabled due to permissions):
  const q = query(
    mealsCollection(uid),
    where('date', '==', date),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as MealEntry[];
  */
}

/** Get persisted daily progress (current month only). */
export async function getDailyProgress(uid: string, date: string): Promise<DailyTotals> {
  try {
    const progressKey = `${PROGRESS_STORAGE_KEY}_${uid}`;
    // Ensure month rollover cleanup has happened first.
    await pruneAndSyncMonthlyData(uid);
    const data = await AsyncStorage.getItem(progressKey);
    const progress: DailyProgressMap = data ? JSON.parse(data) : {};
    return progress[date] || { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
  } catch (e) {
    console.error('Failed to load daily progress from local storage:', e);
    return { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
  }
}

/** Delete a meal entry (uses local storage for now). */
export async function deleteMeal(uid: string, mealId: string): Promise<void> {
  // Use local storage instead of Firestore
  await deleteMealLocal(uid, mealId);
  
  /* Firestore version (disabled due to permissions):
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'users', uid, 'meals', mealId));
  */
}

/** Compute daily totals from a list of meals. */
export function computeDailyTotals(meals: MealEntry[]): DailyTotals {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
      mealCount: acc.mealCount + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 },
  );
}

/** Default daily targets (can later be stored per-user in Firestore). */
export const DEFAULT_TARGETS = {
  calories: 2200,
  protein: 180,
  carbs: 200,
  fat: 60,
};

const MEALS_STORAGE_KEY = 'saved_meals';
const PROGRESS_STORAGE_KEY = 'daily_progress';
