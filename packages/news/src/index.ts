#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-market/core";
import { requireEnv } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-news",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface Article {
  title: string;
  description: string;
  url: string;
  source: {
    name: string;
  };
  publishedAt: string;
}

interface NewsResponse {
  articles: Article[];
}

// ── Helpers ────────────────────────────────────────────────

const API_KEY = requireEnv("GNEWS_API_KEY");

function formatArticle(article: Article): string {
  return `${article.title}\n${truncate(article.description, 200)}\n🔗 ${article.source.name} — ${article.publishedAt}`;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_news",
  "Search for news articles by query",
  {
    query: z.string().describe("Search query (e.g. 'artificial intelligence', 'climate change')"),
    lang: z
      .string()
      .default("en")
      .describe("Language code (default 'en')"),
    max: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of articles (1-10, default 5)"),
  },
  async ({ query, lang, max }) => {
    const data = await fetchJSON<NewsResponse>(
      buildURL("https://gnews.io/api/v4/search", {
        q: query,
        lang: lang,
        max: max,
        apikey: API_KEY,
      })
    );

    if (!data.articles?.length) return error(`No articles found for "${query}"`);

    const articles = data.articles.map(formatArticle);
    return text(numberedList(articles, (item) => item));
  }
);

server.tool(
  "top_headlines",
  "Get top headlines by category",
  {
    category: z
      .enum(["general", "world", "nation", "business", "technology", "entertainment", "sports", "science", "health"])
      .default("general")
      .describe("News category (default 'general')"),
    lang: z
      .string()
      .default("en")
      .describe("Language code (default 'en')"),
    max: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of articles (1-10, default 5)"),
  },
  async ({ category, lang, max }) => {
    const data = await fetchJSON<NewsResponse>(
      buildURL("https://gnews.io/api/v4/top-headlines", {
        category: category,
        lang: lang,
        max: max,
        apikey: API_KEY,
      })
    );

    if (!data.articles?.length) return error(`No headlines found for category "${category}"`);

    const articles = data.articles.map(formatArticle);
    return text(numberedList(articles, (item) => item));
  }
);

server.tool(
  "news_by_topic",
  "Get most relevant articles for a specific topic",
  {
    topic: z.string().describe("Topic to search for (e.g. 'quantum computing', 'renewable energy')"),
    lang: z
      .string()
      .default("en")
      .describe("Language code (default 'en')"),
  },
  async ({ topic, lang }) => {
    const data = await fetchJSON<NewsResponse>(
      buildURL("https://gnews.io/api/v4/search", {
        q: topic,
        lang: lang,
        max: 5,
        apikey: API_KEY,
        sortby: "relevance",
      })
    );

    if (!data.articles?.length) return error(`No articles found for topic "${topic}"`);

    const articles = data.articles.map(formatArticle);
    return text(numberedList(articles, (item) => item));
  }
);

server.tool(
  "news_by_country",
  "Get top headlines for a specific country",
  {
    country: z.string().describe("ISO 2-letter country code (e.g. 'us', 'kr', 'jp', 'gb')"),
    max: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of articles (1-10, default 5)"),
  },
  async ({ country, max }) => {
    const data = await fetchJSON<NewsResponse>(
      buildURL("https://gnews.io/api/v4/top-headlines", {
        country: country,
        max: max,
        apikey: API_KEY,
      })
    );

    if (!data.articles?.length) return error(`No headlines found for country "${country}"`);

    const articles = data.articles.map(formatArticle);
    return text(numberedList(articles, (item) => item));
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
