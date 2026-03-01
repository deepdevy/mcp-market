#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, requireEnv } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-birds",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface RecentObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany: number | null;
}

interface NotableObservation {
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
}

interface NearbyObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany: number | null;
}

interface Hotspot {
  locName: string;
  lat: number;
  lng: number;
  numSpeciesAllTime: number;
  latestObsDt: string;
}

// ── Helpers ────────────────────────────────────────────────

const API_KEY = requireEnv("EBIRD_API_KEY");
const API_BASE = "https://api.ebird.org/v2";
const AUTH_HEADERS = { "X-eBirdApiToken": API_KEY };

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "recent_observations",
  "Get recent bird observations for a region",
  {
    regionCode: z.string().describe("Region code (e.g. US-NY, KR)"),
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum results to return (1-20, default 10)"),
  },
  async ({ regionCode, maxResults }) => {
    const data = await fetchJSON<RecentObservation[]>(
      buildURL(`${API_BASE}/data/obs/${regionCode}/recent`, {
        maxResults,
      }),
      { headers: AUTH_HEADERS }
    );

    if (!data.length) return text(`No recent observations found for ${regionCode}`);

    const items = data.map(
      (obs) =>
        `${obs.comName} (${obs.sciName}) at ${obs.locName} on ${obs.obsDt}${obs.howMany ? ` (${obs.howMany} seen)` : ""}`
    );

    return text(
      `Recent observations in ${regionCode}:\n\n${numberedList(items, (item) => item)}`
    );
  }
);

server.tool(
  "notable_observations",
  "Get notable/rare bird observations for a region",
  {
    regionCode: z.string().describe("Region code (e.g. US-NY, KR)"),
    back: z
      .number()
      .min(1)
      .max(30)
      .default(7)
      .describe("Days back to search (1-30, default 7)"),
  },
  async ({ regionCode, back }) => {
    const data = await fetchJSON<NotableObservation[]>(
      buildURL(`${API_BASE}/data/obs/${regionCode}/recent/notable`, {
        back,
      }),
      { headers: AUTH_HEADERS }
    );

    if (!data.length) return text(`No notable observations found for ${regionCode} in the last ${back} days`);

    const items = data.map(
      (obs) => `${obs.comName} (${obs.sciName}) at ${obs.locName} on ${obs.obsDt}`
    );

    return text(
      `Notable observations in ${regionCode} (last ${back} days):\n\n${numberedList(items, (item) => item)}`
    );
  }
);

server.tool(
  "nearby_observations",
  "Get bird observations near a geographic location",
  {
    lat: z.number().describe("Latitude"),
    lng: z.number().describe("Longitude"),
    dist: z
      .number()
      .min(1)
      .max(50)
      .default(25)
      .describe("Search radius in kilometers (1-50, default 25)"),
  },
  async ({ lat, lng, dist }) => {
    const data = await fetchJSON<NearbyObservation[]>(
      buildURL(`${API_BASE}/data/obs/geo/recent`, {
        lat,
        lng,
        dist,
        maxResults: 10,
      }),
      { headers: AUTH_HEADERS }
    );

    if (!data.length) return text(`No observations found within ${dist}km of (${lat}, ${lng})`);

    const items = data.map(
      (obs) =>
        `${obs.comName} (${obs.sciName}) at ${obs.locName} on ${obs.obsDt}${obs.howMany ? ` (${obs.howMany} seen)` : ""}`
    );

    return text(
      `Observations within ${dist}km of (${lat}, ${lng}):\n\n${numberedList(items, (item) => item)}`
    );
  }
);

server.tool(
  "hotspots",
  "Get birding hotspot locations in a region",
  {
    regionCode: z.string().describe("Region code (e.g. US-NY, KR)"),
  },
  async ({ regionCode }) => {
    const data = await fetchJSON<Hotspot[]>(
      buildURL(`${API_BASE}/ref/hotspot/${regionCode}`, {
        fmt: "json",
      }),
      { headers: AUTH_HEADERS }
    );

    if (!data.length) return text(`No hotspots found for ${regionCode}`);

    const items = data.map(
      (spot) =>
        `${spot.locName} (${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}) — ${spot.numSpeciesAllTime} species, latest: ${spot.latestObsDt}`
    );

    return text(
      `Birding hotspots in ${regionCode}:\n\n${numberedList(items, (item) => item)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
