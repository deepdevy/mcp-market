#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-geocoding",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
}

const NOMINATIM_HEADERS = {
  "User-Agent": "mcp-market-geocoding/0.1.0",
};

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_location",
  "Search for a place by name and get its coordinates and address details",
  {
    query: z.string().describe("Place name to search (e.g. 'Eiffel Tower', 'Seoul Station', '123 Main St')"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(3)
      .describe("Max number of results (1-10, default 3)"),
  },
  async ({ query, limit }) => {
    const results = await fetchJSON<NominatimResult[]>(
      buildURL("https://nominatim.openstreetmap.org/search", {
        q: query,
        format: "json",
        addressdetails: 1,
        limit,
      }),
      { headers: NOMINATIM_HEADERS }
    );

    if (!results.length) return error(`No results found for "${query}"`);

    const formatted = numberedList(results, (r) => {
      const addr = r.address;
      return keyValue({
        Name: r.display_name,
        Latitude: r.lat,
        Longitude: r.lon,
        Type: r.type,
        Country: addr?.country,
        "Country code": addr?.country_code?.toUpperCase(),
        Postcode: addr?.postcode,
      });
    });

    return text(formatted);
  }
);

server.tool(
  "reverse_geocode",
  "Convert latitude/longitude coordinates into a human-readable address",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude (-90 to 90)"),
    longitude: z.number().min(-180).max(180).describe("Longitude (-180 to 180)"),
  },
  async ({ latitude, longitude }) => {
    const result = await fetchJSON<NominatimResult>(
      buildURL("https://nominatim.openstreetmap.org/reverse", {
        lat: latitude,
        lon: longitude,
        format: "json",
        addressdetails: 1,
      }),
      { headers: NOMINATIM_HEADERS }
    );

    if (!result.display_name) return error(`No address found for coordinates (${latitude}, ${longitude})`);

    const addr = result.address;

    return text(
      keyValue({
        "📍 Address": result.display_name,
        "🏙️ City": addr?.city ?? addr?.town ?? addr?.village,
        "🏛️ State": addr?.state,
        "🌍 Country": addr?.country,
        "🔤 Country code": addr?.country_code?.toUpperCase(),
        "📮 Postcode": addr?.postcode,
        "📐 Coordinates": `${latitude}, ${longitude}`,
      })
    );
  }
);

server.tool(
  "get_coordinates",
  "Get latitude and longitude for a city or place name (simple output for chaining with other tools)",
  {
    place: z.string().describe("City or place name"),
  },
  async ({ place }) => {
    const results = await fetchJSON<NominatimResult[]>(
      buildURL("https://nominatim.openstreetmap.org/search", {
        q: place,
        format: "json",
        limit: 1,
      }),
      { headers: NOMINATIM_HEADERS }
    );

    if (!results.length) return error(`Place "${place}" not found`);

    const r = results[0];
    return text(`${r.display_name}\nLatitude: ${r.lat}\nLongitude: ${r.lon}`);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
