#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-random",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface BoredActivity {
  activity: string;
  type: string;
  participants: number;
  price: number;
  link?: string;
  key?: string;
  accessibility?: number;
}

interface RandomUserResponse {
  results: Array<{
    name: {
      first: string;
      last: string;
    };
    email: string;
    location: {
      city: string;
      country: string;
    };
    phone: string;
    picture: {
      medium: string;
    };
  }>;
}

interface NumberFactResponse {
  text: string;
  type: string;
  number: number;
  found: boolean;
}

interface DateFactResponse {
  text: string;
  type: string;
  date: string;
  found: boolean;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "random_activity",
  "Get a random activity suggestion from Bored API",
  {},
  async () => {
    const data = await fetchJSON<BoredActivity>(
      "https://bored-api.appbrewery.com/random"
    );

    return text(
      keyValue({
        "🎯 Activity": data.activity,
        "📂 Type": data.type,
        "👥 Participants": data.participants.toString(),
        "💰 Price": `${(data.price * 100).toFixed(0)}%`,
      })
    );
  }
);

server.tool(
  "activity_by_type",
  "Get activities filtered by type from Bored API",
  {
    type: z
      .enum([
        "education",
        "recreational",
        "social",
        "diy",
        "charity",
        "cooking",
        "relaxation",
        "music",
        "busywork",
      ])
      .describe("Activity type"),
  },
  async ({ type }) => {
    const data = await fetchJSON<{ activity: BoredActivity[] }>(
      buildURL("https://bored-api.appbrewery.com/filter", { type })
    );

    if (!data.activity || data.activity.length === 0) {
      return error(`No activities found for type "${type}"`);
    }

    const activities = data.activity.slice(0, 5);
    const formatted = numberedList(activities, (activity) => activity.activity);

    return text(`📂 ${type} activities:\n\n${formatted}`);
  }
);

server.tool(
  "random_user",
  "Get random user profiles from Random User API",
  {
    count: z
      .number()
      .min(1)
      .max(10)
      .default(1)
      .describe("Number of users (1-10, default 1)"),
  },
  async ({ count }) => {
    const data = await fetchJSON<RandomUserResponse>(
      buildURL("https://randomuser.me/api/", { results: count })
    );

    if (!data.results || data.results.length === 0) {
      return error("Failed to fetch random users");
    }

    const users = data.results.map((user) => ({
      name: `${user.name.first} ${user.name.last}`,
      email: user.email,
      location: `${user.location.city}, ${user.location.country}`,
      phone: user.phone,
      picture: user.picture.medium,
    }));

    const formatted = numberedList(
      users,
      (user) =>
        `${user.name} (${user.email}) — ${user.location} — ${user.phone}`
    );

    return text(`👥 Random users:\n\n${formatted}`);
  }
);

server.tool(
  "number_fact",
  "Get a fun fact about a number from Numbers API",
  {
    number: z.number().describe("The number to get a fact about"),
  },
  async ({ number }) => {
    const data = await fetchJSON<NumberFactResponse>(
      buildURL(`http://numbersapi.com/${number}`, { json: "" })
    );

    if (!data.found) {
      return error(`No fact found for number ${number}`);
    }

    return text(
      keyValue({
        "🔢 Number": number.toString(),
        "📖 Fact": data.text,
        "📂 Type": data.type,
      })
    );
  }
);

server.tool(
  "date_fact",
  "Get a fun fact about a date from Numbers API",
  {
    month: z
      .number()
      .min(1)
      .max(12)
      .describe("Month (1-12)"),
    day: z
      .number()
      .min(1)
      .max(31)
      .describe("Day (1-31)"),
  },
  async ({ month, day }) => {
    const data = await fetchJSON<DateFactResponse>(
      buildURL(`http://numbersapi.com/${month}/${day}/date`, { json: "" })
    );

    if (!data.found) {
      return error(`No fact found for ${month}/${day}`);
    }

    return text(
      keyValue({
        "📅 Date": `${month}/${day}`,
        "📖 Fact": data.text,
      })
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
