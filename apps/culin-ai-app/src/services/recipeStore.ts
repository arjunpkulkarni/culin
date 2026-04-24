import { db } from '@/src/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
  limit,
} from 'firebase/firestore';

/** A saved recipe from AI generation. */
export interface SavedRecipe {
  id?: string;
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mode: 'cook' | 'order';
  prompt: string;
  ingredients: string[];
  instructions: string[];
  aiDescription: string;
  instacartLink?: string;
  restaurant?: string;
  prepTime?: number;
  cost?: number;
  difficulty?: string;
  deliveryTime?: number;
  complexity: number;
  /** Firestore server timestamp or ISO string for local storage */
  createdAt?: any;
}

const RECIPES_STORAGE_KEY = 'saved_recipes';

function recipesCollection(uid: string) {
  if (!db) throw new Error('Firestore not initialized');
  return collection(db, 'users', uid, 'recipes');
}

// ===== LOCAL STORAGE FUNCTIONS =====

/** Save a recipe to local AsyncStorage. */
async function saveRecipeLocal(
  uid: string,
  recipe: Omit<SavedRecipe, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const storageKey = `${RECIPES_STORAGE_KEY}_${uid}`;
    const existingData = await AsyncStorage.getItem(storageKey);
    const recipes: SavedRecipe[] = existingData ? JSON.parse(existingData) : [];
    
    const newRecipe: SavedRecipe = {
      ...recipe,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    
    recipes.unshift(newRecipe); // Add to beginning
    await AsyncStorage.setItem(storageKey, JSON.stringify(recipes));
    console.log('✅ Recipe saved to local storage:', newRecipe.id);
    return newRecipe.id;
  } catch (e) {
    console.error('Failed to save recipe locally:', e);
    throw e;
  }
}

/** Get all saved recipes from local AsyncStorage. */
async function getSavedRecipesLocal(uid: string, maxResults = 50): Promise<SavedRecipe[]> {
  try {
    const storageKey = `${RECIPES_STORAGE_KEY}_${uid}`;
    const data = await AsyncStorage.getItem(storageKey);
    if (!data) return [];
    
    const recipes: SavedRecipe[] = JSON.parse(data);
    return recipes.slice(0, maxResults);
  } catch (e) {
    console.error('Failed to load recipes from local storage:', e);
    return [];
  }
}

/** Delete a saved recipe from local AsyncStorage. */
async function deleteRecipeLocal(uid: string, recipeId: string): Promise<void> {
  try {
    const storageKey = `${RECIPES_STORAGE_KEY}_${uid}`;
    const data = await AsyncStorage.getItem(storageKey);
    if (!data) return;
    
    const recipes: SavedRecipe[] = JSON.parse(data);
    const filtered = recipes.filter(r => r.id !== recipeId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
    console.log('🗑️ Recipe deleted from local storage:', recipeId);
  } catch (e) {
    console.error('Failed to delete recipe locally:', e);
    throw e;
  }
}

/** Save a recipe (uses local storage for now). */
export async function saveRecipe(
  uid: string,
  recipe: Omit<SavedRecipe, 'id' | 'createdAt'>
): Promise<string> {
  // Use local storage instead of Firestore
  return await saveRecipeLocal(uid, recipe);
  
  /* Firestore version (disabled due to permissions):
  const ref = await addDoc(recipesCollection(uid), {
    ...recipe,
    createdAt: Timestamp.now(),
  });
  console.log('✅ Recipe saved to Firestore:', ref.id);
  return ref.id;
  */
}

/** Get all saved recipes for a user (uses local storage for now). */
export async function getSavedRecipes(uid: string, maxResults = 50): Promise<SavedRecipe[]> {
  // Use local storage instead of Firestore
  return await getSavedRecipesLocal(uid, maxResults);
  
  /* Firestore version (disabled due to permissions):
  const q = query(
    recipesCollection(uid),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as SavedRecipe[];
  */
}

/** Delete a saved recipe (uses local storage for now). */
export async function deleteRecipe(uid: string, recipeId: string): Promise<void> {
  // Use local storage instead of Firestore
  await deleteRecipeLocal(uid, recipeId);
  
  /* Firestore version (disabled due to permissions):
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'users', uid, 'recipes', recipeId));
  console.log('🗑️ Recipe deleted:', recipeId);
  */
}
