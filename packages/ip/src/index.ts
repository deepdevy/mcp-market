#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-ip",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface IpApiResponse {
  status: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
}

interface IpapiCoResponse {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  postal: string;
  latitude: number;
  longitude: number;
  timezone: string;
  org: string;
  asn: string;
}

interface TimezoneResponse {
  query?: string;
  timezone?: string;
  offset?: number;
  country?: string;
  city?: string;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "lookup_ip",
  "Look up geolocation information for a specific IP address",
  {
    ip: z.string().describe("IP address to look up (e.g. 8.8.8.8)"),
  },
  async ({ ip }) => {
    const data = await fetchJSON<IpApiResponse>(
      buildURL("http://ip-api.com/json/" + ip, {
        fields: "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query",
      })
    );

    if (data.status !== "success") {
      return error(`Failed to look up IP ${ip}: ${data.message || "Unknown error"}`);
    }

    return text(
      keyValue({
        "🌐 IP": data.query || ip,
        "🏙️ City": data.city || "N/A",
        "🗺️ Region": data.regionName || "N/A",
        "🌍 Country": data.country || "N/A",
        "📍 Coordinates": `${data.lat}, ${data.lon}`,
        "📮 Postal Code": data.zip || "N/A",
        "⏰ Timezone": data.timezone || "N/A",
        "🏢 ISP": data.isp || "N/A",
        "🏭 Organization": data.org || "N/A",
        "🔗 AS": data.as || "N/A",
      })
    );
  }
);

server.tool(
  "my_ip",
  "Get your own IP address and geolocation information",
  {},
  async () => {
    const data = await fetchJSON<IpapiCoResponse>(
      buildURL("https://ipapi.co/json/", {})
    );

    return text(
      keyValue({
        "🌐 IP": data.ip,
        "🏙️ City": data.city,
        "🗺️ Region": data.region,
        "🌍 Country": data.country_name,
        "📮 Postal Code": data.postal,
        "📍 Coordinates": `${data.latitude}, ${data.longitude}`,
        "⏰ Timezone": data.timezone,
        "🏢 Organization": data.org,
        "🔗 ASN": data.asn,
      })
    );
  }
);

server.tool(
  "batch_lookup",
  "Look up geolocation for multiple IP addresses (max 5)",
  {
    ips: z.string().describe("Comma-separated IP addresses (max 5, e.g. 8.8.8.8,1.1.1.1)"),
  },
  async ({ ips }) => {
    const ipList = ips.split(",").map((ip) => ip.trim()).slice(0, 5);

    const results = await Promise.all(
      ipList.map(async (ip) => {
        const data = await fetchJSON<IpApiResponse>(
          buildURL("http://ip-api.com/json/" + ip, {})
        );

        if (data.status !== "success") {
          return {
            ip,
            error: data.message || "Unknown error",
          };
        }

        return {
          ip: data.query || ip,
          city: data.city || "N/A",
          country: data.country || "N/A",
          timezone: data.timezone || "N/A",
          coordinates: `${data.lat}, ${data.lon}`,
        };
      })
    );

    return text(
      numberedList(results, (result) => {
        if ("error" in result) {
          return `${result.ip}: Error — ${result.error}`;
        }
        return `${result.ip}: ${result.city}, ${result.country} (${result.timezone}) [${result.coordinates}]`;
      })
    );
  }
);

server.tool(
  "ip_to_timezone",
  "Get timezone information for a specific IP address",
  {
    ip: z.string().describe("IP address to look up (e.g. 8.8.8.8)"),
  },
  async ({ ip }) => {
    const data = await fetchJSON<TimezoneResponse>(
      buildURL("http://ip-api.com/json/" + ip, {
        fields: "query,timezone,offset,country,city",
      })
    );

    if (!data.timezone) {
      return error(`Failed to get timezone for IP ${ip}`);
    }

    return text(
      keyValue({
        "🌐 IP": data.query || ip,
        "⏰ Timezone": data.timezone,
        "🕐 UTC Offset": data.offset ? `UTC${data.offset > 0 ? "+" : ""}${data.offset / 3600}` : "N/A",
        "🌍 Country": data.country || "N/A",
        "🏙️ City": data.city || "N/A",
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
