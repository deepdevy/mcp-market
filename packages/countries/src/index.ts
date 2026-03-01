#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-countries",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface CountryData {
  name: {
    official: string;
    common: string;
  };
  capital?: string[];
  population: number;
  region: string;
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { name: string; symbol: string }>;
  timezones: string[];
  flags: {
    png: string;
    svg: string;
    alt?: string;
  };
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_country_info",
  "Get detailed information about a country by name",
  {
    name: z.string().describe("Country name (e.g. France, Japan, Brazil)"),
  },
  async ({ name }) => {
    const data = await fetchJSON<CountryData[]>(
      buildURL("https://restcountries.com/v3.1/name/{name}", {
        fullText: "false",
      }).replace("{name}", encodeURIComponent(name))
    );

    if (!Array.isArray(data) || data.length === 0) {
      return error(`Country "${name}" not found`);
    }

    const country = data[0];
    const languages = country.languages
      ? Object.values(country.languages).join(", ")
      : "N/A";
    const currencies = country.currencies
      ? Object.entries(country.currencies)
          .map(([code, info]) => `${code} (${info.name})`)
          .join(", ")
      : "N/A";
    const capital = country.capital?.join(", ") || "N/A";
    const timezones = country.timezones.join(", ");

    return text(
      keyValue({
        "🌍 Official Name": country.name.official,
        "🏙️ Capital": capital,
        "👥 Population": country.population.toLocaleString(),
        "🗺️ Region": country.region,
        "📍 Subregion": country.subregion || "N/A",
        "🗣️ Languages": languages,
        "💱 Currencies": currencies,
        "⏰ Timezones": timezones,
        "🚩 Flag": country.flags.alt || "🚩",
      })
    );
  }
);

server.tool(
  "compare_countries",
  "Compare two countries side-by-side",
  {
    country1: z.string().describe("First country name"),
    country2: z.string().describe("Second country name"),
  },
  async ({ country1, country2 }) => {
    const data1 = await fetchJSON<CountryData[]>(
      buildURL("https://restcountries.com/v3.1/name/{name}", {
        fullText: "false",
      }).replace("{name}", encodeURIComponent(country1))
    );

    const data2 = await fetchJSON<CountryData[]>(
      buildURL("https://restcountries.com/v3.1/name/{name}", {
        fullText: "false",
      }).replace("{name}", encodeURIComponent(country2))
    );

    if (!Array.isArray(data1) || data1.length === 0) {
      return error(`Country "${country1}" not found`);
    }

    if (!Array.isArray(data2) || data2.length === 0) {
      return error(`Country "${country2}" not found`);
    }

    const c1 = data1[0];
    const c2 = data2[0];

    const comparison = [
      `📊 COMPARISON: ${c1.name.common} vs ${c2.name.common}`,
      "",
      `Official Name:     ${c1.name.official} | ${c2.name.official}`,
      `Capital:           ${c1.capital?.join(", ") || "N/A"} | ${c2.capital?.join(", ") || "N/A"}`,
      `Population:        ${c1.population.toLocaleString()} | ${c2.population.toLocaleString()}`,
      `Region:            ${c1.region} | ${c2.region}`,
      `Subregion:         ${c1.subregion || "N/A"} | ${c2.subregion || "N/A"}`,
      `Languages:         ${Object.values(c1.languages || {}).join(", ") || "N/A"} | ${Object.values(c2.languages || {}).join(", ") || "N/A"}`,
      `Currencies:        ${Object.keys(c1.currencies || {}).join(", ") || "N/A"} | ${Object.keys(c2.currencies || {}).join(", ") || "N/A"}`,
      `Timezones:         ${c1.timezones.length} | ${c2.timezones.length}`,
    ];

    return text(comparison.join("\n"));
  }
);

server.tool(
  "search_by_language",
  "Find all countries that speak a specific language",
  {
    language: z
      .string()
      .describe("Language code (e.g. en, es, fr) or language name"),
  },
  async ({ language }) => {
    const data = await fetchJSON<CountryData[]>(
      buildURL("https://restcountries.com/v3.1/lang/{language}", {}).replace(
        "{language}",
        encodeURIComponent(language)
      )
    );

    if (!Array.isArray(data) || data.length === 0) {
      return error(`No countries found for language "${language}"`);
    }

    const countries = data.map((c) => c.name.common).sort();

    return text(
      `Countries speaking ${language}:\n\n${countries.map((c) => `• ${c}`).join("\n")}`
    );
  }
);

server.tool(
  "search_by_currency",
  "Find all countries that use a specific currency",
  {
    currency: z
      .string()
      .describe("Currency code (e.g. USD, EUR, GBP) or currency name"),
  },
  async ({ currency }) => {
    const data = await fetchJSON<CountryData[]>(
      buildURL("https://restcountries.com/v3.1/currency/{currency}", {}).replace(
        "{currency}",
        encodeURIComponent(currency)
      )
    );

    if (!Array.isArray(data) || data.length === 0) {
      return error(`No countries found for currency "${currency}"`);
    }

    const countries = data.map((c) => c.name.common).sort();

    return text(
      `Countries using ${currency}:\n\n${countries.map((c) => `• ${c}`).join("\n")}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
