#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-art",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface ArticArtwork {
  id: number;
  title: string;
  artist_display: string;
  date_display: string;
  medium_display: string;
  image_id: string;
}

interface ArticSearchResponse {
  data: ArticArtwork[];
}

interface MetArtwork {
  objectID: number;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  medium: string;
  primaryImage: string;
  department: string;
}

interface MetSearchResponse {
  objectIDs: number[];
}

// ── Helpers ────────────────────────────────────────────────

function getArticImageUrl(imageId: string): string {
  return `https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg`;
}

async function getRandomMetArtwork(): Promise<MetArtwork | null> {
  try {
    const searchData = await fetchJSON<MetSearchResponse>(
      buildURL("https://collectionapi.metmuseum.org/public/collection/v1/search", {
        hasImages: "true",
        q: "painting",
      })
    );

    if (!searchData.objectIDs || searchData.objectIDs.length === 0) {
      return null;
    }

    const randomId = searchData.objectIDs[Math.floor(Math.random() * searchData.objectIDs.length)];
    const artwork = await fetchJSON<MetArtwork>(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${randomId}`
    );

    return artwork;
  } catch {
    return null;
  }
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_artwork",
  "Search for artworks in the Art Institute of Chicago collection",
  {
    query: z.string().describe("Search query (e.g. 'Starry Night', 'Van Gogh', 'landscape')"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ query, limit }) => {
    try {
      const data = await fetchJSON<ArticSearchResponse>(
        buildURL("https://api.artic.edu/api/v1/artworks/search", {
          q: query,
          limit: limit,
          fields: "id,title,artist_display,date_display,medium_display,image_id",
        })
      );

      if (!data.data || data.data.length === 0) {
        return error(`No artworks found for "${query}"`);
      }

      const items = data.data.map((artwork) => ({
        title: artwork.title,
        artist: artwork.artist_display || "Unknown",
        date: artwork.date_display || "Unknown",
        medium: artwork.medium_display || "Unknown",
        image_url: artwork.image_id ? getArticImageUrl(artwork.image_id) : "No image available",
      }));

      return text(
        `Found ${items.length} artworks for "${query}":\n\n${numberedList(
          items.map((item) => `${item.title} by ${item.artist} (${item.date})\nMedium: ${item.medium}\nImage: ${item.image_url}`), (line) => line
        )}`
      );
    } catch (e) {
      return error(`Failed to search artworks: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  "random_artwork",
  "Get a random artwork from the Metropolitan Museum collection",
  {},
  async () => {
    try {
      const artwork = await getRandomMetArtwork();

      if (!artwork) {
        return error("Failed to fetch random artwork from Metropolitan Museum");
      }

      return text(
        keyValue({
          "🖼️ Title": artwork.title,
          "👨‍🎨 Artist": artwork.artistDisplayName || "Unknown",
          "📅 Date": artwork.objectDate || "Unknown",
          "🎨 Medium": artwork.medium || "Unknown",
          "🏛️ Department": artwork.department || "Unknown",
          "🔗 Image": artwork.primaryImage || "No image available",
        })
      );
    } catch (e) {
      return error(`Failed to fetch random artwork: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  "get_artwork_image",
  "Get detailed information and image URL for a specific artwork from Art Institute of Chicago",
  {
    artic_id: z.number().describe("Art Institute of Chicago artwork ID"),
  },
  async ({ artic_id }) => {
    try {
      const data = await fetchJSON<ArticArtwork>(
        buildURL(`https://api.artic.edu/api/v1/artworks/${artic_id}`, {
          fields: "id,title,artist_display,image_id",
        })
      );

      if (!data.id) {
        return error(`Artwork with ID ${artic_id} not found`);
      }

      const imageUrl = data.image_id ? getArticImageUrl(data.image_id) : "No image available";

      return text(
        keyValue({
          "🖼️ Title": data.title,
          "👨‍🎨 Artist": data.artist_display || "Unknown",
          "🔗 Image URL": imageUrl,
        })
      );
    } catch (e) {
      return error(`Failed to fetch artwork: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  "search_by_artist",
  "Search for artworks by a specific artist in the Art Institute of Chicago collection",
  {
    artist: z.string().describe("Artist name (e.g. 'Van Gogh', 'Monet', 'Picasso')"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ artist, limit }) => {
    try {
      const data = await fetchJSON<ArticSearchResponse>(
        buildURL("https://api.artic.edu/api/v1/artworks/search", {
          q: artist,
          limit: limit,
          fields: "id,title,artist_display,date_display,image_id",
        })
      );

      if (!data.data || data.data.length === 0) {
        return error(`No artworks found by "${artist}"`);
      }

      const items = data.data.map((artwork) => `${artwork.title} (${artwork.date_display || "Unknown"})`);

      return text(`Found ${items.length} artworks by "${artist}":\n\n${numberedList(items, (i) => i)}`);
    } catch (e) {
      return error(`Failed to search by artist: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
