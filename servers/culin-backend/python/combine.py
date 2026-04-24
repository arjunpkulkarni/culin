import pandas as pd

def combine_files(compound_file, ingredient_file, mapping_file, output_file):
    # Read the files as DataFrames
    compounds = pd.read_csv(compound_file, delimiter='\t')
    ingredients = pd.read_csv(ingredient_file, delimiter='\t')
    mapping = pd.read_csv(mapping_file, delimiter='\t')
    
    # Standardize column names (strip spaces and lowercase)
    compounds.columns = compounds.columns.str.strip().str.lower()
    ingredients.columns = ingredients.columns.str.strip().str.lower()
    mapping.columns = mapping.columns.str.strip().str.lower()
    
    # Rename columns to match expected names
    compounds = compounds.rename(columns={'# id': 'id'})
    ingredients = ingredients.rename(columns={'# id': 'id'})
    mapping = mapping.rename(columns={'# ingredient id': 'ingredient id'})
    
    # Merge the mapping file with compound and ingredient details
    merged_df = mapping.merge(compounds, left_on='compound id', right_on='id', how='left')
    merged_df = merged_df.merge(ingredients, left_on='ingredient id', right_on='id', how='left')
    
    # Drop duplicate ID columns and rename for clarity
    merged_df = merged_df.drop(columns=['id_x', 'id_y'], errors='ignore')
    merged_df = merged_df.rename(columns={'compound name': 'compound_name', 'cas number': 'cas_number', 
                                           'ingredient name': 'ingredient_name', 'category': 'ingredient_category'})
    
    # Write to a new text file
    merged_df.to_csv(output_file, sep='\t', index=False)
    print(f"Combined file saved as {output_file}")
    
    # Output a new file
    new_output_file = 'final_combined_output.txt'
    merged_df.to_csv(new_output_file, sep='\t', index=False)
    print(f"New output file saved as {new_output_file}")

# Example usage
combine_files('comp_info.tsv', 'ingr_info.tsv', 'ingr_comp.tsv', 'combined_output.txt')
