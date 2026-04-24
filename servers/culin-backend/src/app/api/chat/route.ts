import { NextRequest, NextResponse } from "next/server";
import { fetchNutritionData } from "../nutritionService";
import { getGPTResponse } from "../gptService";
// import { bedrockChat } from "../bedrockClient";
import { runAgent } from "../langgraph";
import { vectorStore } from "../vectorStore";
import { searchIngredientCompounds } from "../flavorPairing";
import { buildInstacartRecipePayload, createInstacartRecipePage } from "../instacartService";
import { fetchFlavorRecommendation } from "../flavorRecommenderService";
import {
  validateRecipeStructure,
  validateIngredientProportions,
  validateNutritionalBalance,
  validateRecipe,
  type Recipe,
  type ComprehensiveValidationResult
} from "../recipeValidation/recipeValidation";
import fs from 'fs';
import path from 'path';
import { withAuth } from "@/lib/api-auth-middleware";
import { AuthUser } from "@/lib/auth-utils";

// Define types for the data structures
interface Food {
  name: string;
  calories: number;
  protein: number;
}

interface SpoonacularRecipe {
  title: string;
  image: string;
}

interface NutritionData {
  usdaData?: Food[];
  spoonacularData?: SpoonacularRecipe[];
}

interface FlavorPairings {
  [key: string]: string | string[];
}

// Interface for the incoming request
interface ChatRequest {
  query: string;
  diagnosticCodes?: {
    code: string;
    name: string;
  }[];
  complexity?: number;
  // Optional: numeric health effect IDs for the Flavor Recommender service
  healthEffectIds?: number[];
}

// Helper to extract keywords from ICD code name
const extractKeywordsFromIcdName = (icdName: string): string[] => {
  if (!icdName) return [];
  const commonWords = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'with', 'without', 'mellitus', 'disease', 'unspecified', 'specified', 'syndrome', 'type', 'due', 'to']);
  return icdName
    .toLowerCase()
    .split(/[\s,();\/-]+/)
    .map(word => word.replace(/[^a-z0-9]/gi, ''))
    .filter(word => word.length > 2 && !commonWords.has(word));
};

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  try {
    console.log('[Chat] Authenticated user:', user.sub, user.email);
    const { query: originalQuery, diagnosticCodes, complexity = 3, healthEffectIds } = await req.json() as ChatRequest;
    console.log('[Chat] Received healthEffectIds:', Array.isArray(healthEffectIds) ? healthEffectIds : null)

    if (!originalQuery) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Clean up original query if it contains diagnostic code display text from the frontend
    const cleanQuery = originalQuery.replace(/\[.*?\]/g, '').trim();

    let csvDerivedContext = '';
    // Removed CSV processing logic
    
    let agenticSearchContext = '';
    if (diagnosticCodes && diagnosticCodes.length > 0) {
      agenticSearchContext = '\n\n--- Additional Information from Agentic Search ---\n';
      for (const code of diagnosticCodes) {
        if (code && code.name) {
          try {
            console.log(`Agentic Search: Performing vector store search for "${code.name}"`);
            const searchResults = await vectorStore.search(code.name, 3); // Limit to 3 results per code
            if (searchResults && searchResults.length > 0) {
              agenticSearchContext += `\nFor condition "${code.name} (${code.code})":\n`;
              searchResults.forEach((result, index) => {
                agenticSearchContext += `Source ${index + 1}: ${result.text.substring(0, 300)}... (Score: ${result.score.toFixed(2)})\n`;
              });
              console.log(`Agentic Search: Found ${searchResults.length} results for "${code.name}".`);
            } else {
              console.log(`Agentic Search: No results found for "${code.name}"`);
            }
          } catch (searchError) {
            console.error(`Agentic Search: Error during vector store search for "${code.name}":`, searchError);
            agenticSearchContext += `\n--- Agentic search for "${code.name}" encountered an error. ---\n`;
          }
        }
      }
      agenticSearchContext += '--- End of Agentic Search Information ---\n';
    }
    
    // Secondary LLM call: extract ingredient names from the user query.
    // If extraction or pairing fails, we fall back to the regular flow.
    let extractedIngredients: string[] = [];
    let ingredientFlavorPairings: { [key: string]: any } = {};
    let flavorPairingEnabled = false;
    try {
      const ingredientExtractionPrompt = `
Extract ingredient names from this user query and return ONLY valid JSON with this shape:
{
  "ingredients": ["ingredient1", "ingredient2"]
}

Rules:
- Return lowercase single-ingredient names only (no quantities, no units).
- Do not include cooking methods, tools, or generic words.
- If no ingredient names are found, return {"ingredients": []}.

User query:
${cleanQuery}
      `;
      const extractionResponse = await getGPTResponse(ingredientExtractionPrompt, "gpt-4o");
      const extractionJsonStart = extractionResponse.indexOf("{");
      const extractionJsonEnd = extractionResponse.lastIndexOf("}");
      if (extractionJsonStart !== -1 && extractionJsonEnd !== -1) {
        const parsedExtraction = JSON.parse(extractionResponse.substring(extractionJsonStart, extractionJsonEnd + 1));
        extractedIngredients = Array.isArray(parsedExtraction?.ingredients)
          ? parsedExtraction.ingredients
              .map((ingredient: any) => typeof ingredient === "string" ? ingredient.trim().toLowerCase() : "")
              .filter((ingredient: string) => Boolean(ingredient))
          : [];
      }

      for (const ingredient of extractedIngredients) {
        const compounds = await searchIngredientCompounds(ingredient);
        ingredientFlavorPairings[ingredient] = compounds.compoundDetails;
      }
      flavorPairingEnabled = extractedIngredients.length > 0;
    } catch (err) {
      console.error("[Chat] Ingredient extraction/flavor pairing failed. Falling back to regular flow:", err);
      extractedIngredients = [];
      ingredientFlavorPairings = {};
      flavorPairingEnabled = false;
    }

    const inputIngredientContext = flavorPairingEnabled
      ? `\n\n--- Extracted Ingredients From Query ---\n${extractedIngredients.map((ing) => `- ${ing}`).join('\n')}\n--- End Extracted Ingredients ---\n`
      : '';

    const inputIngredientFlavorContext = flavorPairingEnabled && Object.keys(ingredientFlavorPairings).length > 0
      ? `\n\n--- Flavor Pairing Engine Output For Extracted Ingredients ---\n${Object.entries(ingredientFlavorPairings).map(([ingredient, compounds]) =>
          `- ${ingredient}: ${Array.isArray(compounds) && compounds.length > 0
            ? compounds.slice(0, 5).map((compound: any) => compound?.ingredient_name || compound?.name || 'pair candidate').join(', ')
            : 'No good pairs found'
          }`
        ).join('\n')}\n--- End Flavor Pairing Engine Output ---\n`
      : '';

    // The query for the LLM includes the user's food query and any context from agentic search.
    const queryForProcessing = `${agenticSearchContext}${cleanQuery}${inputIngredientContext}${inputIngredientFlavorContext}`;
    if (agenticSearchContext) { // Removed csvDerivedContext from condition
        console.log("Query with context(s):", queryForProcessing)
    }

    // Step 1: Query Guardrails using AWS Bedrock (Meta Llama 3.1 Instruct)
    // const llamaGuardrails = await bedrockChat({
    //   modelId: "meta.llama3-1-8b-instruct-v1:0",
    //   messages: [{ role: "user", content: queryForProcessing }],
    //   maxTokens: 128,
    //   temperature: 0.0,
    // });

    const allowedKeywords = ["food", "nutrition", "recipe", "ingredients", "cooking", "dish", "meal", "flavor", "spice", "vegetable", "fruit", "meat", "fish", "herb", "spices"];
    // Check for food-related keywords on the cleaned query
    const isFoodRelated = allowedKeywords.some((word) => cleanQuery.toLowerCase().includes(word)); 

    // if (!isFoodRelated && llamaGuardrails.toLowerCase().includes("no")) {
    //   return NextResponse.json(
    //     { error: "Your query does not comply with our safety guidelines." },
    //     { status: 400 }
    //   );
    // }

    let nutritionDataApi;
    try {
      nutritionDataApi = await fetchNutritionData(cleanQuery);
    } catch (error) {
      console.error("Nutrition service failed:", error);
      // We can still proceed without this data, but the response will be less detailed.
      // The prompt will just have empty sections for the nutrition data.
      nutritionDataApi = null;
    }

    const gptPrompt1 = `
    IMPORTANT: The context and data provided below are exclusively for queries related to food, nutrition, and culinary topics. 
    If the user's query is not related to food or nutrition, ignore all provided context and respond with the following JSON:
    
    {
      "error": "Only queries related to food and nutrition are allowed."
    }
    
    User Query: ${queryForProcessing}
    Health Effect IDs: ${Array.isArray(healthEffectIds) && healthEffectIds.length > 0 ? healthEffectIds.join(', ') : 'none'}
    Extracted Ingredients: ${extractedIngredients.length > 0 ? extractedIngredients.join(', ') : 'none'}
    
    ** USDA Food Data **:
    ${nutritionDataApi?.usdaData
        ?.map((food: Food) => `${food.name} - ${food.calories} kcal, ${food.protein}g protein`)
        .join("\n")}
    
    ** Spoonacular Recipes **:
    ${nutritionDataApi?.spoonacularData
        ?.map((recipe: SpoonacularRecipe) => `${recipe.title} (${recipe.image})`)
        .join("\n")}
    
    Based on the provided data, generate a **food pairing recommendation**.
    If Extracted Ingredients are provided, you MUST include all of them in the generated recipe.
    Use the flavor pairing output from the provided context to choose supporting ingredients that pair well.
    If Health Effect IDs are provided, recipes should align with those health objectives.
    If nutrition guidance context or agentic search information was provided above (related to an indicated condition or search), ensure your recommendations align with it, prioritizing specific guidance if present.
    
    Don't make it look like a AI generated response. Make it look like a human wrote it.
    Make it look like a recipe from a cookbook. 

    For example don't say this: Certainly! Here's an enhanced version of the "Grilled Chicken with Garlic and Herbs" recipe, incorporating best practices and additional context based on the information provided:
    Instead just say the recipe. Also don't say "Certainly!" or anything like that. Just say the recipe. Don't say "Here's an enhanced version of the recipe" or anything like that. Just say the recipe. 
    Also don't say This refined version of Herb Roasted Chicken Thighs takes into account the best techniques and flavor combinations to elevate the dish. Follow these detailed instructions to achieve perfectly roasted thighs with a robust herb crust and a hint of lemon zing.
    Instead just say the recipe.

    Additionally, extract the **main ingredients** from the generated recipe and store them in a variable called **mainIngredients**. 
    Each main ingredient should be represented as a single word that captures the core ingredient.
    
    Complexity level requested: ${complexity} (1 = very simple, 5 = advanced). Adjust the number of ingredients, techniques, prep/cook time, and number of steps to match this level.
    
    Your output MUST be in JSON format with the following EXACT structure:
    
    {
      "recipe": {
        "name": "Recipe Name",
        "ingredients": [
          {
            "item": "ingredient name",
            "amount": number,
            "unit": "measurement unit"
          }
        ],
        "instructions": [
          "Step 1: Do this",
          "Step 2: Do that with temperature and time",
          "Step 3: Final step"
        ],
        "servings": number
      },
      "mainIngredients": ["ingredient1", "ingredient2"]
    }

    IMPORTANT FORMATTING RULES:
    1. Each ingredient MUST have amount as a number and unit as a string
    2. Instructions MUST be an array of strings
    3. Servings MUST be a number
    4. Include cooking temperatures and times in instructions
    5. Break down instructions into clear, numbered steps
    6. Ensure overall complexity aligns with ${complexity} (1=simple, 5=advanced)
    `;

    const gptResponse1 = await getGPTResponse(gptPrompt1, "gpt-4o");

    const jsonStart = gptResponse1.indexOf("{");
    const jsonEnd = gptResponse1.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("No valid JSON found in GPT response");
    }

    const parsedResponse = JSON.parse(gptResponse1.substring(jsonStart, jsonEnd + 1));

    if (parsedResponse.error) {
      return NextResponse.json({ error: parsedResponse.error }, { status: 400 });
    }

    let recipeForProcessing: Recipe = parsedResponse.recipe as Recipe;

    // --- New step: Parse instructions with an LLM for DAG validation ---
    if (recipeForProcessing.instructions && recipeForProcessing.instructions.length > 0) {
      const ingredientsContext = recipeForProcessing.ingredients.map(ing => `${ing.item} (${ing.amount} ${ing.unit})`).join(', ');
      const instructionsContext = recipeForProcessing.instructions.map((instr, idx) => `${idx + 1}. ${instr}`).join('\n');

      const instructionParsingPrompt = `
Given the following recipe ingredients and instructions:

Ingredients:
${ingredientsContext}

Instructions (numbered for clarity):
${instructionsContext}

Your task is to parse each instruction step into a list of its primary input ingredients/intermediates and the main output/intermediate product of that step.

Follow these rules:
1.  The "inputs" should be a list of strings. These strings should correspond to item names from the "Ingredients" list or outputs from previous steps.
2.  The "output" should be a single string describing the product of the step. If an ingredient is modified (e.g., "chopped onions"), the output is the modified ingredient. If multiple ingredients are combined, the output is the combined mixture (e.g., "dough", "sauce base").
3.  If a step describes an action without a direct food transformation (e.g., "Preheat oven to 350°F"), its output can be a description of the state (e.g., "oven preheated") or a placeholder like "N/A" if it doesn't produce a new food item. Focus on tangible food transformations.
4.  For inputs, if an ingredient is used from the initial list, use its name. If an intermediate product from a previous step is used, use the name of that intermediate product.
5.  Be concise with input and output names. Prefer lowercase.

Example 1 (Ingredient: "onions"):
Instruction: "1. Dice the onions."
Output: { "inputs": ["onions"], "output": "diced onions" }

Example 2 (Ingredients: "flour", "sugar", "salt"):
Instruction: "1. Combine flour, sugar, and salt in a bowl."
Output: { "inputs": ["flour", "sugar", "salt"], "output": "dry ingredient mixture" }

Example 3 (Assuming "diced onions", "minced garlic" are outputs from previous steps, "olive oil" is an ingredient):
Instruction: "1. Sauté diced onions and minced garlic in olive oil until fragrant."
Output: { "inputs": ["diced onions", "minced garlic", "olive oil"], "output": "sautéed aromatics" }

Example 4 (Assuming "casserole mixture" was the output of a previous step):
Instruction: "1. Bake for 20 minutes."
Output: { "inputs": ["casserole mixture"], "output": "baked casserole" }

Return ONLY a JSON array of objects, where each object has the structure:
{
  "inputs": ["ingredient1", "intermediate2"],
  "output": "resulting_product_or_state"
}
The array must have one object for each instruction. If an instruction is ambiguous or doesn't fit, use your best judgment or placeholders like "N/A" for inputs/outputs but maintain the JSON structure for each step.
Ensure the output is a valid JSON array.
      `;
      try {
        const instructionParsingGptResponse = await getGPTResponse(instructionParsingPrompt, "gpt-4o");
        const parsedInstructionsJsonStart = instructionParsingGptResponse.indexOf("[");
        const parsedInstructionsJsonEnd = instructionParsingGptResponse.lastIndexOf("]");
        if (parsedInstructionsJsonStart !== -1 && parsedInstructionsJsonEnd !== -1) {
          const parsedInstructionsResult = JSON.parse(instructionParsingGptResponse.substring(parsedInstructionsJsonStart, parsedInstructionsJsonEnd + 1));
          recipeForProcessing.parsedInstructions = parsedInstructionsResult;
          console.log("Successfully parsed instructions for DAG:", recipeForProcessing.parsedInstructions);
        } else {
          console.warn("Could not find valid JSON array in instruction parsing response:", instructionParsingGptResponse);
        }
      } catch (err) {
        console.error("Error parsing instructions with LLM:", err);
        // Proceed without parsedInstructions if parsing fails
      }
    }
    // --- End of new step ---

    // Call comprehensive validation
    const comprehensiveValidationResult: ComprehensiveValidationResult = validateRecipe(recipeForProcessing, undefined /* No specific category determined here */);

    if (!comprehensiveValidationResult.structureValid) {
      console.log("Recipe validation failed: Invalid structure based on comprehensive check.");
      // Optionally, return error or handle as needed
      // For now, we'll log and continue, as other parts might still be useful or the original recipe could be returned.
    }
    
    if (comprehensiveValidationResult.ingredientConnectionsValidDag === false) {
      console.log("Ingredient Connections DAG is NOT valid. Issues:", comprehensiveValidationResult.ingredientConnectionsDagIssues);
    } else if (comprehensiveValidationResult.ingredientConnectionsValidDag === true) {
      console.log("Ingredient Connections DAG is valid.");
    }
   

    const mainIngredients = parsedResponse.mainIngredients;
    const flavorPairings: { [key: string]: any } = {};
    const ingredientsToPair = Array.from(new Set([...extractedIngredients, ...(Array.isArray(mainIngredients) ? mainIngredients : [])]));
    for (const ingredient of ingredientsToPair) {
      try {
        const compounds = await searchIngredientCompounds(ingredient);
        flavorPairings[ingredient] = compounds.compoundDetails;
      } catch (err) {
        console.error(`Error fetching compounds for ${ingredient}:`, err);
        flavorPairings[ingredient] = "No data available";
      }
    }

    let vectorStoreInsights = null;
    try {
      const searchQuery = `${recipeForProcessing.name} ${Object.keys(flavorPairings).join(' ')}`;
      vectorStoreInsights = await runAgent(JSON.stringify({
        ...recipeForProcessing,
        flavorCompounds: flavorPairings
      }));
    } catch (error: any) {
      vectorStoreInsights = {
        enhancedRecipe: {
          similarRecipes: [],
          ingredientEnhancements: [],
          instructionEnhancements: [],
          fallbackMessage: "Vector store search for recipe enhancement temporarily unavailable. Proceeding with basic recipe enhancement."
        }
      };
    }

    // --- Create Condition-Specific Dietary Guardrails ---
    let dietaryGuardrails = "";
    if (diagnosticCodes && diagnosticCodes.length > 0) {
      const conditionNames = diagnosticCodes.map(c => c.name.toLowerCase()).join(' ');
      if (conditionNames.includes('diabetes')) {
        dietaryGuardrails = `
**CRITICAL DIETARY GUARDRAIL: DIABETES**
The user has diabetes. The recipe MUST strictly adhere to the following:
- **ZERO GRANULATED SUGAR, brown sugar, honey, or maple syrup.** Use only low-glycemic, diabetes-safe sweeteners (e.g., monk fruit, stevia, erythritol). Specify the equivalent amount.
- **NO REFINED FLOUR.** Use whole-wheat flour, almond flour, coconut flour, or other low-carbohydrate, high-fiber alternatives.
- **Maximize fiber and protein** to help manage blood sugar.
- The final recipe's carbohydrate and sugar content per serving must be suitable for a diabetic diet.
This is not a suggestion. It is a mandatory requirement for user safety.
        `;
      }
      // Future guardrails for other conditions (e.g., hypertension, CKD) can be added here.
    }

    // --- Pull Flavor Recommender guidance (only via /recommend) ---
    // Uses external FastAPI service and feeds its prompt/pairs into our LLM prompt context
    let flavorRecommenderContext = "";
    try {
      if (Array.isArray(healthEffectIds) && healthEffectIds.length > 0) {
        console.log('[Chat] Calling Flavor Recommender with ids:', healthEffectIds.join(', '))
        const rec = await fetchFlavorRecommendation(healthEffectIds, 10, 5);
        if (rec) {
          console.log('[Chat] Flavor Recommender result summary:', {
            promptChars: rec.prompt ? rec.prompt.length : 0,
            pairs: Array.isArray(rec.pairs) ? rec.pairs.length : 0,
            ingredientNamesPreview: Array.isArray(rec.ingredient_names) ? rec.ingredient_names.slice(0, 3) : []
          })
          if (rec.prompt) {
            flavorRecommenderContext += `\n--- Flavor Network Guidance ---\n${rec.prompt}\n`;
          }
          if (Array.isArray(rec.pairs) && rec.pairs.length > 0) {
            const topPairs = rec.pairs.slice(0, 5)
              .map(p => `- ${p.ingredient_a} + ${p.ingredient_b} (score: ${p.pair_score.toFixed(2)})`)
              .join('\n');
            flavorRecommenderContext += `\nTop Flavor Pairs (from Flavor Recommender):\n${topPairs}\n--- End Flavor Network Guidance ---\n`;
          }
          console.log('[Chat] Flavor Recommender context length:', flavorRecommenderContext.length)
        }
      }
    } catch (e) {
      console.error('[Chat] Flavor Recommender integration failed:', e);
    }

    const enhancedPrompt = `
**SYSTEM MANDATE: Your highest priority is clinical safety and therapeutic relevance. The recipe you generate must be strictly appropriate for the user's provided health condition(s). Failure to do so is a critical error.**

${dietaryGuardrails}

User Query: ${cleanQuery}
Health Effect IDs: ${Array.isArray(healthEffectIds) && healthEffectIds.length > 0 ? healthEffectIds.join(', ') : 'none'}
Extracted Ingredients: ${extractedIngredients.length > 0 ? extractedIngredients.join(', ') : 'none'}
${agenticSearchContext}
${flavorRecommenderContext}

Original Recipe:
${JSON.stringify(recipeForProcessing, null, 2)}

Key Flavor Compounds:
${Object.entries(flavorPairings).slice(0, 3).map(([ingredient, compounds]) => 
  `- ${ingredient}: ${typeof compounds === 'string' ? compounds : (Array.isArray(compounds) ? compounds.slice(0, 2).join(', ') : 'Invalid compound data')}`
).join('\n')}

${vectorStoreInsights?.enhancedRecipe?.fallbackMessage ? `
${vectorStoreInsights.enhancedRecipe.fallbackMessage}
` : `
Top Similar Recipes (${Math.min(2, vectorStoreInsights?.enhancedRecipe?.similarRecipes?.length || 0)}):
${vectorStoreInsights?.enhancedRecipe?.similarRecipes?.slice(0, 2).map((r: { name: string; score: number }) => 
  `- ${r.name} (Score: ${r.score.toFixed(2)})`
).join('\n')}

Key Ingredient Insights (${Math.min(2, vectorStoreInsights?.enhancedRecipe?.ingredientEnhancements?.length || 0)}):
${vectorStoreInsights?.enhancedRecipe?.ingredientEnhancements?.slice(0, 2).map((ing: { 
  ingredient: string; 
  similarIngredients: Array<{ name: string }> 
}) => 
  `- ${ing.ingredient}: ${ing.similarIngredients.slice(0, 1).map((s: { name: string }) => s.name).join(', ')}`
).join('\n')}

Top Technique Tips (${Math.min(2, vectorStoreInsights?.enhancedRecipe?.instructionEnhancements?.length || 0)}):
${vectorStoreInsights?.enhancedRecipe?.instructionEnhancements?.slice(0, 2).map((inst: { instruction: string }) => 
  `- ${inst.instruction.substring(0, 100)}...`
).join('\n')}
`}

**RESPONSE DIRECTIVE:**
You are an expert clinical nutritionist and a Michelin-starred chef. Your response MUST be a complete, delicious, and, above all, **medically appropriate recipe** for the user's stated health conditions.

Using the above information, generate an enhanced recipe that:
1. **Adheres strictly to the CRITICAL DIETARY GUARDRAIL if one is present.** This is your most important instruction.
2. If Extracted Ingredients are provided, include all of them in the final recipe.
3. If Health Effect IDs are provided, optimize ingredient choices and preparation method for those effects.
4. Use flavor-pairing guidance from both ingredient compounds and flavor network recommendations.
5. ${vectorStoreInsights?.enhancedRecipe?.fallbackMessage ? 'Uses the flavor compounds information to suggest optimal ingredient combinations' : 'Incorporates the best practices from similar recipes'}
6. Includes detailed instructions with specific temperatures, times, and techniques
7. ${vectorStoreInsights?.enhancedRecipe?.fallbackMessage ? 'Provides specific measurements and timing for each step' : 'References specific techniques or tips from the similar recipes and instructions'}
8. Match the requested complexity level of ${complexity} (1=simple, 5=advanced) by adjusting number of ingredients, steps, and techniques
`;

    const finalResponse = await getGPTResponse(enhancedPrompt, "gpt-4o");

    const personalizedIntro = diagnosticCodes && diagnosticCodes.length > 0
      ? `For your condition(s), "${diagnosticCodes.map(c => c.name).join(', ')}", the following recipe has been designed to be both delicious and supportive of your health needs.\n\n`
      : "";

    // Build Instacart link from generated recipe
    let instacartLink: string | null = null;
    let instacartImageUrl: string | undefined = undefined;
    try {
      console.log('[Instacart] Building payload from recipe:', {
        title: recipeForProcessing.name,
        servings: recipeForProcessing.servings,
        instructionsCount: Array.isArray(recipeForProcessing.instructions) ? recipeForProcessing.instructions.length : 0,
        ingredientCount: Array.isArray(recipeForProcessing.ingredients) ? recipeForProcessing.ingredients.length : 0,
      });
      const payload = buildInstacartRecipePayload({
        title: recipeForProcessing.name || "CulinAI Recipe",
        servings: recipeForProcessing.servings,
        instructions: recipeForProcessing.instructions,
        ingredients: recipeForProcessing.ingredients?.map(ing => ({
          item: ing.item,
          amount: typeof ing.amount === 'number' ? ing.amount : undefined,
          unit: typeof ing.unit === 'string' ? ing.unit : undefined,
        })) || [],
        linkbackUrl: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}` : undefined,
      });
      // If we have a spoonacular image, pass it as the Instacart recipe image
      if (nutritionDataApi?.spoonacularData && nutritionDataApi.spoonacularData.length > 0) {
        const firstImage = nutritionDataApi.spoonacularData[0]?.image;
        if (firstImage && typeof firstImage === 'string') {
          (payload as any).image_url = firstImage;
          instacartImageUrl = firstImage;
        }
      }
      console.log('[Instacart] Payload built. Creating recipe page...');
      const icResp = await createInstacartRecipePage(payload);
      if (icResp?.products_link_url) {
        instacartLink = icResp.products_link_url;
        console.log('[Instacart] Received products link URL:', instacartLink);
      }
    } catch (e) {
      console.error('Failed to create Instacart recipe link:', e);
    }

    return NextResponse.json({
      enhancedResponse: personalizedIntro + finalResponse,
      vectorStoreInsights: vectorStoreInsights || null,
      nutrition: nutritionDataApi || null,
      instacart: instacartLink ? { products_link_url: instacartLink, image_url: instacartImageUrl } : null,
      user: {
        id: user.sub,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Error in API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});