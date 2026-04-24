import axios from "axios";

export const fetchNutritionData = async (query: string) => {
  try {
    const encodedQuery = encodeURIComponent(query);
    const usdaKey = process.env.USDA_FDC_API_KEY;
    if (!usdaKey) {
      throw new Error("USDA_FDC_API_KEY is not set");
    }
    const usdaResponse = await axios.get(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodedQuery}&api_key=${usdaKey}`
    );
    const usdaData = usdaResponse.data.foods?.map((food: any) => ({
      name: food.description,
      calories: food.foodNutrients.find((n: any) => n.nutrientName === "Energy")?.value || "N/A",
      protein: food.foodNutrients.find((n: any) => n.nutrientName === "Protein")?.value || "N/A",
    }));

    const spoonKey = process.env.SPOONACULAR_API_KEY;
    if (!spoonKey) {
      throw new Error("SPOONACULAR_API_KEY is not set");
    }
    const spoonacularResponse = await axios.get(
      `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodedQuery}&number=3&apiKey=${spoonKey}`
    );
    const spoonacularData = spoonacularResponse.data.map((recipe: any) => ({
      title: recipe.title,
      image: recipe.image,
    }));


    return { usdaData, spoonacularData };
  } catch (error) {
    console.error("Error fetching nutrition data:", error);
    throw new Error("Failed to fetch nutrition data from external services.");
  }
};
