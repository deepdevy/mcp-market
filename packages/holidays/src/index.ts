#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-holidays",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface Holiday {
  date: string;
  name: string;
  localName: string;
}

interface LongWeekend {
  startDate: string;
  endDate: string;
  dayCount: number;
  needsTo: string;
}

// ── Helpers ────────────────────────────────────────────────

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDaysUntil(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_holidays",
  "Get list of public holidays for a country in a specific year",
  {
    country_code: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("2-letter ISO country code (e.g. KR, US, JP, DE)"),
    year: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .optional()
      .describe("Year (optional, defaults to current year)"),
  },
  async ({ country_code, year }) => {
    const targetYear = year ?? getCurrentYear();

    const data = await fetchJSON<Holiday[]>(
      buildURL(`https://date.nager.at/api/v3/PublicHolidays/${targetYear}/${country_code}`, {})
    );

    if (!Array.isArray(data) || data.length === 0) {
      return error(`No holidays found for ${country_code} in ${targetYear}`);
    }

    const lines = data.map(
      (h) => `${h.date}: ${h.name}${h.localName ? ` (${h.localName})` : ""}`
    );

    return text(
      `🎉 Holidays in ${country_code} (${targetYear})\n\n${lines.join("\n")}`
    );
  }
);

server.tool(
  "is_today_holiday",
  "Check if today is a public holiday in a specific country",
  {
    country_code: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("2-letter ISO country code (e.g. KR, US, JP, DE)"),
  },
  async ({ country_code }) => {
    const today = getTodayDate();
    const year = new Date().getFullYear();

    const data = await fetchJSON<Holiday[]>(
      buildURL(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country_code}`, {})
    );

    if (!Array.isArray(data)) {
      return error(`Failed to fetch holidays for ${country_code}`);
    }

    const todayHoliday = data.find((h) => h.date === today);

    if (todayHoliday) {
      return text(
        keyValue({
          "🎉 Today is a holiday": "Yes",
          "📅 Holiday name": todayHoliday.name,
          "🌍 Local name": todayHoliday.localName || "N/A",
        })
      );
    }

    return text(
      keyValue({
        "🎉 Today is a holiday": "No",
        "📅 Date": today,
        "🌍 Country": country_code,
      })
    );
  }
);

server.tool(
  "next_holiday",
  "Find the next upcoming public holiday in a country",
  {
    country_code: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("2-letter ISO country code (e.g. KR, US, JP, DE)"),
  },
  async ({ country_code }) => {
    const today = getTodayDate();
    const year = new Date().getFullYear();

    const data = await fetchJSON<Holiday[]>(
      buildURL(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country_code}`, {})
    );

    if (!Array.isArray(data)) {
      return error(`Failed to fetch holidays for ${country_code}`);
    }

    const upcomingHolidays = data.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    if (upcomingHolidays.length === 0) {
      return error(`No upcoming holidays found for ${country_code} in ${year}`);
    }

    const nextHoliday = upcomingHolidays[0];
    const daysUntil = calculateDaysUntil(nextHoliday.date);

    return text(
      keyValue({
        "🎉 Next holiday": nextHoliday.name,
        "📅 Date": nextHoliday.date,
        "🌍 Local name": nextHoliday.localName || "N/A",
        "⏳ Days until": `${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
      })
    );
  }
);

server.tool(
  "long_weekends",
  "Get list of long weekends for a country in a specific year",
  {
    country_code: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("2-letter ISO country code (e.g. KR, US, JP, DE)"),
    year: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .optional()
      .describe("Year (optional, defaults to current year)"),
  },
  async ({ country_code, year }) => {
    const targetYear = year ?? getCurrentYear();

    const data = await fetchJSON<LongWeekend[]>(
      buildURL(`https://date.nager.at/api/v3/LongWeekend/${targetYear}/${country_code}`, {})
    );

    if (!Array.isArray(data) || data.length === 0) {
      return error(`No long weekends found for ${country_code} in ${targetYear}`);
    }

    const lines = data.map(
      (lw) => `${lw.startDate} to ${lw.endDate}: ${lw.dayCount} days (${lw.needsTo})`
    );

    return text(
      `🏖️ Long weekends in ${country_code} (${targetYear})\n\n${lines.join("\n")}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
