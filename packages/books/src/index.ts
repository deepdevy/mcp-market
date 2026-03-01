#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-books",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface OpenLibrarySearchResult {
  docs?: Array<{
    title: string;
    author_name?: string[];
    first_publish_year?: number;
    number_of_pages?: number;
    subject?: string[];
    key?: string;
  }>;
}

interface OpenLibraryBook {
  title: string;
  description?: string | { value: string };
  subjects?: string[];
  first_publish_date?: string;
}

interface PoemDBResponse {
  title: string;
  author: string;
  lines: string[];
}

interface PoemDBAuthorResponse {
  [key: string]: Array<{
    title: string;
  }>;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_book",
  "Search for books on Open Library by title, author, or keyword",
  {
    query: z.string().describe("Search query (title, author, or keyword)"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ query, limit }) => {
    const data = await fetchJSON<OpenLibrarySearchResult>(
      buildURL("https://openlibrary.org/search.json", {
        q: query,
        limit: limit,
      })
    );

    if (!data.docs?.length) {
      return error(`No books found for "${query}"`);
    }

    const results = data.docs.map((doc) => {
      const subjects = doc.subject?.slice(0, 3).join(", ") || "N/A";
      return `${doc.title} by ${doc.author_name?.[0] || "Unknown"} (${doc.first_publish_year || "N/A"}) — ${doc.number_of_pages || "?"} pages — Topics: ${subjects}`;
    });

    return text(
      `📚 Found ${data.docs.length} book(s) for "${query}":\n\n${numberedList(results, (r) => r)}`
    );
  }
);

server.tool(
  "get_book_details",
  "Get detailed information about a specific book from Open Library",
  {
    key: z.string().describe("Open Library book key (e.g., /works/OL45883W)"),
  },
  async ({ key }) => {
    const data = await fetchJSON<OpenLibraryBook>(
      `https://openlibrary.org${key}.json`
    );

    const description =
      typeof data.description === "string"
        ? data.description
        : data.description?.value || "No description available";

    const truncatedDesc = truncate(description, 300);
    const subjects = data.subjects?.slice(0, 5).join(", ") || "N/A";

    return text(
      keyValue({
        "📖 Title": data.title,
        "📝 Description": truncatedDesc,
        "🏷️ Subjects": subjects,
        "📅 First Published": data.first_publish_date || "N/A",
      })
    );
  }
);

server.tool(
  "get_book_cover",
  "Get the cover image URL for a book by ISBN",
  {
    isbn: z.string().describe("ISBN number (10 or 13 digits)"),
  },
  async ({ isbn }) => {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    return text(url);
  }
);

server.tool(
  "random_poem",
  "Get a random poem from PoetryDB",
  {},
  async () => {
    const data = await fetchJSON<PoemDBResponse>(
      "https://poetrydb.org/random"
    );

    const poemText = data.lines.join("\n");
    const truncatedPoem = truncate(poemText, 500);

    return text(
      keyValue({
        "📜 Title": data.title,
        "✍️ Author": data.author,
        "📖 Poem": truncatedPoem,
      })
    );
  }
);

server.tool(
  "search_poems_by_author",
  "Search for poems by a specific author on PoetryDB",
  {
    author: z.string().describe("Author name (e.g., Shakespeare, Dickinson)"),
  },
  async ({ author }) => {
    const data = await fetchJSON<PoemDBAuthorResponse>(
      `https://poetrydb.org/author/${author}`
    );

    const poems = Object.values(data).flat();
    if (!poems.length) {
      return error(`No poems found for author "${author}"`);
    }

    const titles = poems
      .slice(0, 10)
      .map((p) => p.title);

    return text(
      `📚 Found ${poems.length} poem(s) by ${author}:\n\n${numberedList(titles, (t) => t)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
