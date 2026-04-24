import {
  isNutritionApiConfigured,
  callBackend,
  type ApiError,
} from '@/src/config/api';

/* ── Request types ────────────────────────────────────────────────── */

/** POST /estimate — structured input */
export interface NutritionEstimateRequest {
  item_name: string;
  description: string;
  restaurant?: string;
  price?: number;
  modifiers?: string[];
  cooking_method?: string;
}

/** POST /estimate-from-text — free-text input (primary endpoint) */
export interface FreeTextEstimateRequest {
  text: string;
  restaurant?: string;
  price?: number;
}

/* ── Response types ───────────────────────────────────────────────── */

export interface NutritionMacros {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
}

export interface NutritionEstimateResponse {
  item_name?: string;
  macros?: NutritionMacros;
  calories?: number;
  protein?: number;
  protein_g?: number;
  carbs?: number;
  carbs_g?: number;
  fat?: number;
  fat_g?: number;
  fiber?: number;
  fiber_g?: number;
  confidence?: number;
  serving_size?: string;
  [key: string]: unknown;
}

/** Pull flat macros regardless of how the API nests them. */
function normaliseMacros(raw: NutritionEstimateResponse): NutritionMacros {
  const m = raw.macros ?? {};
  return {
    calories: Math.round(m.calories ?? raw.calories ?? 0),
    protein:  Math.round(m.protein  ?? raw.protein  ?? raw.protein_g ?? 0),
    carbs:    Math.round(m.carbs    ?? raw.carbs    ?? raw.carbs_g   ?? 0),
    fat:      Math.round(m.fat      ?? raw.fat      ?? raw.fat_g     ?? 0),
    fiber:    Math.round(m.fiber    ?? raw.fiber    ?? raw.fiber_g   ?? 0),
  };
}

/** True when every macro is zero — the engine couldn't match anything. */
export function isZeroEstimate(macros: NutritionMacros): boolean {
  return (
    (macros.calories ?? 0) === 0 &&
    (macros.protein ?? 0) === 0 &&
    (macros.fat ?? 0) === 0 &&
    (macros.carbs ?? 0) === 0
  );
}

/* ── Retry helper for transient errors ────────────────────────────── */

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Wraps a callBackend invocation with status-aware retry:
 *  429 → wait 3 s, retry once
 *  503 → wait 5 s, retry once (cold-start)
 *  504 → retry immediately once (Gemini timeout)
 *  502 → don't retry (bad input)
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const status = (err as ApiError).status;
    if (status === 429) { await delay(3000); return fn(); }
    if (status === 503) { await delay(5000); return fn(); }
    if (status === 504) { return fn(); }
    throw err;
  }
}

/* ── User-facing error messages ───────────────────────────────────── */

export function userMessageForError(err: any): string {
  const status = err?.status;
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 429) return "You're making requests too fast. Wait a moment.";
  if (status === 502) return "Couldn't analyze this food. Try a more specific description.";
  if (status === 503) return 'Service is loading. Try again in a few seconds.';
  if (status === 504) return 'Request timed out. Please try again.';
  return err?.message || 'Something went wrong. Please try again.';
}

/* ── POST /estimate-from-text (primary) ───────────────────────────── */

export async function estimateFromText(
  input: string | FreeTextEstimateRequest,
): Promise<{ raw: NutritionEstimateResponse; macros: NutritionMacros } | null> {
  if (!isNutritionApiConfigured()) {
    console.warn('Nutrition API URL not set.');
    return null;
  }

  const body: FreeTextEstimateRequest =
    typeof input === 'string' ? { text: input.trim() } : input;

  const raw = await withRetry(() =>
    callBackend<NutritionEstimateResponse>('/estimate-from-text', { body }),
  );

  return { raw, macros: normaliseMacros(raw) };
}

/* ── POST /estimate (structured) ──────────────────────────────────── */

export async function estimateNutrition(
  input: string | NutritionEstimateRequest,
): Promise<{ raw: NutritionEstimateResponse; macros: NutritionMacros } | null> {
  if (!isNutritionApiConfigured()) {
    console.warn('Nutrition API URL not set.');
    return null;
  }

  const body: NutritionEstimateRequest =
    typeof input === 'string'
      ? { item_name: input.trim(), description: '' }
      : input;

  const raw = await withRetry(() =>
    callBackend<NutritionEstimateResponse>('/estimate', { body }),
  );

  return { raw, macros: normaliseMacros(raw) };
}
