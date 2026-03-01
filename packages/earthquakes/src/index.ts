#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, numberedList } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-earthquakes",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface EarthquakeFeature {
  properties: {
    mag: number;
    place: string;
    time: number;
    depth: number;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

interface EarthquakeResponse {
  features: EarthquakeFeature[];
}

interface SignificantEarthquakeResponse {
  features: EarthquakeFeature[];
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatEarthquake(feature: EarthquakeFeature): string {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;
  return `Magnitude ${props.mag} — ${props.place} (${formatDate(props.time)}, depth: ${coords[2]}km)`;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_recent_earthquakes",
  "Get recent earthquakes worldwide with optional magnitude filter",
  {
    min_magnitude: z
      .number()
      .min(0)
      .max(10)
      .default(4.0)
      .describe("Minimum magnitude (0-10, default 4.0)"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of results (1-50, default 10)"),
  },
  async ({ min_magnitude, limit }) => {
    const data = await fetchJSON<EarthquakeResponse>(
      buildURL("https://earthquake.usgs.gov/fdsnws/event/1/query", {
        format: "geojson",
        orderby: "time",
        minmagnitude: min_magnitude,
        limit: limit,
      })
    );

    if (!data.features || data.features.length === 0) {
      return text("No earthquakes found matching the criteria.");
    }

    const earthquakes = data.features.map(formatEarthquake);
    return text(
      `Recent earthquakes (magnitude ≥ ${min_magnitude}):\n\n${numberedList(earthquakes, (eq) => eq)}`
    );
  }
);

server.tool(
  "get_earthquakes_near",
  "Get earthquakes near a specific location",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude (-90 to 90)"),
    longitude: z.number().min(-180).max(180).describe("Longitude (-180 to 180)"),
    radius_km: z
      .number()
      .min(1)
      .max(500)
      .default(100)
      .describe("Search radius in kilometers (1-500, default 100)"),
    min_magnitude: z
      .number()
      .min(0)
      .max(10)
      .default(2.0)
      .describe("Minimum magnitude (0-10, default 2.0)"),
  },
  async ({ latitude, longitude, radius_km, min_magnitude }) => {
    const data = await fetchJSON<EarthquakeResponse>(
      buildURL("https://earthquake.usgs.gov/fdsnws/event/1/query", {
        format: "geojson",
        latitude: latitude,
        longitude: longitude,
        maxradiuskm: radius_km,
        minmagnitude: min_magnitude,
      })
    );

    if (!data.features || data.features.length === 0) {
      return text(
        `No earthquakes found within ${radius_km}km of (${latitude}, ${longitude}).`
      );
    }

    const earthquakes = data.features.map(formatEarthquake);
    return text(
      `Earthquakes within ${radius_km}km of (${latitude}, ${longitude}):\n\n${numberedList(earthquakes, (eq) => eq)}`
    );
  }
);

server.tool(
  "get_significant_earthquakes",
  "Get significant earthquakes from USGS feed",
  {
    period: z
      .enum(["hour", "day", "week", "month"])
      .default("week")
      .describe("Time period (hour, day, week, month, default week)"),
  },
  async ({ period }) => {
    const data = await fetchJSON<SignificantEarthquakeResponse>(
      `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_${period}.geojson`
    );

    if (!data.features || data.features.length === 0) {
      return text(`No significant earthquakes in the last ${period}.`);
    }

    const earthquakes = data.features.map(formatEarthquake);
    return text(
      `Significant earthquakes from the last ${period}:\n\n${numberedList(earthquakes, (eq) => eq)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
