import {
  isNutritionApiConfigured,
  callBackend,
  NUTRITION_API_BASE_URL,
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
  /** Some gateways or older payloads mirror macros here */
  final_macros?: NutritionMacros;
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
  /** Wrapped payload from some proxies */
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function _isMacroRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Lowercase keys so gateways / serializers that emit `Protein` still parse. */
function _canonicalMacroBag(bag: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bag)) {
    const lk = k.trim().toLowerCase();
    if (lk) out[lk] = v;
  }
  return out;
}

/** Parse API numbers that may arrive as floats or numeric strings from Python / proxies. */
function _coerceNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function _field(
  bag: Record<string, unknown>,
  root: NutritionEstimateResponse,
  nestedKeys: string[],
  rootKeys: string[],
): number {
  for (const k of nestedKeys) {
    const v = bag[k];
    if (v !== undefined && v !== null) return _coerceNumber(v);
  }
  for (const k of rootKeys) {
    const v = (root as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) return _coerceNumber(v);
  }
  return 0;
}

/** Pull flat macros for simple-LMM, layered pipeline, flat, or loosely wrapped responses. */
function normaliseMacros(raw: NutritionEstimateResponse): NutritionMacros {
  const root = raw as Record<string, unknown>;
  let bag: Record<string, unknown> = {};

  if (_isMacroRecord(raw.macros)) bag = _canonicalMacroBag(raw.macros as Record<string, unknown>);
  else if (_isMacroRecord(raw.final_macros))
    bag = _canonicalMacroBag(raw.final_macros as Record<string, unknown>);
  else if (raw.data != null && _isMacroRecord(raw.data)) {
    const d = raw.data as Record<string, unknown>;
    if (_isMacroRecord(d.macros)) bag = _canonicalMacroBag(d.macros as Record<string, unknown>);
    else if (_isMacroRecord(d.final_macros))
      bag = _canonicalMacroBag(d.final_macros as Record<string, unknown>);
  }

  const r = raw;
  return {
    calories: Math.round(
      _field(bag, r, ['calories', 'kcal'], ['calories', 'kcal'])
    ),
    protein: Math.round(
      _field(bag, r, ['protein', 'protein_g'], ['protein', 'protein_g'])
    ),
    carbs: Math.round(
      _field(bag, r, ['carbs', 'carbohydrates', 'carbs_g'], ['carbs', 'carbs_g'])
    ),
    fat: Math.round(
      _field(bag, r, ['fat', 'fat_g', 'lipid'], ['fat', 'fat_g'])
    ),
    fiber: Math.round(
      _field(bag, r, ['fiber', 'fiber_g'], ['fiber', 'fiber_g'])
    ),
  };
}

/** User-facing summary of saved estimate — matches integers written to meal store. */
export function formatMacrosForLogConfirmation(macros: NutritionMacros): string {
  const c = Math.round(macros.calories ?? 0);
  const p = Math.round(macros.protein ?? 0);
  const carbs = Math.round(macros.carbs ?? 0);
  const f = Math.round(macros.fat ?? 0);
  return `${c} cal · ${p} g protein · ${carbs} g carbs · ${f} g fat`;
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

/** Matches server ``_CARB_SNACK_OR_DRINK_EXEMPT`` — drinks/candy may be near-zero P/F. */
const CARB_SNACK_OR_DRINK_EXEMPT =
  /\b(?:soda|soft drink|pop|cola|pepsi|sprite|fanta|dr pepper|mountain dew|juice|lemonade|sweet tea|iced tea|gatorade|powerade|vitaminwater|energy drink|red bull|monster|candy|gumm|skittles|starburst|licorice|jelly beans|sour patch|syrup|maple syrup|agave|honey|molasses|simple syrup|marshmallow|frosting|icing|glucose gel|gu gel)\b/i;

/**
 * True when stated kcal is not explained by protein/carbs/fat (e.g. chat markdown glitches),
 * or when macros are Atwater-consistent but absurd (almost all kcal from carbs, ~no P/F).
 *
 * ``userContext`` — optional meal description; used to exempt explicit soda/juice/candy logs.
 */
export function isImplausibleMacros(macros: NutritionMacros, userContext = ''): boolean {
  const cal = macros.calories ?? 0;
  const p = macros.protein ?? 0;
  const c = macros.carbs ?? 0;
  const f = macros.fat ?? 0;
  const mk = p * 4 + c * 4 + f * 9;

  if (cal >= 120 && p < 1 && f < 1 && c >= 35) {
    const carbKcal = 4 * c;
    if (carbKcal / cal > 0.82 && !CARB_SNACK_OR_DRINK_EXEMPT.test(userContext)) {
      return true;
    }
  }

  if (cal < 55) return false;
  if (cal > 80 && mk < 25) return true;
  if (cal > 0 && mk < 0.22 * cal) return true;
  if (mk > 1.38 * cal + 100) return true;
  return false;
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

function isLikelyNetworkOrTransportError(err: any): boolean {
  const msg = typeof err?.message === 'string' ? err.message : String(err ?? '');
  const low = msg.toLowerCase();
  if (low.includes('network request failed')) return true;
  if (low.includes('failed to fetch')) return true;
  if (low.includes('network error')) return true;
  if (err?.name === 'TypeError' && (low.includes('fetch') || low.includes('network'))) return true;
  return false;
}

export function userMessageForError(err: any): string {
  const status = err?.status;
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 429) return "You're making requests too fast. Wait a moment.";
  if (status === 502) return "Couldn't analyze this food. Try a more specific description.";
  if (status === 503) {
    const detail = typeof err?.message === 'string' ? err.message.trim() : '';
    if (detail) return detail;
    return 'Service is loading. Try again in a few seconds.';
  }
  if (status === 504) return 'Request timed out. Please try again.';
  if (isLikelyNetworkOrTransportError(err)) {
    const base = String(NUTRITION_API_BASE_URL || '').replace(/\/$/, '');
    const isLocalhost = /127\.0\.0\.1|localhost/i.test(base);
    const hint = isLocalhost
      ? " On a phone or simulator, use your computer's LAN IP in EXPO_PUBLIC_NUTRITION_API_URL (see apps/culin-ai-app/.env.example), not localhost."
      : ' If you use a custom API URL, confirm the server is running and reachable from this device.';
    return `Could not reach the nutrition service. Check Wi‑Fi and VPN.${hint} If you use Expo Tunnel, run \`npx expo start --lan\` (or set EXPO_PUBLIC_NUTRITION_API_URL to your computer's LAN IP) so the phone can reach a local server.`;
  }
  return err?.message || 'Something went wrong. Please try again.';
}

/** Which step failed inside Estimate & log (home quick log). */
export type QuickMealLogPhase = 'estimate' | 'save_meal' | 'refresh_totals';

/**
 * Structured diagnostics when quick meal logging fails. Uses console.error so
 * output still appears in release builds (see app/_layout.tsx).
 */
export function logQuickMealLogFailure(
  err: unknown,
  meta: {
    uid?: string;
    descriptionSnippet?: string;
    phase: QuickMealLogPhase;
  },
): void {
  const e = err as ApiError & { name?: string };
  const base = String(NUTRITION_API_BASE_URL || '').replace(/\/$/, '');
  console.error('[CulinAI][QuickMealLog]', {
    ts: new Date().toISOString(),
    phase: meta.phase,
    uid: meta.uid,
    descriptionSnippet: meta.descriptionSnippet,
    nutritionEstimateUrl: `${base}/estimate-from-text`,
    apiStatus: e?.status,
    apiStage: e?.stage,
    errorName: e?.name,
    message: typeof e?.message === 'string' ? e.message : String(err),
  });
}

/* ── POST /estimate-from-text (primary) ───────────────────────────── */

/**
 * Nutrition estimation hits Gemini + layered pipeline; production logs often show
 * 25–35s latency when Layer 0 retries or falls back. Keep FatSecret/default API
 * calls on the shorter callBackend default (15s).
 */
const ESTIMATE_TIMEOUT_MS = 90_000;

/** Defeat any intermediary cache; each request must be unique. */
const ESTIMATE_EXTRA_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
} as const;

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
    callBackend<NutritionEstimateResponse>('/estimate-from-text', {
      body,
      params: { _cb: Date.now() },
      timeoutMs: ESTIMATE_TIMEOUT_MS,
      cache: 'no-store',
      extraHeaders: { ...ESTIMATE_EXTRA_HEADERS },
    }),
  );

  const macros = normaliseMacros(raw);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const r = raw as Record<string, unknown>;
    console.warn('[CulinAI][nutrition:estimate-from-text]', {
      apiBase: NUTRITION_API_BASE_URL,
      textPreview: body.text.slice(0, 60),
      macros,
      confidence: r.confidence,
    });
  }
  return { raw, macros };
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
    callBackend<NutritionEstimateResponse>('/estimate', {
      body,
      params: { _cb: Date.now() },
      timeoutMs: ESTIMATE_TIMEOUT_MS,
      cache: 'no-store',
      extraHeaders: { ...ESTIMATE_EXTRA_HEADERS },
    }),
  );

  return { raw, macros: normaliseMacros(raw) };
}
