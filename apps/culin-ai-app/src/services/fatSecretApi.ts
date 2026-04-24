import {
  isFatSecretConfigured,
  callBackend,
} from '@/src/config/api';

/**
 * FatSecret food item returned by the `/food/search` proxy.
 */
export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_description?: string;
  brand_name?: string;
  calories: number;
  protein?: number;
  carbohydrate?: number;
  fat?: number;
  serving_size?: string;
  serving_unit?: string;
  servings?: {
    serving_id: string;
    serving_description: string;
    calories: number;
    metric_serving_amount?: string;
    metric_serving_unit?: string;
  }[];
}

/** Body sent to POST /food/log — matches the backend FoodLogRequest schema. */
export interface LogFoodEntryRequest {
  food_id: string;
  food_name: string;
  meal_type?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  number_units?: number;
  serving_id?: string;
  /** YYYY-MM-DD (defaults to today on the backend) */
  date?: string;
}

/* ── Search ───────────────────────────────────────────────────────── */

/**
 * Search the FatSecret database via GET /food/search.
 * Uses callBackend for auth + 401 retry.
 */
export async function searchFoods(
  query: string,
  page = 0,
  maxResults = 20,
): Promise<FatSecretFood[]> {
  if (!isFatSecretConfigured()) {
    console.warn('FatSecret API not configured.');
    return [];
  }

  const q = query.trim();
  if (!q) return [];

  try {
    const data = await callBackend<any>('/food/search', {
      method: 'GET',
      params: { q, page, max_results: maxResults },
    });

    const list = data?.foods?.food ?? data?.foods ?? data?.food ?? [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Food search error:', e);
    throw e;
  }
}

/**
 * Lightweight autocomplete — reuses searchFoods with a smaller page.
 */
export async function autocompleteFoods(query: string): Promise<FatSecretFood[]> {
  if (!isFatSecretConfigured()) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    return await searchFoods(q, 0, 10);
  } catch {
    return [];
  }
}

/* ── Get by ID ────────────────────────────────────────────────────── */

/** Fetch a single food's full details via GET /food/{food_id}. */
export async function getFoodById(foodId: string): Promise<FatSecretFood | null> {
  if (!isFatSecretConfigured()) return null;

  try {
    return await callBackend<FatSecretFood>(`/food/${encodeURIComponent(foodId)}`, {
      method: 'GET',
    });
  } catch (e) {
    console.error('getFoodById error:', e);
    throw e;
  }
}

/* ── Log ──────────────────────────────────────────────────────────── */

/**
 * Log a food entry via POST /food/log.
 */
export async function logFood(entry: LogFoodEntryRequest): Promise<void> {
  if (!isFatSecretConfigured()) {
    throw new Error('FatSecret API not configured.');
  }

  try {
    await callBackend('/food/log', {
      body: {
        food_id: entry.food_id,
        food_name: entry.food_name,
        serving_id: entry.serving_id ?? undefined,
        number_units: entry.number_units ?? 1,
        meal_type: entry.meal_type ?? 'Lunch',
        date: entry.date ?? undefined,
      },
    });
  } catch (e) {
    console.error('Food log error:', e);
    throw e;
  }
}

/* ── Utilities ────────────────────────────────────────────────────── */

export function getDefaultMealType(): 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' {
  const h = new Date().getHours();
  if (h < 10) return 'Breakfast';
  if (h < 14) return 'Lunch';
  if (h < 18) return 'Dinner';
  return 'Snack';
}

export function formatDateForLog(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
