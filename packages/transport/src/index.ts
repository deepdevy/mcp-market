#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, optionalEnv } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-transport",
  version: "0.1.0",
});

const OCM_KEY = optionalEnv("OPEN_CHARGE_MAP_KEY", "");
// ── Types ──────────────────────────────────────────────────

interface ChargerPOI {
  ID: number;
  AddressInfo: {
    Title: string;
    AddressLine1: string;
    Town: string;
    Distance: number;
  };
  NumberOfPoints: number;
  StatusType: {
    Title: string;
  };
}

interface ChargerResponse {
  Data: ChargerPOI[];
}

interface ChargerDetailsResponse {
  Data: Array<{
    ID: number;
    AddressInfo: {
      Title: string;
      AddressLine1: string;
      Town: string;
      Postcode: string;
      CountryID: number;
      Latitude: number;
      Longitude: number;
      Distance: number;
    };
    Connections: Array<{
      ConnectionType: {
        Title: string;
      };
      Amps: number;
      Voltage: number;
      PowerKW: number;
    }>;
    UsageCost: string;
    StatusType: {
      Title: string;
    };
    OperatorInfo: {
      Title: string;
    };
  }>;
}

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: {
    name: string;
    operator?: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "nearby_chargers",
  "Find nearby EV charging stations within a specified distance",
  {
    lat: z.number().describe("Latitude of the location"),
    lng: z.number().describe("Longitude of the location"),
    distance: z
      .number()
      .default(10)
      .describe("Search radius in kilometers (default 10)"),
    maxresults: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum number of results (1-20, default 10)"),
  },
  async ({ lat, lng, distance, maxresults }) => {
    const data = await fetchJSON<ChargerResponse>(
      buildURL("https://api.openchargemap.io/v3/poi/", {
        output: "json",
        key: OCM_KEY || undefined,
        latitude: lat,
        longitude: lng,
        distance: distance,
        distanceunit: "KM",
        maxresults: maxresults,
        compact: "true",
        verbose: "false",
      })
    );

    if (!data.Data || data.Data.length === 0) {
      return text("No charging stations found in the specified area.");
    }

    const chargers = data.Data.map((charger) => ({
      name: charger.AddressInfo.Title,
      address: charger.AddressInfo.AddressLine1,
      town: charger.AddressInfo.Town,
      distance: `${charger.AddressInfo.Distance.toFixed(2)} km`,
      points: charger.NumberOfPoints,
      status: charger.StatusType.Title,
    }));

    return text(
      `⚡ Found ${chargers.length} charging station(s) near (${lat}, ${lng}):\n\n${numberedList(
        chargers,
        (c) =>
          `${c.name} (${c.points} points) — ${c.address}, ${c.town} — ${c.distance} away — Status: ${c.status}`
      )}`
    );
  }
);

server.tool(
  "chargers_by_country",
  "Find EV charging stations in a specific country",
  {
    countrycode: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("ISO 3166-1 alpha-2 country code (e.g. US, KR, GB)"),
    maxresults: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum number of results (1-20, default 10)"),
  },
  async ({ countrycode, maxresults }) => {
    const data = await fetchJSON<ChargerResponse>(
      buildURL("https://api.openchargemap.io/v3/poi/", {
        output: "json",
        key: OCM_KEY || undefined,
        countrycode: countrycode,
        maxresults: maxresults,
        compact: "true",
        verbose: "false",
      })
    );

    if (!data.Data || data.Data.length === 0) {
      return text(`No charging stations found in ${countrycode}.`);
    }

    const chargers = data.Data.map((charger) => ({
      name: charger.AddressInfo.Title,
      address: charger.AddressInfo.AddressLine1,
      town: charger.AddressInfo.Town,
      points: charger.NumberOfPoints,
      status: charger.StatusType.Title,
    }));

    return text(
      `⚡ Found ${chargers.length} charging station(s) in ${countrycode}:\n\n${numberedList(
        chargers,
        (c) =>
          `${c.name} (${c.points} points) — ${c.address}, ${c.town} — Status: ${c.status}`
      )}`
    );
  }
);

server.tool(
  "charger_details",
  "Get detailed information about a specific charging station",
  {
    id: z.number().describe("Charging station ID"),
  },
  async ({ id }) => {
    const data = await fetchJSON<ChargerDetailsResponse>(
      buildURL("https://api.openchargemap.io/v3/poi/", {
        output: "json",
        key: OCM_KEY || undefined,
        chargepointid: id,
        verbose: "true",
      })
    );

    if (!data.Data || data.Data.length === 0) {
      return error(`Charging station with ID ${id} not found`);
    }

    const charger = data.Data[0];
    const addr = charger.AddressInfo;

    const connections = charger.Connections.map((conn) => ({
      type: conn.ConnectionType.Title,
      voltage: `${conn.Voltage}V`,
      amps: `${conn.Amps}A`,
      power: `${conn.PowerKW}kW`,
    }));

    const details = {
      "🏪 Name": charger.AddressInfo.Title,
      "📍 Address": `${addr.AddressLine1}, ${addr.Town} ${addr.Postcode}`,
      "📌 Coordinates": `${addr.Latitude}, ${addr.Longitude}`,
      "⚡ Status": charger.StatusType.Title,
      "💰 Usage Cost": charger.UsageCost || "Not specified",
      "🏢 Operator": charger.OperatorInfo.Title,
      "🔌 Connections": numberedList(
        connections,
        (c) => `${c.type} — ${c.voltage}, ${c.amps}, ${c.power}`
      ),
    };

    return text(keyValue(details));
  }
);

server.tool(
  "nearby_stations",
  "Find nearby railway stations using Overpass API",
  {
    lat: z.number().describe("Latitude of the location"),
    lng: z.number().describe("Longitude of the location"),
    radius: z
      .number()
      .default(1000)
      .describe("Search radius in meters (default 1000)"),
  },
  async ({ lat, lng, radius }) => {
    const overpassQuery = `[out:json];node["railway"="station"](around:${radius},${lat},${lng});out body 10;`;

    const data = await fetchJSON<OverpassResponse>(
      buildURL("https://overpass-api.de/api/interpreter", {
        data: overpassQuery,
      })
    );

    if (!data.elements || data.elements.length === 0) {
      return text("No railway stations found in the specified area.");
    }

    const stations = data.elements.map((elem) => ({
      name: elem.tags.name,
      lat: elem.lat,
      lon: elem.lon,
      operator: elem.tags.operator || "Unknown",
    }));

    return text(
      `🚂 Found ${stations.length} railway station(s) near (${lat}, ${lng}):\n\n${numberedList(
        stations,
        (s) => `${s.name} (${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}) — Operator: ${s.operator}`
      )}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
