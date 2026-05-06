/**
 * Authoritative sources backing the nutrition / health-adjacent guidance
 * shown in the app. Surfaced in-app to satisfy App Store Review
 * Guideline 1.4.1 (medical/health info must reference its sources) and
 * to give users an easy way to verify recommendations.
 *
 * Keep this list short, accurate, and only cite what we actually rely on.
 */
export interface NutritionSource {
  id: string;
  title: string;
  organization: string;
  description: string;
  url: string;
}

export const NUTRITION_SOURCES: NutritionSource[] = [
  {
    id: 'dga',
    title: 'Dietary Guidelines for Americans',
    organization: 'U.S. Departments of Agriculture & Health and Human Services',
    description:
      'Federal evidence-based recommendations on healthy eating patterns, calorie needs, and macronutrient ranges that inform our default targets.',
    url: 'https://www.dietaryguidelines.gov/',
  },
  {
    id: 'fdc',
    title: 'USDA FoodData Central',
    organization: 'U.S. Department of Agriculture',
    description:
      'Reference database for the calorie and macronutrient values used to estimate the meals you log.',
    url: 'https://fdc.nal.usda.gov/',
  },
  {
    id: 'nih-nutrition',
    title: 'Nutrition · MedlinePlus',
    organization: 'U.S. National Library of Medicine (NIH)',
    description:
      'Plain-language overviews of nutrients, healthy eating, and special diets used to ground our general guidance.',
    url: 'https://medlineplus.gov/nutrition.html',
  },
  {
    id: 'who-healthy-diet',
    title: 'Healthy Diet Fact Sheet',
    organization: 'World Health Organization',
    description:
      'International public-health guidance on fruits, vegetables, added sugars, sodium, and fats.',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    id: 'dri',
    title: 'Dietary Reference Intakes (DRIs)',
    organization: 'National Academies of Sciences, Engineering, and Medicine',
    description:
      'Reference intakes used as the basis for protein, carbohydrate, fat, vitamin, and mineral recommendations.',
    url: 'https://www.nationalacademies.org/our-work/summary-report-of-the-dietary-reference-intakes',
  },
];

/**
 * Short, plainly worded health disclaimer shown alongside the sources
 * everywhere recommendations appear.
 */
export const HEALTH_DISCLAIMER =
  'CulinAI provides general nutrition estimates and ideas for informational purposes only. It is not medical, dietetic, or clinical advice and is not a substitute for guidance from a qualified healthcare professional. Talk to your doctor or registered dietitian before making changes to your diet, especially if you have a health condition, are pregnant, or take medication.';
