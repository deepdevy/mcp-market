#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-iss",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface ISSSatelliteData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint: number;
  daynum: number;
  solar_lat: number;
  solar_lon: number;
}

interface AstrosResponse {
  number: number;
  people: Array<{
    name: string;
    craft: string;
  }>;
  message: string;
}

interface PassesResponse {
  positions: Array<{
    timestamp: number;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    visibility: string;
  }>;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_iss_position",
  "Get current ISS position, altitude, velocity, and visibility",
  {},
  async () => {
    const data = await fetchJSON<ISSSatelliteData>(
      "https://api.wheretheiss.at/v1/satellites/25544"
    );

    return text(
      keyValue({
        "🛰️ Satellite": data.name,
        "📍 Latitude": `${data.latitude.toFixed(4)}°`,
        "📍 Longitude": `${data.longitude.toFixed(4)}°`,
        "📏 Altitude": `${data.altitude.toFixed(2)} km`,
        "💨 Velocity": `${data.velocity.toFixed(2)} km/h`,
        "👁️ Visibility": data.visibility,
      })
    );
  }
);

server.tool(
  "get_people_in_space",
  "Get number of people currently in space and list them by craft",
  {},
  async () => {
    const data = await fetchJSON<AstrosResponse>(
      "http://api.open-notify.org/astros.json"
    );

    const craftGroups: Record<string, string[]> = {};
    for (const person of data.people) {
      if (!craftGroups[person.craft]) {
        craftGroups[person.craft] = [];
      }
      craftGroups[person.craft].push(person.name);
    }

    const craftLines = Object.entries(craftGroups).map(
      ([craft, names]) => `${craft}: ${names.join(", ")}`
    );

    return text(
      `👨‍🚀 People in Space: ${data.number}\n\n${craftLines.join("\n")}`
    );
  }
);

server.tool(
  "get_iss_passes",
  "Get ISS pass predictions for a location (5 future positions at 5-minute intervals)",
  {
    lat: z.number().describe("Latitude of observer location"),
    lon: z.number().describe("Longitude of observer location"),
  },
  async ({ lat, lon }) => {
    const now = Math.floor(Date.now() / 1000);
    const timestamps = [now, now + 300, now + 600, now + 900, now + 1200];
    const timestampParam = timestamps.join(",");

    const data = await fetchJSON<PassesResponse>(
      buildURL("https://api.wheretheiss.at/v1/satellites/25544/positions", {
        timestamps: timestampParam,
        units: "kilometers",
      })
    );

    const positions = data.positions.map((pos) => ({
      time: new Date(pos.timestamp * 1000).toISOString(),
      lat: pos.latitude.toFixed(4),
      lon: pos.longitude.toFixed(4),
      alt: pos.altitude.toFixed(2),
      vel: pos.velocity.toFixed(2),
    }));

    const formatted = numberedList(positions, (pos) =>
      `${pos.time}: ${pos.lat}°, ${pos.lon}° (${pos.alt}km, ${pos.vel}km/h)`
    );

    return text(
      `🛰️ ISS Passes over ${lat.toFixed(2)}°, ${lon.toFixed(2)}°\n\n${formatted}`
    );
  }
);

server.tool(
  "get_satellite_info",
  "Get detailed ISS satellite information",
  {},
  async () => {
    const data = await fetchJSON<ISSSatelliteData>(
      "https://api.wheretheiss.at/v1/satellites/25544"
    );

    return text(
      keyValue({
        "🛰️ ID": data.id,
        "📛 Name": data.name,
        "📍 Latitude": `${data.latitude.toFixed(4)}°`,
        "📍 Longitude": `${data.longitude.toFixed(4)}°`,
        "📏 Altitude": `${data.altitude.toFixed(2)} km`,
        "💨 Velocity": `${data.velocity.toFixed(2)} km/h`,
        "👁️ Visibility": data.visibility,
        "🦶 Footprint": `${data.footprint.toFixed(2)} km`,
        "📅 Day Number": data.daynum,
        "☀️ Solar Latitude": `${data.solar_lat.toFixed(4)}°`,
        "☀️ Solar Longitude": `${data.solar_lon.toFixed(4)}°`,
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
