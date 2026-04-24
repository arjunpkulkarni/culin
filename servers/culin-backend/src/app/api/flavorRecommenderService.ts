export interface FlavorPair {
  ingredient_a: string;
  ingredient_b: string;
  pair_score: number;
}

export interface RecommendResponse {
  ingredient_ids: number[];
  ingredient_names: string[];
  pairs: FlavorPair[];
  prompt: string;
}

export async function fetchFlavorRecommendation(
  effects: number[],
  top_n_ingredients: number = 10,
  top_k_pairs: number = 5
): Promise<RecommendResponse | null> {
  const baseUrl = process.env.FLAVOR_RECOMMENDER_BASE_URL || "http://18.222.107.181:8000";
  const url = `${baseUrl}/recommend`;

  try {
    console.log('[FlavorRecommender] POST', url, {
      effectsCount: Array.isArray(effects) ? effects.length : 0,
      top_n_ingredients,
      top_k_pairs
    })
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effects, top_n_ingredients, top_k_pairs }),
      // Avoid Next.js caching for API-to-API server calls
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[FlavorRecommender] Request failed (${res.status}):`, text);
      return null;
    }

    const data = (await res.json()) as RecommendResponse;
    console.log('[FlavorRecommender] OK', {
      ingredientIds: Array.isArray(data?.ingredient_ids) ? data.ingredient_ids.length : 0,
      pairs: Array.isArray(data?.pairs) ? data.pairs.length : 0,
      promptChars: data?.prompt ? data.prompt.length : 0
    })
    return data;
  } catch (err) {
    console.error("[FlavorRecommender] Error calling /recommend:", err);
    return null;
  }
}


