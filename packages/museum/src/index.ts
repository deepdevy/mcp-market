#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-mk/core";
import { requireEnv } from "@mcp-mk/core";

const API_KEY = requireEnv("HARVARD_ART_API_KEY");

const server = new McpServer({
  name: "mcp-market-museum",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface HarvardObject {
  id: number;
  title: string;
  dated?: string;
  classification?: string;
  technique?: string;
  medium?: string;
  dimensions?: string;
  culture?: string;
  people?: Array<{ name: string }>;
  description?: string;
  primaryimageurl?: string;
  url?: string;
}

interface SearchResponse {
  records: HarvardObject[];
  info?: {
    totalrecords: number;
  };
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_objects",
  "Search Harvard Art Museums collection by keyword",
  {
    query: z.string().describe("Search keyword (e.g. 'portrait', 'landscape', 'sculpture')"),
    size: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ query, size }) => {
    const data = await fetchJSON<SearchResponse>(
      buildURL("https://api.harvardartmuseums.org/object", {
        apikey: API_KEY,
        keyword: query,
        size: size,
      })
    );

    if (!data.records?.length) return error(`No objects found for "${query}"`);

    const items = data.records.map((obj) => ({
      title: obj.title,
      dated: obj.dated || "Unknown date",
      classification: obj.classification || "Unknown",
      culture: obj.culture || "Unknown",
      artist: obj.people?.[0]?.name || "Unknown artist",
      image: obj.primaryimageurl ? "✓" : "✗",
    }));

    return text(
      `Found ${data.records.length} objects for "${query}":\n\n${numberedList(items, (item) => `${item.title} (${item.dated}) — ${item.culture}, ${item.classification}`)}`
    );
  }
);

server.tool(
  "get_object",
  "Get detailed information about a specific artwork by ID",
  {
    id: z.number().describe("Harvard Art Museums object ID"),
  },
  async ({ id }) => {
    const data = await fetchJSON<HarvardObject>(
      buildURL(`https://api.harvardartmuseums.org/object/${id}`, {
        apikey: API_KEY,
      })
    );

    if (!data.title) return error(`Object ${id} not found`);

    const peopleNames = data.people?.map((p) => p.name).join(", ") || "Unknown";

    return text(
      keyValue({
        "🎨 Title": data.title,
        "📅 Date": data.dated || "Unknown",
        "🏛️ Classification": data.classification || "Unknown",
        "🌍 Culture": data.culture || "Unknown",
        "👤 Artist": peopleNames,
        "🎭 Technique": data.technique || "Unknown",
        "📦 Medium": data.medium || "Unknown",
        "📐 Dimensions": data.dimensions || "Unknown",
        "📝 Description": truncate(data.description || "No description", 200),
        "🔗 URL": data.url || "No URL",
        "🖼️ Image": data.primaryimageurl ? "Available" : "Not available",
      })
    );
  }
);

server.tool(
  "search_by_century",
  "Search Harvard Art Museums collection by century",
  {
    century: z
      .string()
      .describe("Century (e.g. '19th century', '20th century', '18th century')"),
    size: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ century, size }) => {
    const data = await fetchJSON<SearchResponse>(
      buildURL("https://api.harvardartmuseums.org/object", {
        apikey: API_KEY,
        century: century,
        size: size,
        sort: "random",
      })
    );

    if (!data.records?.length) return error(`No objects found from ${century}`);

    const items = data.records.map((obj) => ({
      title: obj.title,
      dated: obj.dated || "Unknown date",
      classification: obj.classification || "Unknown",
      culture: obj.culture || "Unknown",
    }));

    return text(
      `Found ${data.records.length} objects from ${century}:\n\n${numberedList(items, (item) => `${item.title} (${item.dated}) — ${item.culture}`)}`
    );
  }
);

server.tool(
  "search_by_culture",
  "Search Harvard Art Museums collection by culture",
  {
    culture: z
      .string()
      .describe("Culture (e.g. 'Japanese', 'French', 'Chinese', 'Italian')"),
    size: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ culture, size }) => {
    const data = await fetchJSON<SearchResponse>(
      buildURL("https://api.harvardartmuseums.org/object", {
        apikey: API_KEY,
        culture: culture,
        size: size,
        hasimage: 1,
      })
    );

    if (!data.records?.length) return error(`No objects found from ${culture} culture`);

    const items = data.records.map((obj) => ({
      title: obj.title,
      dated: obj.dated || "Unknown date",
      classification: obj.classification || "Unknown",
      artist: obj.people?.[0]?.name || "Unknown",
    }));

    return text(
      `Found ${data.records.length} ${culture} artworks with images:\n\n${numberedList(items, (item) => `${item.title} (${item.dated}) by ${item.artist}`)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
