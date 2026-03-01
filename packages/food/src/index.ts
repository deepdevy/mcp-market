#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-food",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface Meal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strMealThumb: string;
  strInstructions?: string;
}

interface MealResponse {
  meals: Meal[] | null;
}

interface Cocktail {
  idDrink: string;
  strDrink: string;
  strCategory: string;
  strGlass: string;
  strInstructions: string;
  strDrinkThumb: string;
  strIngredient1?: string;
  strIngredient2?: string;
  strIngredient3?: string;
  strIngredient4?: string;
  strIngredient5?: string;
  strIngredient6?: string;
  strIngredient7?: string;
  strIngredient8?: string;
  strIngredient9?: string;
  strIngredient10?: string;
  strIngredient11?: string;
  strIngredient12?: string;
  strIngredient13?: string;
  strIngredient14?: string;
  strIngredient15?: string;
  strMeasure1?: string;
  strMeasure2?: string;
  strMeasure3?: string;
  strMeasure4?: string;
  strMeasure5?: string;
  strMeasure6?: string;
  strMeasure7?: string;
  strMeasure8?: string;
  strMeasure9?: string;
  strMeasure10?: string;
  strMeasure11?: string;
  strMeasure12?: string;
  strMeasure13?: string;
  strMeasure14?: string;
  strMeasure15?: string;
}

interface CocktailResponse {
  drinks: Cocktail[] | null;
}

// ── Helpers ────────────────────────────────────────────────

function extractIngredients(cocktail: Cocktail): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const ingredient = cocktail[`strIngredient${i}` as keyof Cocktail];
    const measure = cocktail[`strMeasure${i}` as keyof Cocktail];
    if (ingredient && ingredient.trim()) {
      const measureStr = measure && measure.trim() ? `${measure} ` : "";
      ingredients.push(`${measureStr}${ingredient}`);
    }
  }
  return ingredients;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_meal",
  "Search for meals by name",
  {
    query: z.string().describe("Meal name to search for (e.g. 'Pasta', 'Chicken')"),
  },
  async ({ query }) => {
    const data = await fetchJSON<MealResponse>(
      buildURL("https://www.themealdb.com/api/json/v1/1/search.php", {
        s: query,
      })
    );

    if (!data.meals || data.meals.length === 0) {
      return error(`No meals found for "${query}"`);
    }

    const items = data.meals.map((meal) => ({
      name: meal.strMeal,
      category: meal.strCategory,
      area: meal.strArea,
      thumbnail: meal.strMealThumb,
    }));

    return text(
      `🍽️ Meals matching "${query}":\n\n${numberedList(items, (item) => `${item.name} (${item.category}, ${item.area})`)}`
    );
  }
);

server.tool(
  "random_meal",
  "Get a random meal recipe",
  {},
  async () => {
    const data = await fetchJSON<MealResponse>(
      buildURL("https://www.themealdb.com/api/json/v1/1/random.php")
    );

    if (!data.meals || data.meals.length === 0) {
      return error("Failed to fetch random meal");
    }

    const meal = data.meals[0];

    return text(
      keyValue({
        "🍽️ Meal": meal.strMeal,
        "🏷️ Category": meal.strCategory,
        "🌍 Area": meal.strArea,
        "📖 Instructions": truncate(meal.strInstructions || "", 500),
        "🖼️ Image": meal.strMealThumb,
      })
    );
  }
);

server.tool(
  "meals_by_category",
  "Get meals by category",
  {
    category: z.string().describe("Meal category (e.g. 'Seafood', 'Vegetarian', 'Dessert')"),
  },
  async ({ category }) => {
    const data = await fetchJSON<MealResponse>(
      buildURL("https://www.themealdb.com/api/json/v1/1/filter.php", {
        c: category,
      })
    );

    if (!data.meals || data.meals.length === 0) {
      return error(`No meals found in category "${category}"`);
    }

    const items = data.meals.map((meal) => ({
      name: meal.strMeal,
      thumbnail: meal.strMealThumb,
    }));

    return text(
      `🍽️ ${category} meals:\n\n${numberedList(items, (item) => `${item.name}`)}`
    );
  }
);

server.tool(
  "search_cocktail",
  "Search for cocktails by name",
  {
    query: z.string().describe("Cocktail name to search for (e.g. 'Margarita', 'Mojito')"),
  },
  async ({ query }) => {
    const data = await fetchJSON<CocktailResponse>(
      buildURL("https://www.thecocktaildb.com/api/json/v1/1/search.php", {
        s: query,
      })
    );

    if (!data.drinks || data.drinks.length === 0) {
      return error(`No cocktails found for "${query}"`);
    }

    const items = data.drinks.map((cocktail) => ({
      name: cocktail.strDrink,
      category: cocktail.strCategory,
      glass: cocktail.strGlass,
      instructions: truncate(cocktail.strInstructions, 300),
    }));

    return text(
      `🍹 Cocktails matching "${query}":\n\n${numberedList(items, (item) => `${item.name} (${item.category}, served in ${item.glass})\n   ${item.instructions}`)}`
    );
  }
);

server.tool(
  "random_cocktail",
  "Get a random cocktail recipe",
  {},
  async () => {
    const data = await fetchJSON<CocktailResponse>(
      buildURL("https://www.thecocktaildb.com/api/json/v1/1/random.php")
    );

    if (!data.drinks || data.drinks.length === 0) {
      return error("Failed to fetch random cocktail");
    }

    const cocktail = data.drinks[0];
    const ingredients = extractIngredients(cocktail);

    return text(
      keyValue({
        "🍹 Cocktail": cocktail.strDrink,
        "🏷️ Category": cocktail.strCategory,
        "🥃 Glass": cocktail.strGlass,
        "📖 Instructions": cocktail.strInstructions,
        "🧪 Ingredients": ingredients.length > 0 ? ingredients.join(", ") : "None listed",
        "🖼️ Image": cocktail.strDrinkThumb,
      })
    );
  }
);

server.tool(
  "cocktails_by_ingredient",
  "Get cocktails by ingredient",
  {
    ingredient: z.string().describe("Ingredient name (e.g. 'Vodka', 'Lime juice', 'Rum')"),
  },
  async ({ ingredient }) => {
    const data = await fetchJSON<CocktailResponse>(
      buildURL("https://www.thecocktaildb.com/api/json/v1/1/filter.php", {
        i: ingredient,
      })
    );

    if (!data.drinks || data.drinks.length === 0) {
      return error(`No cocktails found with "${ingredient}"`);
    }

    const items = data.drinks.map((cocktail) => ({
      name: cocktail.strDrink,
      thumbnail: cocktail.strDrinkThumb,
    }));

    return text(
      `🍹 Cocktails with ${ingredient}:\n\n${numberedList(items, (item) => `${item.name}`)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
