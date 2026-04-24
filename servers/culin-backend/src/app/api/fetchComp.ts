import axios from "axios";

const API_KEY = process.env.FOODB_API_KEY ?? "";
const BASE_URL = process.env.FOODB_BASE_URL ?? "http://35.184.189.38/api/foodb";

export interface FooDBFoodData {
  public_id: string;
  name: string;
}

export interface FooDBCompoundData {
  compound_id: string;
  name: string;
  description?: string;
}

/**
 * Searches FooDB for a food by name and returns the first matching public ID.
 */
async function fetchFoodIdForFoodName(foodName: string): Promise<string | null> {
  try {
    const response = await axios.post(
      `${BASE_URL}/food/search/?api-key=${API_KEY}`,
      { search_term: foodName }
    );
    
    const data = response.data;
    if (data.results && data.results.length > 0) {
      const firstMatch = data.results[0];
      console.log(`Picked first match for "${foodName}": ${firstMatch.name} (ID: ${firstMatch.public_id})`);
      return firstMatch.public_id;
    }
    
    console.warn(`No food found for "${foodName}"`);
    return null;
  } catch (error) {
    console.error(`Error searching for food "${foodName}":`, error);
    return null;
  }
}

/**
 * Retrieves compounds for a given food ID using FooDB.
 * Retries once if a 500 error occurs.
 */
async function fetchFoodCompoundsByFoodId(foodId: string, retry = true): Promise<FooDBCompoundData[]> {
  try {
    console.log(`Fetching compounds for food ID: ${foodId}`);
    const response = await axios.get(
      `${BASE_URL}/food/${foodId}/compounds/?api-key=${API_KEY}`
    );
    const data = response.data;
    
    if (data.num_compounds === 0) {
      console.warn(`No compounds found for food ID "${foodId}" (num_compounds=0)`);
      return [];
    }
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log(`Found ${data.data.length} compounds for food ID "${foodId}"`);
      return data.data as FooDBCompoundData[];
    }
    
    console.warn(`No valid compound data found for food ID "${foodId}"`);
    return [];
  } catch (error) {    
    console.error(`Error fetching compounds for food ID "${foodId}":`, error);
    return [];
  }
}

/**
 * Fetches compound data from FooDB for a given food name.
 * Picks the first valid food match and retrieves its compounds.
 */
export async function fetchCompound(foodName: string): Promise<FooDBCompoundData[]> {
  const foodId = await fetchFoodIdForFoodName(foodName);
  if (!foodId) {
    console.error(`No valid food ID found for "${foodName}".`);
    return [];
  }

  console.log(`Fetching compound data for "${foodName}" with ID "${foodId}"`);
  const compounds = await fetchFoodCompoundsByFoodId(foodId);
  return compounds;
}