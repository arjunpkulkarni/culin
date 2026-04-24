import { z } from 'zod';
import * as foodCategories from './foodCategories';

/* ============================================================================
   Recipe Types and Parsers
============================================================================ */

// Interfaces for a recipe and an ingredient
export interface Ingredient {
  item: string;
  amount: number;
  unit: string;
}

// New interface for parsed instructions required by the ingredient DAG
export interface ParsedInstruction {
  inputs: string[];
  output: string;
}

export interface Recipe {
  name: string;
  ingredients: Ingredient[];
  instructions: string[]; // Original free-text instructions
  parsedInstructions?: ParsedInstruction[]; // Added for ingredient DAG validation
  servings: number;
}

// Parser to convert a string-based ingredient to a structured Ingredient
function parseIngredient(ingredientStr: string): Ingredient {
  // Match patterns like "1 cup flour" or "2.5 tablespoons olive oil"
  const regex = /^([\d.]+)\s+(\w+)\s+(.+)$/;
  const match = ingredientStr.trim().match(regex);

  if (!match) {
    // Fallback for irregular formats
    return {
      amount: 1,
      unit: "portion",
      item: ingredientStr.trim()
    };
  }

  return {
    amount: parseFloat(match[1]),
    unit: match[2].toLowerCase(),
    item: match[3].trim()
  };
}

// Parser to convert string-based recipe data (or an object) into a Recipe
export function parseRecipeString(recipeData: any): Recipe {
  try {
    // Handle both string and array formats for instructions
    const instructions = Array.isArray(recipeData.instructions)
      ? recipeData.instructions
      : typeof recipeData.instructions === 'string'
        ? recipeData.instructions.split(/\\n|\\./).filter((instruction: string) => instruction.trim().length > 0)
        : [];

    // Handle both string and array formats for ingredients
    let ingredientsInput: (string | Ingredient | object)[]; // Can be strings, known Ingredients, or other objects

    if (Array.isArray(recipeData.ingredients)) {
      ingredientsInput = recipeData.ingredients;
    } else if (typeof recipeData.ingredients === 'string') {
      ingredientsInput = recipeData.ingredients.split('\\n').filter((ingredient: string) => ingredient.trim().length > 0);
    } else {
      console.warn('Recipe ingredients are in an unexpected format or missing. Defaulting to an empty list.');
      ingredientsInput = [];
    }

    const parsedIngredients: Ingredient[] = ingredientsInput.map((ing: string | Ingredient | object): Ingredient => {
      if (typeof ing === 'string') {
        return parseIngredient(ing);
      }
      // Check if 'ing' is an object and conforms to the Ingredient structure
      if (typeof ing === 'object' && ing !== null &&
          'item' in ing && typeof (ing as Ingredient).item === 'string' &&
          'amount' in ing && typeof (ing as Ingredient).amount === 'number' &&
          'unit' in ing && typeof (ing as Ingredient).unit === 'string') {
        return ing as Ingredient; // It's already a valid Ingredient object
      }
      // Fallback: If it's an object but not in the expected Ingredient structure,
      // or some other type, log a warning and try to parse its string representation.
      console.warn(`Unexpected or malformed ingredient object: ${JSON.stringify(ing)}. Attempting to parse its string representation.`);
      return parseIngredient(String(ing)); // This might still result in item: "[object Object]" if String(ing) is not parseable
    });

    const parsedRecipe: Recipe = {
      name: recipeData.name || "Untitled Recipe",
      ingredients: parsedIngredients,
      instructions: instructions.map((instruction: string) => instruction.trim()),
      servings: recipeData.servings || 4,
      // IMPORTANT: parsedInstructions are not populated here by default.
      // They need to be added to recipeData by an external process before this validation.
      parsedInstructions: recipeData.parsedInstructions || undefined
    };

    return parsedRecipe;
  } catch (error) {
    console.error('Error parsing recipe:', error);
    throw new Error('Failed to parse recipe format');
  }
}

/* ============================================================================
   Recipe Validation (Schema, Ingredient Proportions, Cooking Steps, Nutrition)
============================================================================ */

// Zod schema to validate the basic structure of a recipe
export const recipeSchema = z.object({
  name: z.string().min(3),
  ingredients: z.array(z.object({
    item: z.string(),
    amount: z.number().positive(),
    unit: z.string()
  })).min(1),
  instructions: z.array(z.string()).min(1),
  servings: z.number().min(1).max(20)
});

// Validate basic recipe structure using Zod
export function validateRecipeStructure(recipe: any): boolean {
  try {
    // Parse the recipe if ingredients are in string/array format
    const parsedRecipe = typeof recipe.ingredients === 'string' || Array.isArray(recipe.ingredients)
      ? parseRecipeString(recipe)
      : recipe;

    recipeSchema.parse(parsedRecipe);
    return true;
  } catch (error) {
    console.error('Recipe validation failed:', error);
    return false;
  }
}

// Define types for measurement conversions
type WeightUnits = 'g' | 'kg' | 'oz' | 'lb';
type VolumeUnits = 'tsp' | 'tbsp' | 'cup' | 'ml' | 'l';

const measurementConversions = {
  weight: {
    g: 1,
    kg: 1_000,
    oz: 28.35,
    lb: 453.6
  } as Record<WeightUnits, number>,
  volumeToMl: {
    tsp: 5,     // 1 tsp ≈ 5 mL
    tbsp: 15,   // 1 tbsp ≈ 15 mL
    cup: 240,   // 1 cup ≈ 240 mL
    ml: 1,
    l: 1_000
  } as Record<VolumeUnits, number>
};

function normalizeWeight(amount: number, unit: string): number {
  const u = unit.toLowerCase() as WeightUnits | VolumeUnits;
  if (u in measurementConversions.weight) {
    return amount * measurementConversions.weight[u as WeightUnits];
  }
  if (u in measurementConversions.volumeToMl) {
    // assume 1 g/mL density
    return amount * measurementConversions.volumeToMl[u as VolumeUnits];
  }
  // unknown unit—just return the raw amount so it still participates
  return amount;
}

// Typical portion sizes per serving for nutritional checks
const typicalPortions = {
  protein: { min: 100, max: 200, unit: 'g' },
  grains: { min: 50, max: 100, unit: 'g' },
  vegetables: { min: 150, max: 300, unit: 'g' },
  sauce: { min: 30, max: 100, unit: 'ml' }
};

// Validate that ingredient proportions per serving meet typical thresholds
export function validateIngredientProportions(recipe: any): {
  valid: boolean;
  issues: string[];
} {
  try {
    const parsedRecipe = typeof recipe.ingredients === 'string' || Array.isArray(recipe.ingredients)
      ? parseRecipeString(recipe)
      : recipe;

    // Log the ingredients being processed
    console.log("[recipeValidation.ts] Ingredients being processed in validateIngredientProportions:", JSON.stringify(parsedRecipe.ingredients, null, 2));

    const issues: string[] = [];
    const perServing = parsedRecipe.servings;

    // Categorize ingredients with improved vegetable detection
    const vegRegex = new RegExp(foodCategories.vegetables.join('|'), 'i');
    
    const ingredients = {
      proteins: parsedRecipe.ingredients.filter((i: Ingredient) => 
        new RegExp(foodCategories.proteins.join('|'), 'i').test(i.item)),
      grains: parsedRecipe.ingredients.filter((i: Ingredient) => 
        new RegExp(foodCategories.grains.join('|'), 'i').test(i.item)),
      vegetables: parsedRecipe.ingredients.filter((i: Ingredient) => 
        vegRegex.test(i.item)),
      sauces: parsedRecipe.ingredients.filter((i: Ingredient) => 
        new RegExp(foodCategories.saucesAndFats.join('|'), 'i').test(i.item))
    };

    // Normalize weight (assumes weight units)
    const totalProtein = ingredients.proteins.reduce((sum: number, ing: Ingredient) => {
      return sum + normalizeWeight(ing.amount, ing.unit);
    }, 0);

    if (ingredients.proteins.length > 0) {
      if (totalProtein / perServing < typicalPortions.protein.min) {
        issues.push(`Low protein content: ${totalProtein}g per serving`);
      }
      if (totalProtein / perServing > typicalPortions.protein.max) {
        issues.push(`High protein content: ${totalProtein}g per serving`);
      }
    }

    if (ingredients.vegetables.length === 0) {
      issues.push('Recipe contains no vegetables');
    }

    // Check cooking instructions for critical steps
    if (!validateCookingInstructions(parsedRecipe.instructions)) {
      issues.push('Missing critical cooking steps or temperature guidance');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    console.error('Error in proportion validation:', error);
    return {
      valid: false,
      issues: ['Failed to validate recipe proportions']
    };
  }
}

function validateCookingInstructions(instructions: string[]): boolean {
  // Look for temperature, time, and a cooking method in the instructions
  const hasTemperature = instructions.some(step => 
    step.match(/(\d+)\s*(°[CF]|degrees)/i));
  const hasCookingTime = instructions.some(step =>
    step.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i));
  const hasCookingMethod = instructions.some(step =>
    step.match(/(bake|roast|grill|sauté|boil|simmer|fry)/i));

  return hasTemperature && hasCookingTime && hasCookingMethod;
}

// Validate nutritional balance by checking for protein, carbohydrates, vegetables, and healthy fats
export function validateNutritionalBalance(recipe: any): {
  balanced: boolean;
  suggestions: string[];
} {
  try {
    const parsedRecipe = typeof recipe.ingredients === 'string' || Array.isArray(recipe.ingredients)
      ? parseRecipeString(recipe)
      : recipe;

    const suggestions: string[] = [];
    
    const hasProtein = parsedRecipe.ingredients.some((ing: Ingredient) => 
      new RegExp(foodCategories.proteins.join('|'), 'i').test(ing.item));
    const hasCarbs = parsedRecipe.ingredients.some((ing: Ingredient) => 
      new RegExp(foodCategories.grains.join('|'), 'i').test(ing.item));
    const hasVegetables = parsedRecipe.ingredients.some((ing: Ingredient) => 
      new RegExp(foodCategories.vegetables.join('|'), 'i').test(ing.item));
    const hasHealthyFats = parsedRecipe.ingredients.some((ing: Ingredient) => 
      new RegExp(foodCategories.healthyFats.join('|'), 'i').test(ing.item));

    if (!hasProtein) suggestions.push('Consider adding a protein source');
    if (!hasCarbs) suggestions.push('Consider adding a complex carbohydrate');
    if (!hasVegetables) suggestions.push('Add vegetables for better nutrition');
    if (!hasHealthyFats) suggestions.push('Consider adding healthy fats');

    return {
      balanced: suggestions.length === 0,
      suggestions
    };
  } catch (error) {
    console.error('Error in nutritional balance validation:', error);
    return {
      balanced: false,
      suggestions: ['Failed to validate nutritional balance']
    };
  }
}

/* ============================================================================
   Step/Instruction Validation and Sequence Checking
============================================================================ */

const stepPatterns = {
  preparation: /(chop|dice|slice|mince|grate|peel|wash|clean|trim|mix|stir|combine)/i,
  cooking: /(cook|bake|roast|grill|sau?té|saute|fry|boil|simmer|steam|braise)/i,
  finishing: /(garnish|plate|serve|top|sprinkle|drizzle|season)/i,
  temperature: /(\d+)\s*(°[CF]|degrees)/i,
  time: /(\d+)\s*(minutes?|mins?|hours?|hrs?)/i
};

interface StepValidation {
  hasPreparation: boolean;
  hasCooking: boolean;
  hasFinishing: boolean;
  hasTemperature: boolean;
  hasTime: boolean;
  dependencies: string[];
  missingDependencies: string[];
}

function validateStepSequence(instructions: string[]): StepValidation[] {
  const validations: StepValidation[] = instructions.map(step => ({
    hasPreparation: stepPatterns.preparation.test(step),
    hasCooking: stepPatterns.cooking.test(step),
    hasFinishing: stepPatterns.finishing.test(step),
    hasTemperature: stepPatterns.temperature.test(step),
    hasTime: stepPatterns.time.test(step),
    dependencies: [],
    missingDependencies: []
  }));

  const stepDependencies: Record<string, (keyof StepValidation)[]> = {
    bake: ['hasPreparation', 'hasTemperature'],
    roast: ['hasPreparation', 'hasTemperature'],
    grill: ['hasPreparation', 'hasTemperature'],
    sauté: ['hasPreparation'],
    saute: ['hasPreparation'],
    fry: ['hasPreparation'],
    boil: ['hasPreparation'],
    simmer: ['hasPreparation', 'hasTemperature'],
    steam: ['hasPreparation'],
    braise: ['hasPreparation', 'hasTemperature'],
    garnish: ['hasCooking'],
    plate: ['hasCooking'],
    serve: ['hasCooking']
  };

  for (let i = 0; i < instructions.length; i++) {
    const txt = instructions[i].toLowerCase();
    const val = validations[i];
    for (const [action, deps] of Object.entries(stepDependencies)) {
      if (txt.includes(action)) {
        val.dependencies = deps.map(d => d.replace('has', '').toLowerCase());
        deps.forEach(dep => {
          // look backwards for that flag
          const seen = validations.slice(0, i).some(prev => prev[dep as keyof StepValidation]);
          if (!seen) val.missingDependencies.push(dep.replace('has', '').toLowerCase());
        });
      }
    }
  }

  return validations;
}

export function validateRecipeSteps(recipe: Recipe): {
  valid: boolean;
  issues: string[];
  stepValidations: StepValidation[];
} {
  const stepValidations = validateStepSequence(recipe.instructions);
  const issues: string[] = [];

  // Check that critical steps exist somewhere in the instructions
  const hasPreparation = stepValidations.some(v => v.hasPreparation);
  const hasCooking = stepValidations.some(v => v.hasCooking);
  const hasFinishing = stepValidations.some(v => v.hasFinishing);

  if (!hasPreparation) issues.push('Missing preparation steps');
  if (!hasCooking) issues.push('Missing cooking steps');
  if (!hasFinishing) issues.push('Missing finishing steps');

  // Report any missing dependencies for each step
  stepValidations.forEach((validation, i) => {
    if (validation.missingDependencies.length > 0) {
      issues.push(`Step ${i + 1} is missing required dependencies: ${validation.missingDependencies.join(', ')}`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    stepValidations
  };
}

/* ============================================================================
   Acyclicity Check for Recipe Instructions (Python-inspired)
============================================================================ */

/**
 * Infers directed edges between recipe steps based on a keyword heuristic.
 * Edge from step j to step i (j < i) if step i uses a keyword and step j
 * contains the action verb of that keyword.
 * Based on the user-provided Python snippet for `infer_edges`.
 */
function inferEdgesFromSteps(steps: string[]): [number, number][] {
  const edges: [number, number][] = [];
  // Keywords from the user's Python snippet
  const keywords = ["return", "add", "combine", "pour", "fold", "stir in"];

  for (let i = 0; i < steps.length; i++) {
    const currentStepLower = steps[i].toLowerCase();
    for (let j = 0; j < i; j++) { // Look back only (j < i)
      const prevStepLower = steps[j].toLowerCase();
      for (const kw of keywords) {
        const actionVerb = kw.split(' ')[0];
        // Heuristic: current step contains keyword, and previous step contains the action verb of that keyword.
        if (currentStepLower.includes(kw) && prevStepLower.includes(actionVerb)) {
          edges.push([j, i]);
          // If a dependency is found for this pair (j,i) based on one keyword,
          // no need to check other keywords for the same (j,i) pair.
          break; 
        }
      }
    }
  }
  return edges;
}

/**
 * Checks if a graph is acyclic using Kahn's algorithm.
 * Based on the user-provided Python snippet for `is_dag`.
 * @param numNodes Total number of nodes (steps).
 * @param edgeList List of edges, where each edge is [from_idx, to_idx].
 */
function isAcyclic(numNodes: number, edgeList: [number, number][]): boolean {
  if (numNodes === 0) {
    return true; // No nodes, considered acyclic.
  }

  const adj: Map<number, number[]> = new Map();
  const inDegree: number[] = new Array(numNodes).fill(0);

  for (const [u, v] of edgeList) {
    if (u < 0 || u >= numNodes || v < 0 || v >= numNodes) {
      // console.warn(`Invalid edge: (${u}, ${v}) for ${numNodes} nodes. Skipping.`);
      continue; // Skip invalid edges if any (defensive)
    }
    if (!adj.has(u)) {
      adj.set(u, []);
    }
    adj.get(u)!.push(v);
    inDegree[v]++;
  }

  const queue: number[] = [];
  for (let i = 0; i < numNodes; i++) {
    if (inDegree[i] === 0) {
      queue.push(i);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const node = queue.shift()!; // Non-null assertion as queue.length > 0 checked
    visitedCount++;
    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }
  return visitedCount === numNodes;
}

/**
 * Checks if the recipe steps follow a Directed Acyclic Graph (DAG) structure
 * based on the inferred edges.
 * Equivalent to the user's `recipe_follows_dag` Python function.
 */
function recipeFollowsDagLogic(instructions: string[]): boolean {
  if (!instructions || instructions.length === 0) {
    return true; // Vacuously true for no instructions
  }
  const edges = inferEdgesFromSteps(instructions);
  return isAcyclic(instructions.length, edges);
}

/* ============================================================================
   Recipe Categories and Proportions Validation
============================================================================ */

interface CategoryProportions {
  [key: string]: {
    min: number;
    max: number;
    unit: string;
    typicalRatio?: number;
  };
}

const recipeCategories = {
  mainDish: {
    proteins: { min: 30, max: 40, unit: '%', typicalRatio: 0.35 },
    vegetables: { min: 40, max: 50, unit: '%', typicalRatio: 0.45 },
    grains: { min: 20, max: 30, unit: '%', typicalRatio: 0.25 },
    sauces: { min: 5, max: 15, unit: '%', typicalRatio: 0.1 }
  },
  soup: {
    proteins: { min: 15, max: 25, unit: '%', typicalRatio: 0.2 },
    vegetables: { min: 50, max: 60, unit: '%', typicalRatio: 0.55 },
    broth: { min: 20, max: 30, unit: '%', typicalRatio: 0.25 }
  },
  dessert: {
    base: { min: 40, max: 50, unit: '%', typicalRatio: 0.45 },
    sweetener: { min: 20, max: 30, unit: '%', typicalRatio: 0.25 },
    fat: { min: 20, max: 30, unit: '%', typicalRatio: 0.25 },
    flavoring: { min: 5, max: 15, unit: '%', typicalRatio: 0.1 }
  }
};

function calculateCategoryProportions(recipe: Recipe): { [key: string]: number } {
  const proportions: { [key: string]: number } = {};
  let totalWeight = 0;

  // Sum the total normalized weight of all ingredients
  for (const ingredient of recipe.ingredients) {
    const weight = normalizeWeight(ingredient.amount, ingredient.unit);
    totalWeight += weight;
  }

  // Determine the percentage of weight in each category
  for (const ingredient of recipe.ingredients) {
    const weight = normalizeWeight(ingredient.amount, ingredient.unit);
    const proportion = (weight / totalWeight) * 100;

    if (new RegExp(foodCategories.proteins.join('|'), 'i').test(ingredient.item)) {
      proportions.proteins = (proportions.proteins || 0) + proportion;
    } else if (new RegExp(foodCategories.vegetables.join('|'), 'i').test(ingredient.item)) {
      proportions.vegetables = (proportions.vegetables || 0) + proportion;
    } else if (new RegExp(foodCategories.grains.join('|'), 'i').test(ingredient.item)) {
      proportions.grains = (proportions.grains || 0) + proportion;
    } else if (new RegExp(foodCategories.saucesAndFats.join('|'), 'i').test(ingredient.item)) {
      proportions.sauces = (proportions.sauces || 0) + proportion;
    } else if (new RegExp(foodCategories.brothTypes.join('|'), 'i').test(ingredient.item)) { // Added broth category
      proportions.broth = (proportions.broth || 0) + proportion;
    }
  }

  return proportions;
}

export function validateRecipeProportions(recipe: Recipe, category: keyof typeof recipeCategories): {
  valid: boolean;
  issues: string[];
  proportions: { [key: string]: number };
} {
  const issues: string[] = [];
  const proportions = calculateCategoryProportions(recipe);
  const categoryProportions = recipeCategories[category];

  for (const [cat, expected] of Object.entries(categoryProportions)) {
    const actual = proportions[cat] || 0;
    if (actual < expected.min) {
      issues.push(`${cat} proportion (${actual.toFixed(1)}%) is below minimum (${expected.min}%)`);
    }
    if (actual > expected.max) {
      issues.push(`${cat} proportion (${actual.toFixed(1)}%) is above maximum (${expected.max}%)`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    proportions
  };
}

/* ============================================================================
   Ingredient-Level Directed Acyclic Graph (DAG) Validation (TypeScript version)
============================================================================ */

/**
 * Builds an adjacency map for the ingredient graph.
 * Nodes are ingredients, intermediates, or the final dish.
 * Edges represent instruction steps: input_ingredient → output_produced.
 * Based on the user-provided Python 'build_graph'.
 */
function buildIngredientGraphTs(
  recipe: Recipe,
  dishName: string
): Map<string, string[]> {
  const G = new Map<string, string[]>();
  const dishNameLower = dishName.toLowerCase();

  // Ensure all nodes exist in the map, initializing with empty adjacency list
  const ensureNode = (node: string) => {
    if (!G.has(node)) {
      G.set(node, []);
    }
  };

  // 1. Raw ingredients are starting nodes
  if (recipe.ingredients) {
    for (const ing of recipe.ingredients) {
      ensureNode(ing.item.toLowerCase());
    }
  }

  // 2. Build edges for every step from parsedInstructions
  let lastOutputs = new Set<string>();
  if (recipe.parsedInstructions) {
    const allOutputsFromSteps = new Set<string>();
    recipe.parsedInstructions.forEach(step => allOutputsFromSteps.add(step.output.toLowerCase()));

    for (const step of recipe.parsedInstructions) {
      const outNode = step.output.toLowerCase();
      ensureNode(outNode);

      // Update lastOutputs:
      // An item is a "last output" if it's an output of this step,
      // AND it's not an input to ANY other step that also produces it later.
      // More simply: it's an output, and we remove things that are inputs later.
      // The Python version's logic was: last_outputs = (last_outputs - {inputs_of_this_step}) | {out_node}
      // This means an output remains a "last output" unless it's consumed by a *later* step
      // to produce something *else*. If it's consumed to produce *itself* again (part of a cycle),
      // it would still be in last_outputs based on this logic.
      // Let's refine this: an item is a "last output" if it's produced and not consumed by any *subsequent* step *as an input*.

      // For now, using a simpler approach: collect all outputs. We'll refine connection to dish_name later.
      // The original python `last_outputs = (last_outputs - {out_node}) | {out_node}` was intended to
      // track current sinks. If an item was an output, then an input, then an output again, it's a sink.
      // Let's track all unique outputs produced by steps first.

      for (const inp of step.inputs) {
        const inNode = inp.toLowerCase();
        ensureNode(inNode);
        G.get(inNode)!.push(outNode); // Add edge in_node -> out_node
      }
    }

    // Determine last_outputs: these are nodes that are outputs of some step,
    // but are not inputs to any *other* step.
    // Or, more simply for connecting to the final dish: outputs that aren't consumed to make other intermediates.

    const allInputsInSteps = new Set<string>();
    if (recipe.parsedInstructions) {
        recipe.parsedInstructions.forEach(step => {
            step.inputs.forEach(inp => allInputsInSteps.add(inp.toLowerCase()));
        });
    }
    
    lastOutputs = new Set<string>();
    if (recipe.parsedInstructions) {
        recipe.parsedInstructions.forEach(step => {
            const output = step.output.toLowerCase();
            if (!allInputsInSteps.has(output)) { // If an output is never used as an input for another step
                lastOutputs.add(output);
            }
        });
    }
     // Also, raw ingredients that are never used as inputs to any step are considered "last outputs"
     // in the sense that they should connect to the final dish if they weren't processed.
    if (recipe.ingredients) {
        for (const ing of recipe.ingredients) {
            const ingNameLower = ing.item.toLowerCase();
            if (!allInputsInSteps.has(ingNameLower) && !allOutputsFromSteps.has(ingNameLower)) {
                 // It's a raw ingredient not used in any step and not an output of a step itself.
                 // (This case might mean it's an unused ingredient or should be directly part of the final dish)
                 // For DAG purposes, if it exists and isn't processed into something else, it's a leaf.
                 lastOutputs.add(ingNameLower);
            }
        }
    }


  } else {
    // If no parsed instructions, all raw ingredients are effectively "last outputs"
    if (recipe.ingredients) {
        recipe.ingredients.forEach(ing => lastOutputs.add(ing.item.toLowerCase()));
    }
  }


  // 3. Connect every "last output" (leaf/sink from steps or unused raw ingredient) to the final dish node
  ensureNode(dishNameLower);
  for (const leaf of lastOutputs) {
    if (leaf !== dishNameLower) { // Avoid self-loop for the dish name
      // If leaf is not already connected AND G.get(leaf) exists
      if (G.has(leaf) && !G.get(leaf)!.includes(dishNameLower)) {
         G.get(leaf)!.push(dishNameLower);
      } else if (!G.has(leaf)) { // Should not happen if ensureNode was used correctly
         G.set(leaf, [dishNameLower]);
      }
    }
  }
  return G;
}

/**
 * Checks if a graph is acyclic using Kahn's algorithm (TypeScript version).
 * Based on the user-provided Python 'is_dag'.
 * @param graph Adjacency map (node -> list of children).
 */
function isDagTs(graph: Map<string, string[]>): { isAcyclic: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!graph || graph.size === 0) {
    return { isAcyclic: true, issues }; // Empty graph is acyclic
  }

  const inDegree = new Map<string, number>();
  const allNodes = new Set<string>();

  graph.forEach((children, parent) => {
    allNodes.add(parent);
    children.forEach(child => allNodes.add(child));
  });

  allNodes.forEach(node => inDegree.set(node, 0));

  graph.forEach((children) => {
    children.forEach(child => {
      inDegree.set(child, (inDegree.get(child) || 0) + 1);
    });
  });

  const queue: string[] = [];
  allNodes.forEach(node => {
    if (inDegree.get(node) === 0) {
      queue.push(node);
    }
  });

  let visitedCount = 0;
  const sortedOrder: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!; // Non-null assertion as queue.length > 0
    visitedCount++;
    sortedOrder.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visitedCount !== allNodes.size) {
    issues.push(`Cycle detected in ingredient flow. Visited ${visitedCount} nodes, expected ${allNodes.size}.`);
    // Advanced: Find the cycle (optional, more complex)
    // For now, just indicating a cycle is present.
    // Example: Nodes involved in cycles often have remaining in-degrees > 0.
    const cycleNodesPartially = Array.from(allNodes).filter(n => (inDegree.get(n) || 0) > 0);
    if (cycleNodesPartially.length > 0) {
        issues.push(`Potential cycle participants (or nodes downstream of a cycle): ${cycleNodesPartially.join(', ')}`);
    }
    return { isAcyclic: false, issues };
  }

  return { isAcyclic: true, issues: [] };
}

/**
 * Validates if the ingredient/intermediate connections form a DAG.
 * Requires `recipe.parsedInstructions`.
 */
export function validateIngredientConnectionsDag(
  recipe: Recipe,
  dishName: string
): { valid: boolean; issues: string[] } {
  if (!recipe.parsedInstructions || recipe.parsedInstructions.length === 0) {
    // If no parsed instructions, it's vacuously a DAG, or an issue depending on requirements.
    // For now, assume it's valid if there's nothing to check.
    // Or, if recipe has ingredients but no steps, that's also a simple DAG (ingredients -> dish)
    if (recipe.ingredients && recipe.ingredients.length > 0 && (!recipe.parsedInstructions || recipe.parsedInstructions.length === 0)) {
        // This case implies direct ingredients to final dish, which is a valid DAG.
        return { valid: true, issues: [] };
    }
    // If no ingredients and no parsed instructions, also fine.
    if ((!recipe.ingredients || recipe.ingredients.length === 0) && (!recipe.parsedInstructions || recipe.parsedInstructions.length === 0)) {
        return { valid: true, issues: [] };
    }
    
    return { valid: false, issues: ["Recipe lacks parsed instructions for ingredient DAG validation, but has ingredients."] };
  }
  if (!dishName) {
    return { valid: false, issues: ["Dish name is required for ingredient DAG validation."] };
  }

  const graph = buildIngredientGraphTs(recipe, dishName);
  const dagResult = isDagTs(graph);
  return { valid: dagResult.isAcyclic, issues: dagResult.issues };
}

/* ============================================================================
   Directed Acyclic Graph (DAG) for Recipe Validation
============================================================================ */

// Removed previous DAGNode, DAGEdge, RecipeDAG, and buildRecipeDAG implementation.
// New acyclicity check is implemented above (inferEdgesFromSteps, isAcyclic, recipeFollowsDagLogic).

/**
 * Comprehensive recipe validation that combines all validation checks
 * @param recipe The recipe to validate
 * @param category Optional recipe category (mainDish, soup, or dessert)
 * @returns A comprehensive validation result with all checks
 */

// Define the return type for validateRecipe for clarity
export interface ComprehensiveValidationResult {
  valid: boolean;
  structureValid: boolean;
  proportionCheck: {
    valid: boolean;
    issues: string[];
  };
  nutritionCheck: {
    balanced: boolean;
    suggestions: string[];
  };
  stepValidation: {
    valid: boolean;
    issues: string[];
    stepValidations: StepValidation[];
  };
  categoryValidation?: {
    valid: boolean;
    issues: string[];
    proportions: { [key: string]: number };
  };
  recipeFollowsDag: boolean; // Heuristic step order DAG result
  ingredientConnectionsValidDag?: boolean; // New: Ingredient/intermediate DAG
  ingredientConnectionsDagIssues?: string[]; // Issues from the new DAG check
}

export function validateRecipe(recipe: any, category?: keyof typeof recipeCategories): ComprehensiveValidationResult {
  // Parse the recipe if needed
  const parsedRecipe = (typeof recipe.ingredients === 'string' || Array.isArray(recipe.ingredients) || !recipe.parsedInstructions && recipe.instructions)
    ? parseRecipeString(recipe) // parseRecipeString needs to handle/pass through parsedInstructions if they exist on 'recipe'
    : recipe as Recipe; // Assume it's already a Recipe object (potentially with parsedInstructions)

  // Basic structure validation
  const structureValid = validateRecipeStructure(parsedRecipe);

  // Validate ingredient proportions
  const proportionCheck = validateIngredientProportions(parsedRecipe);

  // Validate nutritional balance
  const nutritionCheck = validateNutritionalBalance(parsedRecipe);

  // Validate recipe steps (heuristic DAG)
  const stepValidation = validateRecipeSteps(parsedRecipe);

  // Optional category validation
  let categoryValidationResult;
  if (category) {
    categoryValidationResult = validateRecipeProportions(parsedRecipe, category);
  }

  // Recipe step order acyclicity check (heuristic based on instruction text)
  let recipeIsAcyclicByHeuristic = true;
  if (parsedRecipe.instructions && parsedRecipe.instructions.length > 0) {
    try {
      recipeIsAcyclicByHeuristic = recipeFollowsDagLogic(parsedRecipe.instructions);
    } catch (error) {
      console.error('Error in heuristic recipe DAG logic validation:', error);
      recipeIsAcyclicByHeuristic = false;
    }
  }

  // New: Ingredient-level DAG validation (if parsedInstructions are present)
  let ingredientDag = { valid: true, issues: [] as string[] }; // Default to valid if not applicable
  if (parsedRecipe.parsedInstructions && parsedRecipe.parsedInstructions.length > 0) {
    ingredientDag = validateIngredientConnectionsDag(parsedRecipe, parsedRecipe.name);
  } else if (parsedRecipe.ingredients && parsedRecipe.ingredients.length > 0 && (!parsedRecipe.parsedInstructions || parsedRecipe.parsedInstructions.length === 0)) {
    // If there are ingredients but no parsed instructions, it's a simple DAG (ingredients -> dish)
    // This is handled by validateIngredientConnectionsDag's initial checks if we call it.
    // To be safe, let's ensure it's explicitly considered valid or let the function decide.
    // The current validateIngredientConnectionsDag would return "Recipe lacks parsed instructions..." if ingredients exist.
    // We can consider this scenario (ingredients, no steps) as a valid simple DAG.
     ingredientDag = { valid: true, issues: [] };
  }


  // Determine overall validity
  const overallValid = structureValid &&
    proportionCheck.valid &&
    nutritionCheck.balanced &&
    stepValidation.valid &&
    recipeIsAcyclicByHeuristic &&
    ingredientDag.valid && // Incorporate the new ingredient DAG check
    (!categoryValidationResult || categoryValidationResult.valid);

  const result: ComprehensiveValidationResult = {
    valid: overallValid,
    structureValid,
    proportionCheck,
    nutritionCheck,
    stepValidation,
    recipeFollowsDag: recipeIsAcyclicByHeuristic,
    ingredientConnectionsValidDag: ingredientDag.valid,
    ingredientConnectionsDagIssues: ingredientDag.issues,
  };

  if (categoryValidationResult) {
    result.categoryValidation = categoryValidationResult;
  }

  return result;
}

