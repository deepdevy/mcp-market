#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, truncate } from "@mcp-market/core";
import { requireEnv } from "@mcp-market/core";

const API_KEY = requireEnv("OMDB_API_KEY");

const server = new McpServer({
  name: "mcp-market-movies",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface SearchResult {
  Search?: Array<{
    Title: string;
    Year: string;
    imdbID: string;
    Type: string;
    Poster: string;
  }>;
  totalResults?: string;
  Response: string;
  Error?: string;
}

interface MovieDetail {
  Title: string;
  Year: string;
  Rated: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Actors: string;
  Plot: string;
  imdbRating: string;
  BoxOffice: string;
  Awards: string;
  Response: string;
  Error?: string;
}

interface RatingsResponse {
  Title: string;
  Ratings?: Array<{
    Source: string;
    Value: string;
  }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  Response: string;
  Error?: string;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_movie",
  "Search for movies by title",
  {
    query: z.string().describe("Movie title to search for"),
    year: z.number().optional().describe("Optional release year"),
  },
  async ({ query, year }) => {
    const params: Record<string, string | number> = {
      apikey: API_KEY,
      s: query,
    };
    if (year) params.y = year;

    const data = await fetchJSON<SearchResult>(
      buildURL("https://www.omdbapi.com/", params)
    );

    if (data.Response === "False") {
      return error(data.Error || "No movies found");
    }

    if (!data.Search?.length) {
      return error("No movies found");
    }

    const results = data.Search.map(
      (movie) =>
        `${movie.Title} (${movie.Year}) [${movie.Type}] - IMDb: ${movie.imdbID}`
    ).join("\n");

    return text(`Found ${data.Search.length} results:\n\n${results}`);
  }
);

server.tool(
  "get_movie",
  "Get detailed information about a movie by IMDb ID",
  {
    id: z.string().describe("IMDb ID (e.g., tt1234567)"),
  },
  async ({ id }) => {
    const data = await fetchJSON<MovieDetail>(
      buildURL("https://www.omdbapi.com/", {
        apikey: API_KEY,
        i: id,
        plot: "full",
      })
    );

    if (data.Response === "False") {
      return error(data.Error || "Movie not found");
    }

    return text(
      keyValue({
        "🎬 Title": data.Title,
        "📅 Year": data.Year,
        "🎭 Rated": data.Rated,
        "⏱️ Runtime": data.Runtime,
        "🏷️ Genre": data.Genre,
        "👤 Director": data.Director,
        "🎪 Actors": data.Actors,
        "📖 Plot": truncate(data.Plot, 500),
        "⭐ IMDb Rating": data.imdbRating,
        "💰 Box Office": data.BoxOffice,
        "🏆 Awards": data.Awards,
      })
    );
  }
);

server.tool(
  "get_movie_by_title",
  "Get detailed information about a movie by title",
  {
    title: z.string().describe("Movie title"),
    year: z.number().optional().describe("Optional release year"),
  },
  async ({ title, year }) => {
    const params: Record<string, string | number> = {
      apikey: API_KEY,
      t: title,
      plot: "full",
    };
    if (year) params.y = year;

    const data = await fetchJSON<MovieDetail>(
      buildURL("https://www.omdbapi.com/", params)
    );

    if (data.Response === "False") {
      return error(data.Error || "Movie not found");
    }

    return text(
      keyValue({
        "🎬 Title": data.Title,
        "📅 Year": data.Year,
        "🎭 Rated": data.Rated,
        "⏱️ Runtime": data.Runtime,
        "🏷️ Genre": data.Genre,
        "👤 Director": data.Director,
        "🎪 Actors": data.Actors,
        "📖 Plot": truncate(data.Plot, 500),
        "⭐ IMDb Rating": data.imdbRating,
        "💰 Box Office": data.BoxOffice,
        "🏆 Awards": data.Awards,
      })
    );
  }
);

server.tool(
  "get_movie_ratings",
  "Get ratings and reviews for a movie",
  {
    title: z.string().describe("Movie title"),
  },
  async ({ title }) => {
    const data = await fetchJSON<RatingsResponse>(
      buildURL("https://www.omdbapi.com/", {
        apikey: API_KEY,
        t: title,
      })
    );

    if (data.Response === "False") {
      return error(data.Error || "Movie not found");
    }

    const ratingsText = data.Ratings?.map(
      (r) => `${r.Source}: ${r.Value}`
    ).join("\n") || "No ratings available";

    return text(
      keyValue({
        "🎬 Title": data.Title,
        "⭐ IMDb Rating": `${data.imdbRating}/10 (${data.imdbVotes} votes)`,
        "🎯 Metascore": data.Metascore,
        "📊 Ratings": ratingsText,
      })
    );
  }
);

server.tool(
  "compare_movies",
  "Compare two movies side-by-side",
  {
    title1: z.string().describe("First movie title"),
    title2: z.string().describe("Second movie title"),
  },
  async ({ title1, title2 }) => {
    const data1 = await fetchJSON<MovieDetail>(
      buildURL("https://www.omdbapi.com/", {
        apikey: API_KEY,
        t: title1,
      })
    );

    const data2 = await fetchJSON<MovieDetail>(
      buildURL("https://www.omdbapi.com/", {
        apikey: API_KEY,
        t: title2,
      })
    );

    if (data1.Response === "False") {
      return error(`Movie "${title1}" not found`);
    }

    if (data2.Response === "False") {
      return error(`Movie "${title2}" not found`);
    }

    const comparison = `
🎬 ${data1.Title} vs ${data2.Title}

📅 Year:        ${data1.Year} vs ${data2.Year}
⭐ IMDb Rating: ${data1.imdbRating} vs ${data2.imdbRating}
⏱️ Runtime:     ${data1.Runtime} vs ${data2.Runtime}
🏷️ Genre:      ${data1.Genre} vs ${data2.Genre}
💰 Box Office:  ${data1.BoxOffice} vs ${data2.BoxOffice}
    `.trim();

    return text(comparison);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
