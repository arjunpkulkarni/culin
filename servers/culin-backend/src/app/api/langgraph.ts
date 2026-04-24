import { v4 as uuidv4 } from 'uuid';
import { vectorStore } from './vectorStore';
import type { SearchResult } from './vectorStore';

interface Node {
  id: string;
  type: 'ingredient' | 'instruction' | 'recipe' | 'reference';
  content: string;
  metadata?: Record<string, any>;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export class RecipeGraph {
  private graph: Graph;

  constructor() {
    this.graph = {
      nodes: [],
      edges: [],
    };
  }

  private addNode(node: Node) {
    this.graph.nodes.push(node);
  }

  private addEdge(edge: Edge) {
    this.graph.edges.push(edge);
  }

  async addRecipe(recipe: any) {
    // Add recipe node
    const recipeId = uuidv4();
    this.addNode({
      id: recipeId,
      type: 'recipe',
      content: recipe.name,
      metadata: {
        servings: recipe.servings,
      },
    });

    // Add ingredient nodes and connect to recipe
    for (const ingredient of recipe.ingredients) {
      const ingredientId = uuidv4();
      this.addNode({
        id: ingredientId,
        type: 'ingredient',
        content: ingredient.item,
        metadata: {
          amount: ingredient.amount,
          unit: ingredient.unit,
        },
      });

      this.addEdge({
        source: recipeId,
        target: ingredientId,
        relationship: 'contains',
      });

      // Find relevant reference information for this ingredient
      const references = await vectorStore.searchReference(ingredient.item);
      for (const ref of references) {
        const refId = ref.id;
        this.addEdge({
          source: ingredientId,
          target: refId,
          relationship: 'reference',
        });
      }
    }

    // Add instruction nodes and connect to recipe
    for (let i = 0; i < recipe.instructions.length; i++) {
      const instructionId = uuidv4();
      this.addNode({
        id: instructionId,
        type: 'instruction',
        content: recipe.instructions[i],
        metadata: {
          step: i + 1,
        },
      });

      this.addEdge({
        source: recipeId,
        target: instructionId,
        relationship: 'step',
      });

      // Find relevant reference information for this instruction
      const references = await vectorStore.searchReference(recipe.instructions[i]);
      for (const ref of references) {
        const refId = ref.id;
        this.addEdge({
          source: instructionId,
          target: refId,
          relationship: 'reference',
        });
      }
    }

    return recipeId;
  }

  async findSimilarIngredients(ingredient: string, limit: number = 5) {
    const [similar, references] = await Promise.all([
      vectorStore.search(ingredient, limit, 'ingredient'),
      vectorStore.searchReference(ingredient)
    ]);

    return {
      similar,
      references: references.map(ref => ({
        ...ref,
        source: ref.metadata.source,
        pageNumber: ref.metadata.pageNumber
      }))
    };
  }

  async findSimilarRecipes(recipeName: string, limit: number = 5) {
    const [recipes, references] = await Promise.all([
      vectorStore.search(recipeName, limit, 'recipe'),
      vectorStore.searchReference(recipeName)
    ]);

    return {
      recipes: recipes.filter(result => result.metadata.type === 'recipe'),
      references: references.map(ref => ({
        ...ref,
        source: ref.metadata.source,
        pageNumber: ref.metadata.pageNumber
      }))
    };
  }

  async findRelatedInstructions(instruction: string, limit: number = 5) {
    const [instructions, references] = await Promise.all([
      vectorStore.search(instruction, limit, 'instruction'),
      vectorStore.searchReference(instruction)
    ]);

    return {
      instructions: instructions.filter(result => result.metadata.type === 'instruction'),
      references: references.map(ref => ({
        ...ref,
        source: ref.metadata.source,
        pageNumber: ref.metadata.pageNumber
      }))
    };
  }

  getGraph() {
    return this.graph;
  }
}

// Function to run the agent with vector store integration
export async function runAgent(input: string) {
  try {
    const graph = new RecipeGraph();
    
    // Parse the input as a recipe
    const recipe = JSON.parse(input);
    
    // Add recipe to graph
    const recipeId = await graph.addRecipe(recipe);
    
    // Find similar recipes and references
    const similarRecipes = await graph.findSimilarRecipes(recipe.name);
    
    // Find similar ingredients and their references
    const ingredientSimilarities = await Promise.all(
      recipe.ingredients.map(async (ing: any) => ({
        ingredient: ing.item,
        ...await graph.findSimilarIngredients(ing.item)
      }))
    );
    
    // Get instruction references
    const instructionReferences = await Promise.all(
      recipe.instructions.map(async (instruction: string) => {
        try {
          return {
            instruction,
            ...(await graph.findRelatedInstructions(instruction)),
          };
        } catch (error) {
          console.error(`Error fetching related instructions for: "${instruction.substring(0, 50)}..."`, error);
          // Return a default structure on error to prevent breaking the entire process
          return {
            instruction,
            instructions: [],
            references: [],
          };
        }
      })
    );
    
    // Enhance the recipe with reference information
    const enhancedRecipe = {
      ...recipe,
      similarRecipes: similarRecipes.recipes.map((r: SearchResult) => ({
        name: r.text,
        score: r.score,
        metadata: r.metadata
      })),
      ingredientEnhancements: ingredientSimilarities.map(ing => ({
        ingredient: ing.ingredient,
        similarIngredients: ing.similar.map((s: SearchResult) => ({
          name: s.text,
          score: s.score,
          metadata: s.metadata
        })),
        references: ing.references
      })),
      instructionEnhancements: instructionReferences.map(inst => ({
        instruction: inst.instruction,
        similarInstructions: inst.instructions.map((i: SearchResult) => ({
          text: i.text,
          score: i.score,
          metadata: i.metadata
        })),
        references: inst.references
      }))
    };
    
    return {
      recipeId,
      enhancedRecipe,
      graph: graph.getGraph()
    };
  } catch (error) {
    console.error('Error running agent:', error);
    throw error;
  }
}
