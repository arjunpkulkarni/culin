import fetch from 'node-fetch';

export interface InstacartLineItemMeasurement {
  quantity?: number;
  unit?: string;
}

export interface InstacartLineItemFilter {
  brand_filters?: string[];
  health_filters?: string[];
}

export interface InstacartRecipeLineItem {
  name: string;
  display_text?: string;
  product_ids?: number[];
  upcs?: string[];
  measurements?: InstacartLineItemMeasurement[];
  filters?: InstacartLineItemFilter;
}

export interface CreateRecipePageRequestBody {
  title: string;
  image_url?: string;
  author?: string;
  servings?: number;
  cooking_time?: number;
  external_reference_id?: string;
  content_creator_credit_info?: string;
  expires_in?: number;
  instructions?: string[];
  ingredients: InstacartRecipeLineItem[];
  landing_page_configuration?: {
    partner_linkback_url?: string;
    enable_pantry_items?: boolean;
  };
}

export interface CreateRecipePageResponseBody {
  products_link_url: string;
}

const DEFAULT_BASE_URL = 'https://connect.instacart.com';
const DEV_BASE_URL = 'https://connect.dev.instacart.tools';
const API_KEY = process.env.INSTACART_API_KEY ?? '';

/** Prevent Instacart from blocking chat completion when the API is slow or hanging. */
const INSTACART_FETCH_TIMEOUT_MS = 20_000;

const UNIT_MAP: Record<string, string> = {
  g: 'gram',
  gram: 'gram',
  grams: 'gram',
  kg: 'kilogram',
  kilogram: 'kilogram',
  kilograms: 'kilogram',
  ml: 'milliliter',
  milliliter: 'milliliter',
  milliliters: 'milliliter',
  l: 'liter',
  liter: 'liter',
  liters: 'liter',
  tsp: 'teaspoon',
  teaspoon: 'teaspoon',
  teaspoons: 'teaspoon',
  tbsp: 'tablespoon',
  tablespoon: 'tablespoon',
  tablespoons: 'tablespoon',
  oz: 'ounce',
  ounce: 'ounce',
  ounces: 'ounce',
  lb: 'pound',
  pound: 'pound',
  pounds: 'pound',
  each: 'each',
  unit: 'each',
};

function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return undefined;
  const key = unit.toLowerCase().trim();
  return UNIT_MAP[key] || undefined;
}

export async function createInstacartRecipePage(body: CreateRecipePageRequestBody, options?: { baseUrl?: string }): Promise<CreateRecipePageResponseBody | null> {
  if (!API_KEY) {
    console.warn('Instacart: Missing INSTACART_API_KEY. Skipping recipe link creation.');
    return null;
  }

  const tryPost = async (baseUrl: string) => {
    const url = `${baseUrl}/idp/v1/products/recipe`;
    console.log('[Instacart] Creating recipe page:', {
      url,
      baseUrl,
      title: body?.title,
      servings: body?.servings,
      instructionsCount: Array.isArray(body?.instructions) ? body.instructions.length : 0,
      ingredientCount: Array.isArray(body?.ingredients) ? body.ingredients.length : 0,
    });
    return fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INSTACART_FETCH_TIMEOUT_MS),
    });
  };

  // Prefer dev first for development keys, then fallback to prod
  let response = await tryPost(options?.baseUrl || DEV_BASE_URL);
  if (response.status === 401 || response.status === 403) {
    console.warn(`Instacart API auth error (${response.status}) on dev. Retrying against production environment...`);
    response = await tryPost(DEFAULT_BASE_URL);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error('[Instacart] API error creating recipe page', {
      status: response.status,
      statusText: response.statusText,
      responseText: text,
    });
    return null;
  }

  const data = (await response.json()) as CreateRecipePageResponseBody;
  console.log('[Instacart] Recipe page created successfully:', {
    products_link_url: data?.products_link_url,
  });
  return data;
}

// Lightweight auth check utility (dev retailers endpoint) to validate API key quickly
export async function validateInstacartKeyDev(zip = '94105', country = 'US', baseUrl = DEV_BASE_URL): Promise<boolean> {
  try {
    const url = `${baseUrl}/idp/v1/retailers?postal_code=${encodeURIComponent(zip)}&country_code=${encodeURIComponent(country)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      }
    });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok;
  } catch (e) {
    console.error('Instacart key validation failed:', e);
    return false;
  }
}

// Helper to convert our internal recipe format to Instacart recipe request
export function buildInstacartRecipePayload(params: {
  title: string;
  servings?: number;
  instructions?: string[];
  ingredients: Array<{ item: string; amount?: number; unit?: string }>;
  linkbackUrl?: string;
}): CreateRecipePageRequestBody {
  const ingredients: InstacartRecipeLineItem[] = params.ingredients.map((ing) => {
    const normalizedUnit = normalizeUnit(ing.unit);

    const measurements: InstacartLineItemMeasurement[] = [];
    if (ing.amount && normalizedUnit) {
      measurements.push({ quantity: ing.amount, unit: normalizedUnit });
    } else if (ing.amount && !normalizedUnit) {
      // fallback to each if no supported unit
      measurements.push({ quantity: ing.amount, unit: 'each' });
    } else {
      // default one each when quantity missing
      measurements.push({ quantity: 1, unit: 'each' });
    }

    return {
      name: ing.item,
      display_text: ing.item,
      measurements,
    };
  });

  const payload: CreateRecipePageRequestBody = {
    title: params.title,
    servings: params.servings,
    instructions: params.instructions,
    ingredients,
    landing_page_configuration: params.linkbackUrl ? { partner_linkback_url: params.linkbackUrl, enable_pantry_items: true } : { enable_pantry_items: true },
  };

  return payload;
}


