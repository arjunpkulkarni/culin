/**
 * AWS App Runner backend:
 * - Nutrition estimation engine (POST /estimate, POST /estimate-from-text)
 * - FatSecret proxy (GET /food/search, POST /food/log, etc.)
 */
export const NUTRITION_API_BASE_URL =
  process.env.EXPO_PUBLIC_NUTRITION_API_URL || 'https://vxxxsgeazd.us-east-2.awsapprunner.com';

export const FATSECRET_API_BASE_URL =
  process.env.EXPO_PUBLIC_FATSECRET_API_URL || NUTRITION_API_BASE_URL;

export const isNutritionApiConfigured = () =>
  Boolean(NUTRITION_API_BASE_URL && NUTRITION_API_BASE_URL.startsWith('http'));

export const isFatSecretConfigured = () =>
  Boolean(FATSECRET_API_BASE_URL && FATSECRET_API_BASE_URL.startsWith('http'));

/* ── Cognito token store + refresh ────────────────────────────────── */

let _accessToken: string | null = null;
let _tokenRefresher: (() => Promise<string>) | null = null;

/** Called by AuthContext whenever the Cognito session is established or refreshed. */
export function setNutritionApiToken(token: string | null) {
  _accessToken = token;
}

/**
 * Called once by AuthContext to register a callback that forces a Cognito
 * session refresh and returns the *new* access token directly (no React
 * state round-trip needed).
 */
export function setTokenRefresher(fn: () => Promise<string>) {
  _tokenRefresher = fn;
}

function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token ?? _accessToken;
  if (t) headers['Authorization'] = `Bearer ${t}`;
  return headers;
}

/** Kept for any call-site that only needs headers (e.g. a plain GET). */
export function getAuthHeaders(): Record<string, string> {
  return authHeaders();
}

/* ── Structured API error ─────────────────────────────────────────── */

export interface ApiError {
  status: number;
  message: string;
  stage: string | null;
}

async function buildError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({}));
  // `detail` can be a string or a nested object like { code, message }
  const detail = body.detail;
  const msg =
    (typeof detail === 'string' ? detail : detail?.message) ||
    body.message ||
    'Something went wrong';
  return {
    status: response.status,
    message: msg,
    stage: body.stage || null,
  };
}

/* ── callBackend — single entry-point for all backend requests ────── */

const DEFAULT_TIMEOUT_MS = 15_000;

export interface CallBackendOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number>;
  /** Per-request timeout in ms (default 15 000). */
  timeoutMs?: number;
}

/** Create an AbortController that auto-aborts after `ms`. */
function timeoutController(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

/**
 * Authenticated fetch wrapper for the nutrition / food backend.
 *
 * - Attaches the Cognito access token as a Bearer header.
 * - Enforces a 15 s timeout (configurable per-call).
 * - On 401: refreshes the token via Cognito and retries once.
 * - On non-OK: throws a structured `ApiError`.
 */
export async function callBackend<T = unknown>(
  endpoint: string,
  options: CallBackendOptions = {},
): Promise<T> {
  const { method = 'POST', body, params, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const base = NUTRITION_API_BASE_URL.replace(/\/$/, '');

  let url = `${base}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    url += `?${qs}`;
  }

  const timer = timeoutController(timeoutMs);

  try {
    const fetchOpts: RequestInit = {
      method,
      headers: authHeaders(),
      signal: timer.signal,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    };

    const response = await fetch(url, fetchOpts);

    // 401 — token may have expired mid-session; refresh and retry once
    if (response.status === 401 && _tokenRefresher) {
      try {
        const freshToken = await _tokenRefresher();
        _accessToken = freshToken;

        const retryTimer = timeoutController(timeoutMs);
        try {
          const retry = await fetch(url, {
            ...fetchOpts,
            headers: authHeaders(freshToken),
            signal: retryTimer.signal,
          });
          if (!retry.ok) throw await buildError(retry);
          return (await retry.json()) as T;
        } finally {
          retryTimer.clear();
        }
      } catch (refreshErr: any) {
        if (refreshErr.status) throw refreshErr;
        throw { status: 401, message: 'Session expired. Please sign in again.', stage: null } as ApiError;
      }
    }

    if (!response.ok) throw await buildError(response);
    return (await response.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw { status: 504, message: 'Request timed out. Please try again.', stage: null } as ApiError;
    }
    throw err;
  } finally {
    timer.clear();
  }
}
