import { validateRecipe, Recipe, ParsedInstruction } from './recipeValidation';

describe('Recipe DAG Validation', () => {
  const recipes: Array<{ name: string; recipe: Recipe; expectedDagResult: boolean; expectedIssues?: string[] }> = [
    // --- GOOD RECIPES ---
    {
      name: 'Good Recipe - Simple Linear Flow',
      recipe: {
        name: 'Boiled Egg',
        ingredients: [
          { item: 'egg', amount: 1, unit: 'piece' },
          { item: 'water', amount: 1, unit: 'cup' },
        ],
        instructions: [
          'Place egg in a saucepan.',
          'Add water to cover the egg.',
          'Bring water to a boil.',
          'Cook for 10 minutes.',
          'Remove egg and cool.',
        ],
        servings: 1,
        parsedInstructions: [
          { inputs: ['egg'], output: 'egg in pan' },
          { inputs: ['water', 'egg in pan'], output: 'egg in water' },
          { inputs: ['egg in water'], output: 'boiling egg in water' },
          { inputs: ['boiling egg in water'], output: 'cooked egg' },
          { inputs: ['cooked egg'], output: 'cooled egg' },
        ],
      },
      expectedDagResult: true,
    },
    {
      name: 'Good Recipe - With Branching and Joining',
      recipe: {
        name: 'Simple Salad',
        ingredients: [
          { item: 'lettuce', amount: 1, unit: 'head' },
          { item: 'tomato', amount: 2, unit: 'pieces' },
          { item: 'cucumber', amount: 1, unit: 'piece' },
          { item: 'olive oil', amount: 2, unit: 'tbsp' },
          { item: 'lemon juice', amount: 1, unit: 'tbsp' },
        ],
        instructions: [
          'Wash and chop lettuce.',
          'Dice tomatoes.',
          'Slice cucumber.',
          'Combine lettuce, tomatoes, and cucumber in a bowl.',
          'In a separate small bowl, whisk olive oil and lemon juice.',
          'Pour dressing over salad and toss.',
        ],
        servings: 2,
        parsedInstructions: [
          { inputs: ['lettuce'], output: 'chopped lettuce' },
          { inputs: ['tomato'], output: 'diced tomatoes' },
          { inputs: ['cucumber'], output: 'sliced cucumber' },
          { inputs: ['chopped lettuce', 'diced tomatoes', 'sliced cucumber'], output: 'vegetable mix' },
          { inputs: ['olive oil', 'lemon juice'], output: 'dressing' },
          { inputs: ['vegetable mix', 'dressing'], output: 'tossed salad' },
        ],
      },
      expectedDagResult: true,
    },
    // --- BAD RECIPES ---
    {
      name: 'Bad Recipe - Ingredient Used Before Produced',
      recipe: {
        name: 'Broken Omelette',
        ingredients: [
          { item: 'eggs', amount: 2, unit: 'pieces' },
          { item: 'milk', amount: 1, unit: 'tbsp' },
          { item: 'butter', amount: 1, unit: 'tsp' },
        ],
        instructions: [
          'Whisk eggs and milk.', // Produces 'egg mixture'
          'Pour egg mixture into hot pan with melted butter.', // Uses 'melted butter' before it's made
          'Melt butter in a pan.', // Produces 'melted butter'
          'Cook until set.',
        ],
        servings: 1,
        parsedInstructions: [
          { inputs: ['eggs', 'milk'], output: 'egg mixture' },
          { inputs: ['egg mixture', 'melted butter'], output: 'omelette cooking' }, // 'melted butter' not yet available
          { inputs: ['butter'], output: 'melted butter' },
          { inputs: ['omelette cooking'], output: 'cooked omelette' },
        ],
      },
      expectedDagResult: false,
      expectedIssues: ["Step 2 ('Pour egg mixture into hot pan with melted butter.'): Input 'melted butter' is not available. It is produced in a later step (Step 3)."],
    },
    {
      name: 'Bad Recipe - Missing Input Ingredient from Main List',
      recipe: {
        name: 'Mystery Stir Fry',
        ingredients: [
          { item: 'chicken', amount: 200, unit: 'g' },
          { item: 'soy sauce', amount: 2, unit: 'tbsp' },
        ],
        instructions: [
          'Slice chicken.',
          'Stir-fry chicken with soy sauce and broccoli.', // 'broccoli' is not in ingredients
          'Serve hot.',
        ],
        servings: 1,
        parsedInstructions: [
          { inputs: ['chicken'], output: 'sliced chicken' },
          { inputs: ['sliced chicken', 'soy sauce', 'broccoli'], output: 'stir fry' },
          { inputs: ['stir fry'], output: 'served stir fry' },
        ],
      },
      expectedDagResult: false,
      expectedIssues: ["Step 2 ('Stir-fry chicken with soy sauce and broccoli.'): Input 'broccoli' is not available. It is not in the recipe ingredients and not produced by a previous step."],
    },
    {
      name: 'Bad Recipe - Circular Dependency (Conceptual)',
      recipe: {
        name: 'Circular Cake',
        ingredients: [{ item: 'flour', amount: 1, unit: 'cup' }, { item: 'sugar', amount: 1, unit: 'cup' }],
        instructions: [
          'Mix flour and sugar to make batter.', // batter depends on flour, sugar
          'Prepare frosting using some of the batter.', // frosting depends on batter
          'Adjust batter consistency using some of the frosting.', // batter depends on frosting - circular!
          'Bake batter.',
        ],
        servings: 8,
        parsedInstructions: [
          { inputs: ['flour', 'sugar'], output: 'batter' },
          { inputs: ['batter'], output: 'frosting base' }, // Simplified for example
          { inputs: ['frosting base'], output: 'batter' }, // This creates the circular dependency
          { inputs: ['batter'], output: 'baked cake' },
        ]
      },
      expectedDagResult: false,
      expectedIssues: [
        "Circular dependency detected involving nodes: batter -> frosting base -> batter",
      ]
    },
    // Add more good and bad recipes here to reach 10 total
    // Remember to define `parsedInstructions` for each.
    // For bad recipes, also define `expectedIssues` if you want to check specific error messages.
  ];

  recipes.forEach(({ name, recipe, expectedDagResult, expectedIssues }) => {
    test(`Recipe: "${name}" - DAG validation should be ${expectedDagResult ? 'valid' : 'invalid'}`, () => {
      const result = validateRecipe(recipe, undefined); // Assuming category is not strictly needed for DAG validation part
      expect(result.ingredientConnectionsValidDag).toBe(expectedDagResult);
      if (expectedIssues && result.ingredientConnectionsDagIssues) {
        expectedIssues.forEach(issue => {
          expect(result.ingredientConnectionsDagIssues).toEqual(expect.arrayContaining([expect.stringContaining(issue)]));
        });
      }
    });
  });
}); 