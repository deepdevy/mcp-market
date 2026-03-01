#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-wikipedia",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface OpenSearchResult {
  query: string;
  titles: string[];
  descriptions: string[];
  urls: string[];
}

interface SummaryResponse {
  title: string;
  description: string;
  extract: string;
  thumbnail?: {
    source: string;
  };
  content_urls: {
    desktop: {
      page: string;
    };
  };
}

interface ExtractResponse {
  batchcomplete: boolean;
  query: {
    pages: Array<{
      title: string;
      extract: string;
    }>;
  };
}

interface OnThisDayResponse {
  events: Array<{
    year: number;
    text: string;
  }>;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_wikipedia",
  "Search Wikipedia for articles by query",
  {
    query: z.string().describe("Search query"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results (1-10, default 5)"),
  },
  async ({ query, limit }) => {
    const data = await fetchJSON<OpenSearchResult>(
      buildURL("https://en.wikipedia.org/w/api.php", {
        action: "opensearch",
        search: query,
        limit: limit,
        format: "json",
      })
    );

    if (!data.titles || data.titles.length === 0) {
      return error(`No results found for "${query}"`);
    }

    const results = data.titles.map((title, i) => ({
      title,
      description: data.descriptions[i] || "",
      url: data.urls[i] || "",
    }));

    return text(
      numberedList(results, (item) => `${item.title}\n${item.description}\n${item.url}`)
    );
  }
);

server.tool(
  "get_summary",
  "Get a summary of a Wikipedia article by title",
  {
    title: z.string().describe("Wikipedia article title"),
  },
  async ({ title }) => {
    const data = await fetchJSON<SummaryResponse>(
      buildURL(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    );

    const extract = truncate(data.extract, 1000);
    const thumbnail = data.thumbnail?.source || "No thumbnail available";

    return text(
      keyValue({
        "📄 Title": data.title,
        "📝 Description": data.description,
        "🖼️ Thumbnail": thumbnail,
        "📖 Extract": extract,
        "🔗 Page URL": data.content_urls.desktop.page,
      })
    );
  }
);

server.tool(
  "get_full_extract",
  "Get a longer extract from a Wikipedia article",
  {
    title: z.string().describe("Wikipedia article title"),
    sentences: z
      .number()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of sentences (1-20, default 5)"),
  },
  async ({ title, sentences }) => {
    const data = await fetchJSON<ExtractResponse>(
      buildURL("https://en.wikipedia.org/w/api.php", {
        action: "query",
        prop: "extracts",
        exsentences: sentences,
        exlimit: 1,
        explaintext: 1,
        titles: title,
        format: "json",
        formatversion: 2,
      })
    );

    const page = data.query.pages[0];
    if (!page || !page.extract) {
      return error(`Article "${title}" not found`);
    }

    return text(
      keyValue({
        "📄 Title": page.title,
        "📖 Extract": page.extract,
      })
    );
  }
);

server.tool(
  "random_article",
  "Get a random Wikipedia article",
  {},
  async () => {
    const data = await fetchJSON<SummaryResponse>(
      buildURL("https://en.wikipedia.org/api/rest_v1/page/random/summary")
    );

    const extract = truncate(data.extract, 500);
    const thumbnail = data.thumbnail?.source || "No thumbnail available";

    return text(
      keyValue({
        "📄 Title": data.title,
        "📝 Description": data.description,
        "🖼️ Thumbnail": thumbnail,
        "📖 Extract": extract,
        "🔗 Page URL": data.content_urls.desktop.page,
      })
    );
  }
);

server.tool(
  "get_on_this_day",
  "Get historical events that happened on a specific month and day",
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
    const data = await fetchJSON<OnThisDayResponse>(
      buildURL(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`)
    );

    if (!data.events || data.events.length === 0) {
      return error(`No events found for ${month}/${day}`);
    }

    const topEvents = data.events.slice(0, 5);

    return text(
      numberedList(topEvents, (event) => `${event.year}: ${event.text}`)
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
