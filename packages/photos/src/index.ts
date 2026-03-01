#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-mk/core";
import { requireEnv } from "@mcp-mk/core";

const API_KEY = requireEnv("UNSPLASH_ACCESS_KEY");

const server = new McpServer({
  name: "mcp-market-photos",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface PhotoResult {
  id: string;
  description?: string;
  alt_description?: string;
  urls: {
    regular: string;
  };
  user: {
    name: string;
  };
  likes: number;
  width: number;
  height: number;
}

interface SearchPhotosResponse {
  results: PhotoResult[];
}

interface RandomPhotoResponse {
  id: string;
  description?: string;
  urls: {
    regular: string;
  };
  user: {
    name: string;
  };
  likes: number;
  location?: {
    name?: string;
  };
}

interface PhotoDetailsResponse {
  id: string;
  description?: string;
  urls: {
    regular: string;
  };
  user: {
    name: string;
  };
  likes: number;
  downloads: number;
  created_at: string;
  location?: {
    name?: string;
  };
}

interface CollectionResult {
  id: string;
  title: string;
  description?: string;
  total_photos: number;
  cover_photo: {
    urls: {
      small: string;
    };
  };
}

interface CollectionsResponse {
  results: CollectionResult[];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_photos",
  "Search for photos on Unsplash by query",
  {
    query: z.string().describe("Search query (e.g. 'mountain', 'sunset', 'nature')"),
    per_page: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results per page (1-10, default 5)"),
  },
  async ({ query, per_page }) => {
    const data = await fetchJSON<SearchPhotosResponse>(
      buildURL("https://api.unsplash.com/search/photos", {
        query,
        per_page,
      }),
      { headers: { Authorization: `Client-ID ${API_KEY}` } }
    );

    if (!data.results?.length) {
      return error(`No photos found for "${query}"`);
    }

    const items = data.results.map((photo) => ({
      title: photo.description || photo.alt_description || "Untitled",
      url: photo.urls.regular,
      photographer: photo.user.name,
      likes: photo.likes,
      dimensions: `${photo.width}x${photo.height}`,
    }));

    return text(
      `📸 Search results for "${query}"\n\n${numberedList(items, (item) =>
        keyValue({
          "📷 Title": truncate(item.title, 60),
          "👤 Photographer": item.photographer,
          "❤️ Likes": item.likes.toString(),
          "📐 Dimensions": item.dimensions,
          "🔗 URL": item.url,
        })
      )}`
    );
  }
);

server.tool(
  "random_photo",
  "Get a random photo from Unsplash, optionally filtered by query",
  {
    query: z
      .string()
      .optional()
      .describe("Optional search query to filter random photo (e.g. 'landscape', 'portrait')"),
  },
  async ({ query }) => {
    const params: Record<string, string> = {};
    if (query) {
      params.query = query;
    }

    const data = await fetchJSON<RandomPhotoResponse>(
      buildURL("https://api.unsplash.com/photos/random", params),
      { headers: { Authorization: `Client-ID ${API_KEY}` } }
    );

    const location = data.location?.name ? ` — ${data.location.name}` : "";

    return text(
      keyValue({
        "📸 Title": data.description || "Untitled",
        "👤 Photographer": data.user.name,
        "❤️ Likes": data.likes.toString(),
        "📍 Location": location || "Unknown",
        "🔗 URL": data.urls.regular,
      })
    );
  }
);

server.tool(
  "get_photo",
  "Get detailed information about a specific photo by ID",
  {
    id: z.string().describe("Unsplash photo ID"),
  },
  async ({ id }) => {
    const data = await fetchJSON<PhotoDetailsResponse>(
      buildURL(`https://api.unsplash.com/photos/${id}`, {}),
      { headers: { Authorization: `Client-ID ${API_KEY}` } }
    );

    const location = data.location?.name ? ` — ${data.location.name}` : "";
    const createdDate = new Date(data.created_at).toLocaleDateString();

    return text(
      keyValue({
        "📸 Title": data.description || "Untitled",
        "👤 Photographer": data.user.name,
        "❤️ Likes": data.likes.toString(),
        "⬇️ Downloads": data.downloads.toString(),
        "📅 Created": createdDate,
        "📍 Location": location || "Unknown",
        "🔗 URL": data.urls.regular,
      })
    );
  }
);

server.tool(
  "list_collections",
  "List featured collections on Unsplash",
  {
    per_page: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of collections per page (1-10, default 5)"),
  },
  async ({ per_page }) => {
    const data = await fetchJSON<CollectionResult[]>(
      buildURL("https://api.unsplash.com/collections", {
        per_page,
      }),
      { headers: { Authorization: `Client-ID ${API_KEY}` } }
    );

    if (!Array.isArray(data) || !data.length) {
      return error("No collections found");
    }

    const items = data.map((collection) => ({
      title: collection.title,
      description: collection.description || "No description",
      photos: collection.total_photos,
      cover: collection.cover_photo.urls.small,
    }));

    return text(
      `📚 Featured Collections\n\n${numberedList(items, (item) =>
        keyValue({
          "📚 Title": item.title,
          "📝 Description": truncate(item.description, 60),
          "📸 Total Photos": item.photos.toString(),
          "🖼️ Cover": item.cover,
        })
      )}`
    );
  }
);

server.tool(
  "search_collections",
  "Search for collections on Unsplash by query",
  {
    query: z.string().describe("Search query (e.g. 'nature', 'architecture', 'food')"),
    per_page: z
      .number()
      .min(1)
      .max(5)
      .default(3)
      .describe("Number of results per page (1-5, default 3)"),
  },
  async ({ query, per_page }) => {
    const data = await fetchJSON<CollectionsResponse>(
      buildURL("https://api.unsplash.com/search/collections", {
        query,
        per_page,
      }),
      { headers: { Authorization: `Client-ID ${API_KEY}` } }
    );

    if (!data.results?.length) {
      return error(`No collections found for "${query}"`);
    }

    const items = data.results.map((collection) => ({
      title: collection.title,
      description: collection.description || "No description",
      photos: collection.total_photos,
      cover: collection.cover_photo.urls.small,
    }));

    return text(
      `📚 Collections for "${query}"\n\n${numberedList(items, (item) =>
        keyValue({
          "📚 Title": item.title,
          "📝 Description": truncate(item.description, 60),
          "📸 Total Photos": item.photos.toString(),
          "🖼️ Cover": item.cover,
        })
      )}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
