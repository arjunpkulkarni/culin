"""Initial Layer 1 schema

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2025-02-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("density_g_per_ml", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ingredients_category"), "ingredients", ["category"], unique=False)
    op.create_index(op.f("ix_ingredients_id"), "ingredients", ["id"], unique=False)
    op.create_index(op.f("ix_ingredients_name"), "ingredients", ["name"], unique=True)

    op.create_table(
        "nutrients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("nutrient_number", sa.String(length=10), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_nutrients_id"), "nutrients", ["id"], unique=False)
    op.create_index(op.f("ix_nutrients_name"), "nutrients", ["name"], unique=False)
    op.create_index(op.f("ix_nutrients_nutrient_number"), "nutrients", ["nutrient_number"], unique=True)
    op.create_index(op.f("ix_nutrients_rank"), "nutrients", ["rank"], unique=False)

    op.create_table(
        "cooking_methods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cooking_methods_id"), "cooking_methods", ["id"], unique=False)
    op.create_index(op.f("ix_cooking_methods_name"), "cooking_methods", ["name"], unique=True)

    op.create_table(
        "ingredient_synonyms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=False),
        sa.Column("synonym", sa.String(length=255), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ingredient_id", "synonym", name="uix_ingredient_synonym"),
    )
    op.create_index("idx_synonym_search", "ingredient_synonyms", ["synonym"], unique=False)
    op.create_index(op.f("ix_ingredient_synonyms_id"), "ingredient_synonyms", ["id"], unique=False)
    op.create_index(op.f("ix_ingredient_synonyms_ingredient_id"), "ingredient_synonyms", ["ingredient_id"], unique=False)
    op.create_index(op.f("ix_ingredient_synonyms_synonym"), "ingredient_synonyms", ["synonym"], unique=False)

    op.create_table(
        "usda_foods",
        sa.Column("fdc_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("data_type", sa.String(length=50), nullable=False),
        sa.Column("cooking_state", sa.String(length=50), nullable=True),
        sa.Column("ingredient_id", sa.Integer(), nullable=True),
        sa.Column("publication_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"]),
        sa.PrimaryKeyConstraint("fdc_id"),
    )
    op.create_index("idx_food_cooking_state", "usda_foods", ["cooking_state"], unique=False)
    op.create_index("idx_food_description", "usda_foods", ["description"], unique=False)
    op.create_index(op.f("ix_usda_foods_data_type"), "usda_foods", ["data_type"], unique=False)
    op.create_index(op.f("ix_usda_foods_ingredient_id"), "usda_foods", ["ingredient_id"], unique=False)

    op.create_table(
        "food_nutrients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fdc_id", sa.Integer(), nullable=False),
        sa.Column("nutrient_id", sa.Integer(), nullable=False),
        sa.Column("amount_per_100g", sa.Float(), nullable=False),
        sa.Column("data_points", sa.Integer(), nullable=True),
        sa.Column("min_value", sa.Float(), nullable=True),
        sa.Column("max_value", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["fdc_id"], ["usda_foods.fdc_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nutrient_id"], ["nutrients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fdc_id", "nutrient_id", name="uix_food_nutrient"),
    )
    op.create_index("idx_food_nutrients_lookup", "food_nutrients", ["fdc_id", "nutrient_id"], unique=False)
    op.create_index(op.f("ix_food_nutrients_id"), "food_nutrients", ["id"], unique=False)

    op.create_table(
        "retention_factors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nutrient_id", sa.Integer(), nullable=False),
        sa.Column("cooking_method_id", sa.Integer(), nullable=False),
        sa.Column("retention_factor", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["cooking_method_id"], ["cooking_methods.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nutrient_id"], ["nutrients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nutrient_id", "cooking_method_id", name="uix_nutrient_cooking_method"),
    )
    op.create_index("idx_retention_lookup", "retention_factors", ["nutrient_id", "cooking_method_id"], unique=False)
    op.create_index(op.f("ix_retention_factors_id"), "retention_factors", ["id"], unique=False)

    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_api_keys_id"), "api_keys", ["id"], unique=False)
    op.create_index(op.f("ix_api_keys_is_active"), "api_keys", ["is_active"], unique=False)
    op.create_index(op.f("ix_api_keys_key"), "api_keys", ["key"], unique=True)

    op.create_table(
        "unit_conversions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingredient_id", sa.Integer(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("grams", sa.Float(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_unit_conversion_lookup", "unit_conversions", ["ingredient_id", "unit"], unique=False)
    op.create_index(op.f("ix_unit_conversions_id"), "unit_conversions", ["id"], unique=False)
    op.create_index(op.f("ix_unit_conversions_ingredient_id"), "unit_conversions", ["ingredient_id"], unique=False)
    op.create_index(op.f("ix_unit_conversions_unit"), "unit_conversions", ["unit"], unique=False)


def downgrade() -> None:
    op.drop_table("unit_conversions")
    op.drop_table("api_keys")
    op.drop_table("retention_factors")
    op.drop_table("food_nutrients")
    op.drop_table("usda_foods")
    op.drop_table("ingredient_synonyms")
    op.drop_table("cooking_methods")
    op.drop_table("nutrients")
    op.drop_table("ingredients")
