/**
 * Nutrition Goals Algorithm (MVP)
 * Mifflin-St Jeor BMR → TDEE → macro targets
 *
 * All internal calculations use metric units (kg, cm).
 * Callers may supply imperial values — pass `heightUnit` / `weightUnit`
 * and the utility converts before computing.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Sex = 'M' | 'F' | 'unknown';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
export type GoalType = 'cut' | 'maintain' | 'bulk';
export type GoalPace = 'mild' | 'normal' | 'aggressive';
export type HeightUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';

export interface NutritionGoalInput {
  /** Height value — unit specified by heightUnit (default 'cm') */
  height: number;
  /** Weight value — unit specified by weightUnit (default 'kg') */
  weight: number;
  /** Age in years. If omitted, defaults to 22. */
  age?: number;
  sex?: Sex;
  activityLevel?: ActivityLevel;
  goal: GoalType;
  goalPace?: GoalPace;
  heightUnit?: HeightUnit;
  weightUnit?: WeightUnit;
}

export interface NutritionGoalResult {
  /** Recommended daily calories */
  calories: number;
  /** Protein in grams */
  protein: number;
  /** Carbohydrates in grams */
  carbs: number;
  /** Fat in grams */
  fat: number;
  /** Estimated BMR (kcal) */
  bmr: number;
  /** Estimated TDEE (kcal) */
  tdee: number;
  /** Weight used internally (kg) */
  weightKg: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

const CALORIE_DELTA: Record<GoalType, Record<GoalPace, number>> = {
  cut: {
    mild: -300,
    normal: -500,
    aggressive: -700,
  },
  maintain: {
    mild: 0,
    normal: 0,
    aggressive: 0,
  },
  bulk: {
    mild: 200,
    normal: 350,
    aggressive: 500,
  },
};

const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  cut: 2.2,
  maintain: 1.8,
  bulk: 2.0,
};

/** Fat g/kg target (before cap check) */
const FAT_G_PER_KG_TARGET = 0.8;
const FAT_G_PER_KG_MIN = 0.6;
const FAT_CAL_CAP_RATIO = 0.35; // 35 % of total calories

// ─── Unit Conversion ─────────────────────────────────────────────────────────

function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / 2.2046 : value;
}

function toCm(value: number, unit: HeightUnit): number {
  return unit === 'in' ? value * 2.54 : value;
}

// ─── BMR (Mifflin-St Jeor) ───────────────────────────────────────────────────

function calcBMR(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const sexOffset = sex === 'M' ? 5 : sex === 'F' ? -161 : -78; // -78 = midpoint of +5 and -161
  return base + sexOffset;
}

// ─── Main Algorithm ───────────────────────────────────────────────────────────

export function calculateNutritionGoals(input: NutritionGoalInput): NutritionGoalResult {
  const {
    height,
    weight,
    age = 22,
    sex = 'unknown',
    activityLevel = 'moderate',
    goal,
    goalPace = 'normal',
    heightUnit = 'cm',
    weightUnit = 'kg',
  } = input;

  // 1. Convert units
  const weightKg = toKg(weight, weightUnit);
  const heightCm = toCm(height, heightUnit);

  // 2. BMR
  const bmr = calcBMR(weightKg, heightCm, age, sex);

  // 3. TDEE
  const multiplier = ACTIVITY_MULTIPLIER[activityLevel];
  const tdee = bmr * multiplier;

  // 4. Target calories
  const delta = CALORIE_DELTA[goal][goalPace];
  const minCalories = bmr * 1.2; // safety floor on a cut
  const rawCalories = tdee + delta;
  const calories = Math.max(Math.round(rawCalories), goal === 'cut' ? Math.round(minCalories) : Math.round(rawCalories));

  // 5. Protein
  const proteinG = Math.round(PROTEIN_G_PER_KG[goal] * weightKg);

  // 6. Fat — target g/kg, then cap to 35 % of calories
  let fatG = FAT_G_PER_KG_TARGET * weightKg;
  const fatCalCap = FAT_CAL_CAP_RATIO * calories;
  if (fatG * 9 > fatCalCap) {
    fatG = fatCalCap / 9;
  }
  fatG = Math.round(fatG);

  // 7. Carbs from remainder
  let carbCal = calories - (proteinG * 4 + fatG * 9);

  // If carbs go negative: reduce fat first, then protein slightly
  if (carbCal < 0) {
    // Try reducing fat to minimum
    const fatMin = FAT_G_PER_KG_MIN * weightKg;
    fatG = Math.round(fatMin);
    carbCal = calories - (proteinG * 4 + fatG * 9);

    // If still negative, shave protein (up to 10 % reduction)
    if (carbCal < 0) {
      const proteinMin = Math.round(proteinG * 0.9);
      carbCal = calories - (proteinMin * 4 + fatG * 9);

      // Accept the reduced protein; carbs floor at 0
      return {
        calories,
        protein: carbCal < 0 ? proteinMin : proteinG,
        carbs: Math.max(0, Math.round(carbCal < 0 ? 0 : carbCal / 4)),
        fat: fatG,
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        weightKg: Math.round(weightKg * 10) / 10,
      };
    }
  }

  const carbsG = Math.max(0, Math.round(carbCal / 4));

  return {
    calories,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    weightKg: Math.round(weightKg * 10) / 10,
  };
}
