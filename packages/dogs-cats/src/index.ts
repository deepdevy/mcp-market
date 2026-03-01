#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-dogs-cats",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface DogRandomResponse {
  message: string;
  status: string;
}

interface DogBreedImagesResponse {
  message: string[];
  status: string;
}

interface DogBreedsResponse {
  message: Record<string, string[]>;
  status: string;
}

interface CatFactResponse {
  fact: string;
  length: number;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "random_dog",
  "Get a random dog image",
  {},
  async () => {
    const data = await fetchJSON<DogRandomResponse>(
      "https://dog.ceo/api/breeds/image/random"
    );

    if (data.status !== "success") {
      return error("Failed to fetch random dog image");
    }

    return text(
      keyValue({
        "🐕 Image": data.message,
        "✅ Status": data.status,
      })
    );
  }
);

server.tool(
  "dogs_by_breed",
  "Get 3 random dog images for a specific breed",
  {
    breed: z
      .string()
      .describe(
        'Dog breed name (e.g. "labrador", "bulldog/french" for sub-breeds)'
      ),
  },
  async ({ breed }) => {
    const data = await fetchJSON<DogBreedImagesResponse>(
      buildURL("https://dog.ceo/api/breed", {
        pathname: `/${breed}/images/random/3`,
      })
    );

    if (data.status !== "success") {
      return error(`Failed to fetch images for breed "${breed}"`);
    }

    return text(
      keyValue({
        "🐕 Breed": breed,
        "📸 Images": numberedList(data.message, (url) => url),
      })
    );
  }
);

server.tool(
  "list_dog_breeds",
  "Get a list of all dog breeds and sub-breeds",
  {},
  async () => {
    const data = await fetchJSON<DogBreedsResponse>(
      "https://dog.ceo/api/breeds/list/all"
    );

    if (data.status !== "success") {
      return error("Failed to fetch dog breeds");
    }

    const breeds = Object.entries(data.message).map(([breed, subBreeds]) => {
      if (subBreeds.length === 0) {
        return breed;
      }
      return `${breed} (${subBreeds.join(", ")})`;
    });

    return text(
      keyValue({
        "🐕 Total Breeds": Object.keys(data.message).length.toString(),
        "📋 Breeds": numberedList(breeds, (b) => b),
      })
    );
  }
);

server.tool(
  "cat_fact",
  "Get a random cat fact",
  {},
  async () => {
    const data = await fetchJSON<CatFactResponse>(
      "https://catfact.ninja/fact"
    );

    return text(
      keyValue({
        "🐱 Fact": data.fact,
        "📏 Length": `${data.length} characters`,
      })
    );
  }
);

server.tool(
  "http_cat",
  "Get a cat image for an HTTP status code",
  {
    status_code: z
      .number()
      .describe("HTTP status code (e.g. 200, 404, 500)"),
  },
  async ({ status_code }) => {
    const imageUrl = `https://http.cat/${status_code}`;

    return text(
      keyValue({
        "🐱 Status Code": status_code.toString(),
        "📸 Image": imageUrl,
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
