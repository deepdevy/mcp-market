#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-names",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface NationalizeResult {
  name: string;
  country?: Array<{
    country_id: string;
    probability: number;
  }>;
}

interface GenderizeResult {
  name: string;
  gender: string;
  probability: number;
  count: number;
}

interface AgifyResult {
  name: string;
  age: number;
  count: number;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "predict_nationality",
  "Predict the nationality of a person based on their name",
  {
    name: z.string().describe("Person's name (e.g. John, Maria, Ahmed)"),
  },
  async ({ name }) => {
    const data = await fetchJSON<NationalizeResult>(
      buildURL("https://api.nationalize.io", {
        name: name,
      })
    );

    if (!data.country || data.country.length === 0) {
      return error(`Could not predict nationality for "${name}"`);
    }

    const top3 = data.country.slice(0, 3);
    const items = top3.map(
      (c) => `${c.country_id}: ${(c.probability * 100).toFixed(1)}%`
    );

    return text(
      keyValue({
        "👤 Name": data.name,
        "🌍 Top countries": numberedList(items, (item) => item),
      })
    );
  }
);

server.tool(
  "predict_gender",
  "Predict the gender of a person based on their name",
  {
    name: z.string().describe("Person's name (e.g. John, Maria, Ahmed)"),
  },
  async ({ name }) => {
    const data = await fetchJSON<GenderizeResult>(
      buildURL("https://api.genderize.io", {
        name: name,
      })
    );

    if (!data.gender) {
      return error(`Could not predict gender for "${name}"`);
    }

    const genderLabel = data.gender === "male" ? "♂️ Male" : "♀️ Female";

    return text(
      keyValue({
        "👤 Name": data.name,
        "⚧️ Gender": genderLabel,
        "📊 Probability": `${(data.probability * 100).toFixed(1)}%`,
        "📈 Sample size": data.count.toString(),
      })
    );
  }
);

server.tool(
  "predict_age",
  "Predict the age of a person based on their name",
  {
    name: z.string().describe("Person's name (e.g. John, Maria, Ahmed)"),
  },
  async ({ name }) => {
    const data = await fetchJSON<AgifyResult>(
      buildURL("https://api.agify.io", {
        name: name,
      })
    );

    if (data.age === null || data.age === undefined) {
      return error(`Could not predict age for "${name}"`);
    }

    return text(
      keyValue({
        "👤 Name": data.name,
        "🎂 Predicted age": data.age.toString(),
        "📈 Sample size": data.count.toString(),
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
