import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";

// Define an interface for the CSV row structure
interface CombinedDataRow {
    ingredient_name?: string;
    // Add other properties from your CSV header here if needed
}

// Load CSV data
const loadCSV = (filename: string) => {
    const filePath = path.join(process.cwd(), "python", filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return Papa.parse<CombinedDataRow>(fs.readFileSync(filePath, "utf8"), { header: true }).data;
};

// Load the final combined compound data (with safe fallback)
let combinedData: CombinedDataRow[] = [];
try {
    combinedData = loadCSV("final_combined_output.txt");
} catch (err) {
    console.warn("Combined compound data file missing; using empty dataset for now.");
    combinedData = [];
}

export const searchIngredientCompounds = (ingredient: string) => {
    // console.log(`🔍 Searching for ingredient: ${ingredient}`);
    
    const normalizedIngredient = ingredient.toLowerCase();
    let compoundMatches = combinedData.filter(row => 
        row.ingredient_name?.toLowerCase().includes(normalizedIngredient)
    );

    // Limit results to first 10 matches
    compoundMatches = compoundMatches.slice(0, 10);

    if (compoundMatches.length === 0) {
        console.warn(`⚠️ No compounds found for ingredient: "${ingredient}"`);
        return { compoundDetails: [] };
    }

    return { compoundDetails: compoundMatches };
};

// API route for Next.js
export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();
        if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

        // Search for ingredient-related compounds
        const pairings = searchIngredientCompounds(query);
        if (!pairings.compoundDetails.length) return NextResponse.json({ error: "No matches found" }, { status: 404 });

        return NextResponse.json({
            query,
            compounds: pairings.compoundDetails,
        });
    } catch (error) {
        console.error("Error in API:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}