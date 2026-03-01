#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-mk/core";
import { optionalEnv } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-space",
  version: "0.1.0",
});

// ── Config ──────────────────────────────────────────────

const API_KEY = optionalEnv("NASA_API_KEY", "DEMO_KEY");

// ── Types ───────────────────────────────────────────────

interface APODResponse {
  title: string;
  date: string;
  explanation: string;
  url: string;
  media_type: string;
}

interface MarsRoverPhoto {
  id: number;
  camera: {
    full_name: string;
  };
  img_src: string;
  earth_date: string;
}

interface MarsRoverResponse {
  photos: MarsRoverPhoto[];
}

interface NearEarthObject {
  name: string;
  estimated_diameter: {
    kilometers: {
      estimated_diameter_max: number;
    };
  };
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: Array<{
    miss_distance: {
      kilometers: string;
    };
  }>;
}

interface AsteroidsResponse {
  element_count: number;
  near_earth_objects: Record<string, NearEarthObject[]>;
}

interface EPICImage {
  caption: string;
  date: string;
  image: string;
}

interface NASAImageItem {
  data: Array<{
    title: string;
    description: string;
    nasa_id: string;
  }>;
  links: Array<{
    href: string;
  }>;
}

interface NASASearchResponse {
  collection: {
    items: NASAImageItem[];
  };
}

// ── Tools ───────────────────────────────────────────────

server.tool(
  "astronomy_picture",
  "Get NASA's Astronomy Picture of the Day (APOD)",
  {
    date: z
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format (optional, defaults to today)"),
  },
  async ({ date }) => {
    const url = buildURL("https://api.nasa.gov/planetary/apod", {
      api_key: API_KEY,
      date: date,
    });

    const data = await fetchJSON<APODResponse>(url);

    return text(
      keyValue({
        "📅 Date": data.date,
        "🌟 Title": data.title,
        "📝 Explanation": truncate(data.explanation, 500),
        "🔗 URL": data.url,
        "📺 Media Type": data.media_type,
      })
    );
  }
);

server.tool(
  "mars_rover_photos",
  "Get photos from NASA Mars rovers (Curiosity, Opportunity, or Spirit)",
  {
    sol: z
      .number()
      .default(1000)
      .describe("Martian sol day (default 1000)"),
    rover: z
      .enum(["curiosity", "opportunity", "spirit"])
      .default("curiosity")
      .describe("Rover name (curiosity, opportunity, or spirit)"),
  },
  async ({ sol, rover }) => {
    const url = buildURL(`https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos`, {
      sol: sol,
      api_key: API_KEY,
      page: 1,
    });

    const data = await fetchJSON<MarsRoverResponse>(url);

    if (!data.photos || data.photos.length === 0) {
      return error(`No photos found for ${rover} on sol ${sol}`);
    }

    const photos = data.photos.slice(0, 5);
    const list = numberedList(photos, (photo) => {
      return `${photo.camera.full_name} (${photo.earth_date})\nID: ${photo.id}\n${photo.img_src}`;
    });

    return text(`🚀 ${rover.toUpperCase()} Rover — Sol ${sol}\n\n${list}`);
  }
);

server.tool(
  "asteroids_today",
  "Get near-Earth asteroids for today",
  {},
  async () => {
    const today = new Date().toISOString().split("T")[0];

    const url = buildURL("https://api.nasa.gov/neo/rest/v1/feed", {
      start_date: today,
      end_date: today,
      api_key: API_KEY,
    });

    const data = await fetchJSON<AsteroidsResponse>(url);

    const allObjects: NearEarthObject[] = [];
    for (const dateKey in data.near_earth_objects) {
      allObjects.push(...data.near_earth_objects[dateKey]);
    }

    if (allObjects.length === 0) {
      return text(`🌍 No near-Earth asteroids detected for ${today}`);
    }

    const list = numberedList(allObjects, (obj) => {
      const diameterKm = obj.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2);
      const hazard = obj.is_potentially_hazardous_asteroid ? "⚠️ HAZARDOUS" : "✅ Safe";
      const distance = obj.close_approach_data[0]?.miss_distance.kilometers || "N/A";
      return `${obj.name}\nDiameter: ${diameterKm} km | ${hazard}\nMiss distance: ${distance} km`;
    });

    return text(`🌍 Near-Earth Asteroids for ${today} (${allObjects.length} total)\n\n${list}`);
  }
);

server.tool(
  "epic_earth_image",
  "Get latest EPIC Earth imagery from NASA",
  {},
  async () => {
    const url = buildURL("https://api.nasa.gov/EPIC/api/natural", {
      api_key: API_KEY,
    });

    const data = await fetchJSON<EPICImage[]>(url);

    if (!data || data.length === 0) {
      return error("No EPIC images available");
    }

    const image = data[0];
    const [year, month, day] = image.date.split("-");
    const imageUrl = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/png/${image.image}.png`;

    return text(
      keyValue({
        "📅 Date": image.date,
        "📸 Caption": image.caption,
        "🖼️ Image Name": image.image,
        "🔗 Image URL": imageUrl,
      })
    );
  }
);

server.tool(
  "search_nasa",
  "Search NASA image library",
  {
    query: z.string().describe("Search query (e.g. 'moon landing', 'mars', 'nebula')"),
  },
  async ({ query }) => {
    const url = buildURL("https://images-api.nasa.gov/search", {
      q: query,
      media_type: "image",
    });

    const data = await fetchJSON<NASASearchResponse>(url);

    if (!data.collection.items || data.collection.items.length === 0) {
      return error(`No images found for "${query}"`);
    }

    const results = data.collection.items.slice(0, 5);
    const list = numberedList(results, (item) => {
      const title = item.data[0]?.title || "Untitled";
      const description = truncate(item.data[0]?.description || "", 200);
      const nasaId = item.data[0]?.nasa_id || "N/A";
      const href = item.links[0]?.href || "N/A";
      return `${title}\n${description}\nNASA ID: ${nasaId}\n${href}`;
    });

    return text(`🔍 NASA Images for "${query}"\n\n${list}`);
  }
);

// ── Start ───────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
