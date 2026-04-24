/**
 * POST /api/nutrition-goals
 *
 * Computes daily macro targets using the Mifflin-St Jeor BMR algorithm.
 *
 * Requires a valid Cognito Bearer token.
 * All inputs come from the request body — the caller (mobile app, etc.)
 * is expected to supply height/weight directly from their already-loaded profile.
 *
 * NOTE: Web frontend should use the `useNutritionGoals` hook instead —
 * it reads from the already-cached `useUserProfile` state and computes
 * entirely client-side with zero network round-trips.
 *
 * ─── Request body ────────────────────────────────────────────────────────────
 * {
 *   goal:          "cut" | "maintain" | "bulk"          // REQUIRED
 *   height:        number                               // REQUIRED (cm or in)
 *   weight:        number                               // REQUIRED (kg or lb)
 *   goalPace:      "mild" | "normal" | "aggressive"     // default "normal"
 *   activityLevel: "sedentary"|"light"|"moderate"|"very"|"athlete" // default "moderate"
 *   heightUnit:    "cm" | "in"                          // default "cm"
 *   weightUnit:    "kg" | "lb"                          // default "kg"
 *   age:           number                               // default 22
 *   sex:           "M" | "F" | "unknown"                // default "unknown"
 * }
 *
 * ─── Response ────────────────────────────────────────────────────────────────
 * {
 *   success: true,
 *   goals: {
 *     calories: number,
 *     protein:  number,   // grams
 *     carbs:    number,   // grams
 *     fat:      number,   // grams
 *     bmr:      number,
 *     tdee:     number,
 *     weightKg: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/api-auth-middleware';
import {
  calculateNutritionGoals,
  GoalType,
  GoalPace,
  ActivityLevel,
  HeightUnit,
  WeightUnit,
} from '@/lib/nutritionGoals';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];
const VALID_PACES: GoalPace[] = ['mild', 'normal', 'aggressive'];
const VALID_ACTIVITY: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'very', 'athlete'];
const VALID_HEIGHT_UNITS: HeightUnit[] = ['cm', 'in'];
const VALID_WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb'];

function isGoal(v: unknown): v is GoalType {
  return typeof v === 'string' && (VALID_GOALS as string[]).includes(v);
}

// ─── Route handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handler(req: NextRequest, _user: AuthUser) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Required fields ──
  if (!isGoal(body.goal)) {
    return NextResponse.json(
      { error: `"goal" is required and must be one of: ${VALID_GOALS.join(', ')}` },
      { status: 400 }
    );
  }

  const height = body.height as number | undefined;
  const weight = body.weight as number | undefined;

  if (typeof height !== 'number' || height <= 0) {
    return NextResponse.json(
      { error: '"height" is required and must be a positive number' },
      { status: 400 }
    );
  }
  if (typeof weight !== 'number' || weight <= 0) {
    return NextResponse.json(
      { error: '"weight" is required and must be a positive number' },
      { status: 400 }
    );
  }

  // ── Optional field validation ──
  if (body.goalPace !== undefined && !(VALID_PACES as string[]).includes(body.goalPace as string)) {
    return NextResponse.json(
      { error: `"goalPace" must be one of: ${VALID_PACES.join(', ')}` },
      { status: 400 }
    );
  }
  if (
    body.activityLevel !== undefined &&
    !(VALID_ACTIVITY as string[]).includes(body.activityLevel as string)
  ) {
    return NextResponse.json(
      { error: `"activityLevel" must be one of: ${VALID_ACTIVITY.join(', ')}` },
      { status: 400 }
    );
  }
  if (
    body.heightUnit !== undefined &&
    !(VALID_HEIGHT_UNITS as string[]).includes(body.heightUnit as string)
  ) {
    return NextResponse.json({ error: '"heightUnit" must be "cm" or "in"' }, { status: 400 });
  }
  if (
    body.weightUnit !== undefined &&
    !(VALID_WEIGHT_UNITS as string[]).includes(body.weightUnit as string)
  ) {
    return NextResponse.json({ error: '"weightUnit" must be "kg" or "lb"' }, { status: 400 });
  }

  // ── Run algorithm — no DB touch needed ──
  const goals = calculateNutritionGoals({
    height,
    weight,
    age: typeof body.age === 'number' ? body.age : 22,
    sex: body.sex === 'M' || body.sex === 'F' ? body.sex : 'unknown',
    activityLevel: (body.activityLevel as ActivityLevel | undefined) ?? 'moderate',
    goal: body.goal,
    goalPace: (body.goalPace as GoalPace | undefined) ?? 'normal',
    heightUnit: (body.heightUnit as HeightUnit | undefined) ?? 'cm',
    weightUnit: (body.weightUnit as WeightUnit | undefined) ?? 'kg',
  });

  return NextResponse.json({ success: true, goals }, { status: 200 });
}

export const POST = withAuth(handler);
