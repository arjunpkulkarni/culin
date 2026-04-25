# Frontend API – Connect Your App to the Backend

Use this backend as the **single base URL** for nutrition estimation and food search/log. No API keys or secrets in the frontend; the backend holds them.

---

## Base URL and CORS

- **Base URL:** Set in your frontend env (e.g. `REACT_APP_API_URL` or `VITE_API_URL`).
  - Local: `http://localhost:8000`
  - Production: `https://api.nutrition-engine.culin.ai` (DigitalOcean)
- **CORS:** Backend uses `CORS_ORIGINS` (comma-separated or `*`). Set it to your frontend origin(s) in production (e.g. `https://myapp.com,https://www.myapp.com`). For local dev, `*` is fine.

---

## 1. Estimate nutrition (main flow)

**POST** `/estimate`

**Headers:** `Content-Type: application/json`

**Body (JSON):**

| Field         | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `item_name`   | string  | yes      | Dish/item name |
| `description` | string  | yes      | Description or ingredients text |
| `restaurant`  | string  | no       | Restaurant/chain (improves Layer 2 calibration) |
| `price`       | number  | no       | Price (optional signal) |
| `modifiers`   | string[]| no       | e.g. `["extra cheese"]` |

**Example request:**

```json
{
  "item_name": "Grilled Chicken Salad",
  "description": "Mixed greens with grilled chicken, tomatoes, cucumber",
  "restaurant": "Cafe Fresh",
  "price": 12.99,
  "modifiers": ["extra cheese"]
}
```

**Response (200):**

```json
{
  "macros": {
    "calories": 420,
    "fat": 18,
    "carbs": 35,
    "protein": 32,
    "sodium": 480
  },
  "confidence": 0.82,
  "debug": {
    "layer2_adjustments": {},
    "layer3_refinements": {}
  }
}
```

**Example (fetch):**

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

async function estimateNutrition(itemName, description, restaurant = null, price = null, modifiers = null) {
  const res = await fetch(`${API_URL}/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_name: itemName,
      description: description,
      restaurant: restaurant ?? undefined,
      price: price ?? undefined,
      modifiers: modifiers ?? undefined,
    }),
  });
  if (!res.ok) throw new Error(`Estimate failed: ${res.status}`);
  return res.json();
}
```

---

## 2. Health and readiness

| Endpoint      | Use | Response |
|---------------|-----|----------|
| **GET** `/health` | Liveness (load balancer) | `{ "status": "ok" }` |
| **GET** `/ready`  | Readiness (traffic only when ready) | `{ "status": "ready", "artifacts": { "layer2": "ok", "layer3": "ok" } }` or 503 |

Frontend usually only needs `/estimate` and food endpoints; use `/health` or `/ready` only for admin or debugging.

---

## 3. Food search (FatSecret proxy)

**GET** `/food/search?q=<query>&page=0&max_results=20`

- `q` (required): search text (e.g. "chicken breast").
- `page`: default 0.
- `max_results`: 1–50, default 20.

**Response (200):** `{ "foods": { "food": [ { "food_id", "food_name", "food_description", ... } ] } }`

**Example (fetch):**

```javascript
async function searchFoods(query, page = 0, maxResults = 20) {
  const params = new URLSearchParams({ q: query, page: String(page), max_results: String(maxResults) });
  const res = await fetch(`${API_URL}/food/search?${params}`);
  if (!res.ok) {
    if (res.status === 503) throw new Error('Food search not configured');
    if (res.status === 502) throw new Error((await res.json()).detail || 'Search failed');
    throw new Error(`Search failed: ${res.status}`);
  }
  return res.json();
}
```

---

## 4. Log food (FatSecret diary)

**POST** `/food/log`

**Body (JSON):**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `food_id`      | string | yes      | From search result |
| `food_name`    | string | yes      | From search result |
| `meal_type`    | string | no       | "Breakfast", "Lunch", "Dinner" (default "Lunch") |
| `number_units` | number | no       | Servings (default 1) |
| `serving_id`   | string | no       | From food servings if needed |
| `date`         | string | no       | YYYY-MM-DD (default today) |

**Example (fetch):**

```javascript
async function logFood(entry) {
  const res = await fetch(`${API_URL}/food/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      food_id: entry.foodId,
      food_name: entry.foodName,
      meal_type: entry.mealType || 'Lunch',
      number_units: entry.numberUnits ?? 1,
      serving_id: entry.servingId || null,
      date: entry.date || null,
    }),
  });
  if (!res.ok) {
    if (res.status === 503) throw new Error('Food log not configured');
    if (res.status === 502) throw new Error((await res.json()).detail || 'Log failed');
    throw new Error(`Log failed: ${res.status}`);
  }
  return res.json();
}
```

---

## 5. Error summary

| Status | Meaning |
|--------|--------|
| **422** | Validation error (missing/invalid body or params). |
| **502** | Backend got an error from FatSecret (search/log). |
| **503** | FatSecret not configured on backend (search/log return 503 until env is set). |

---

## 6. Frontend env (what you set)

- **Backend base URL:** e.g. `REACT_APP_API_URL=https://your-backend-url` (or `http://localhost:8000` for dev).
- No FatSecret keys or any backend secrets in the frontend; all auth and keys stay on the backend.
