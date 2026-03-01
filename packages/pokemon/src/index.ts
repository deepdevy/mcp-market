#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-pokemon",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface PokemonResponse {
  name: string;
  id: number;
  types: Array<{ type: { name: string } }>;
  height: number;
  weight: number;
  base_experience: number;
  abilities: Array<{ ability: { name: string } }>;
  stats: Array<{ stat: { name: string }; base_stat: number }>;
  sprites: { front_default: string };
}

interface AbilityResponse {
  name: string;
  effect_entries: Array<{
    short_effect: string;
    language: { name: string };
  }>;
  pokemon: Array<{ pokemon: { name: string } }>;
}

interface TypeResponse {
  name: string;
  damage_relations: {
    double_damage_to: Array<{ name: string }>;
    double_damage_from: Array<{ name: string }>;
    half_damage_to: Array<{ name: string }>;
    half_damage_from: Array<{ name: string }>;
  };
  pokemon: Array<{ pokemon: { name: string } }>;
}

interface EvolutionChain {
  species: { name: string };
  evolves_to: EvolutionChain[];
}

interface EvolutionResponse {
  chain: EvolutionChain;
}

interface SpeciesResponse {
  evolution_chain: { url: string };
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_pokemon",
  "Get detailed information about a Pokémon by name",
  {
    name: z.string().describe("Pokémon name (e.g. pikachu, charizard)"),
  },
  async ({ name: rawName }) => {
    const name = rawName.toLowerCase();
    const data = await fetchJSON<PokemonResponse>(
      buildURL(`https://pokeapi.co/api/v2/pokemon/${name}`)
    );

    if (!data.name) return error(`Pokémon "${name}" not found`);

    const types = data.types.map((t) => t.type.name).join(", ");
    const abilities = data.abilities.map((a) => a.ability.name).join(", ");

    const statsMap: Record<string, number> = {};
    data.stats.forEach((s) => {
      statsMap[s.stat.name] = s.base_stat;
    });

    return text(
      keyValue({
        "🔢 ID": data.id,
        "📛 Name": data.name,
        "🏷️ Types": types,
        "📏 Height": `${data.height / 10}m`,
        "⚖️ Weight": `${data.weight / 10}kg`,
        "⭐ Base Experience": data.base_experience,
        "🎯 Abilities": abilities,
        "❤️ HP": statsMap["hp"],
        "⚔️ Attack": statsMap["attack"],
        "🛡️ Defense": statsMap["defense"],
        "✨ Sp. Atk": statsMap["sp-atk"],
        "💫 Sp. Def": statsMap["sp-def"],
        "⚡ Speed": statsMap["speed"],
        "🖼️ Sprite": data.sprites.front_default || "N/A",
      })
    );
  }
);

server.tool(
  "get_ability",
  "Get information about a Pokémon ability",
  {
    name: z.string().describe("Ability name (e.g. static, overgrow)"),
  },
  async ({ name: rawName }) => {
    const name = rawName.toLowerCase();
    const data = await fetchJSON<AbilityResponse>(
      buildURL(`https://pokeapi.co/api/v2/ability/${name}`)
    );

    if (!data.name) return error(`Ability "${name}" not found`);

    const effectEntry = data.effect_entries.find((e) => e.language.name === "en");
    const effect = effectEntry?.short_effect || "No description available";

    const pokemonList = data.pokemon.slice(0, 10).map((p) => p.pokemon.name).join(", ");

    return text(
      keyValue({
        "🎯 Ability": data.name,
        "📖 Effect": effect,
        "👾 Pokémon (first 10)": pokemonList,
      })
    );
  }
);

server.tool(
  "get_type",
  "Get information about a Pokémon type",
  {
    name: z.string().describe("Type name (e.g. fire, water, electric)"),
  },
  async ({ name: rawName }) => {
    const name = rawName.toLowerCase();
    const data = await fetchJSON<TypeResponse>(
      buildURL(`https://pokeapi.co/api/v2/type/${name}`)
    );

    if (!data.name) return error(`Type "${name}" not found`);

    const doubleTo = data.damage_relations.double_damage_to.map((t) => t.name).join(", ");
    const doubleFrom = data.damage_relations.double_damage_from.map((t) => t.name).join(", ");
    const halfTo = data.damage_relations.half_damage_to.map((t) => t.name).join(", ");
    const halfFrom = data.damage_relations.half_damage_from.map((t) => t.name).join(", ");

    return text(
      keyValue({
        "🏷️ Type": data.name,
        "💥 Double damage to": doubleTo || "None",
        "🛡️ Double damage from": doubleFrom || "None",
        "✨ Half damage to": halfTo || "None",
        "💫 Half damage from": halfFrom || "None",
        "👾 Pokémon count": data.pokemon.length,
      })
    );
  }
);

server.tool(
  "get_evolution",
  "Get the evolution chain for a Pokémon species",
  {
    id: z.number().describe("Pokémon species ID (e.g. 1 for Bulbasaur)"),
  },
  async ({ id }) => {
    const data = await fetchJSON<EvolutionResponse>(
      buildURL(`https://pokeapi.co/api/v2/evolution-chain/${id}`)
    );

    if (!data.chain) return error(`Evolution chain ${id} not found`);

    const chain: string[] = [];
    let current = data.chain;

    while (current) {
      chain.push(current.species.name);
      current = current.evolves_to[0];
    }

    const evolutionLine = chain.join(" → ");

    return text(
      keyValue({
        "🔗 Evolution Chain": evolutionLine,
      })
    );
  }
);

server.tool(
  "compare_pokemon",
  "Compare stats of two Pokémon side-by-side",
  {
    pokemon1: z.string().describe("First Pokémon name"),
    pokemon2: z.string().describe("Second Pokémon name"),
  },
  async ({ pokemon1: raw1, pokemon2: raw2 }) => {
    const [pokemon1, pokemon2] = [raw1.toLowerCase(), raw2.toLowerCase()];
    const data1 = await fetchJSON<PokemonResponse>(
      buildURL(`https://pokeapi.co/api/v2/pokemon/${pokemon1}`)
    );
    const data2 = await fetchJSON<PokemonResponse>(
      buildURL(`https://pokeapi.co/api/v2/pokemon/${pokemon2}`)
    );

    if (!data1.name) return error(`Pokémon "${pokemon1}" not found`);
    if (!data2.name) return error(`Pokémon "${pokemon2}" not found`);

    const statsMap1: Record<string, number> = {};
    const statsMap2: Record<string, number> = {};

    data1.stats.forEach((s) => {
      statsMap1[s.stat.name] = s.base_stat;
    });
    data2.stats.forEach((s) => {
      statsMap2[s.stat.name] = s.base_stat;
    });

    const comparison = keyValue({
      [`${data1.name} HP`]: statsMap1["hp"],
      [`${data2.name} HP`]: statsMap2["hp"],
      [`${data1.name} Attack`]: statsMap1["attack"],
      [`${data2.name} Attack`]: statsMap2["attack"],
      [`${data1.name} Defense`]: statsMap1["defense"],
      [`${data2.name} Defense`]: statsMap2["defense"],
      [`${data1.name} Sp. Atk`]: statsMap1["sp-atk"],
      [`${data2.name} Sp. Atk`]: statsMap2["sp-atk"],
      [`${data1.name} Sp. Def`]: statsMap1["sp-def"],
      [`${data2.name} Sp. Def`]: statsMap2["sp-def"],
      [`${data1.name} Speed`]: statsMap1["speed"],
      [`${data2.name} Speed`]: statsMap2["speed"],
    });

    return text(comparison);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
