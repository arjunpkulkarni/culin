// Define the types for clarity
type Compound = {
    name: string;
    concentration_high: number;
    concentration_low: number;
  };
  
  type Ingredient = {
    quantity: string;
    unit: string;
    name: string | string[];
    preparation: string;
    comment: string;
    compounds?: Compound[];
    input: string;
  };
  
  /**
   * Sorts the compounds of an ingredient in descending order 
   * based on the concentration_high value.
   */
  function sortCompounds(ingredient: Ingredient): Ingredient {
    if (ingredient.compounds && Array.isArray(ingredient.compounds)) {
      ingredient.compounds.sort(
        (a, b) => b.concentration_high - a.concentration_high
      );
    }
    return ingredient;
  }
  
  /**
   * Validates that a single ingredient has all the required fields.
   */
  function isValidIngredient(ingredient: Ingredient): boolean {
    // Check required fields
    if (!ingredient.quantity || !ingredient.unit || !ingredient.name || !ingredient.input) {
      return false;
    }
    // If compounds exist, ensure they are an array
    if (ingredient.compounds && !Array.isArray(ingredient.compounds)) {
      return false;
    }
    return true;
  }
  
  /**
   * Validates the overall recipe (an array of ingredients).
   */
  function isValidRecipe(recipe: Ingredient[]): boolean {
    if (!Array.isArray(recipe)) return false;
    for (const ingredient of recipe) {
      if (!isValidIngredient(ingredient)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Post processes the raw recipe response by:
   *  - Sorting the compounds for each ingredient.
   *  - Validating the recipe.
   *
   * Returns an object containing the sorted recipe and a validity flag.
   */
  export default function postProcessRecipeResponse(
    recipeResponse: Ingredient[]
  ): { valid: boolean; recipe: Ingredient[] } {
    // First, sort the compounds for each ingredient
    const sortedRecipe = recipeResponse.map(sortCompounds);
    // Then, validate the recipe format
    const valid = isValidRecipe(sortedRecipe);
    return {
      valid,
      recipe: sortedRecipe,
    };
  }
  
  // --- Example Usage ---
  //
  // Assume you have parsed the raw JSON into an array of Ingredient objects
  // (e.g., from a GPT response or another API).
  //
  // const rawRecipe: Ingredient[] = [ ... ];
  // const processed = postProcessRecipeResponse(rawRecipe);
  //
  // if (processed.valid) {
  //    // continue with the valid recipe
  // } else {
  //    // handle the invalid recipe error
  // }
  