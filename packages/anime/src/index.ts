#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-anime",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface AnimeSearchResult {
  data: Array<{
    mal_id: number;
    title: string;
    score: number;
    episodes: number | null;
    synopsis: string;
  }>;
}

interface AnimeDetails {
  data: {
    mal_id: number;
    title: string;
    score: number;
    rank: number;
    popularity: number;
    episodes: number | null;
    status: string;
    synopsis: string;
    genres: Array<{ name: string }>;
    studios: Array<{ name: string }>;
  };
}

interface SeasonalResponse {
  data: Array<{
    mal_id: number;
    title: string;
    score: number;
    episodes: number | null;
    synopsis: string;
  }>;
}

interface TopAnimeResponse {
  data: Array<{
    mal_id: number;
    rank: number;
    title: string;
    score: number;
    episodes: number | null;
    synopsis: string;
  }>;
}

interface RecommendationsResponse {
  data: Array<{
    entry: {
      mal_id: number;
      title: string;
    };
    url: string;
    votes: number;
  }>;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_anime",
  "Search for anime by title or keyword",
  {
    query: z.string().describe("Search query (anime title or keyword)"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ query, limit }) => {
    const data = await fetchJSON<AnimeSearchResult>(
      buildURL("https://api.jikan.moe/v4/anime", {
        q: query,
        limit: limit,
      })
    );

    if (!data.data?.length) return error(`No anime found for "${query}"`);

    const results = data.data.map((anime) => ({
      "Title": anime.title,
      "Score": anime.score,
      "Episodes": anime.episodes ?? "Unknown",
      "Synopsis": truncate(anime.synopsis, 200),
    }));

    return text(
      `🎬 Anime Search Results for "${query}"\n\n${numberedList(
        results.map((r) => keyValue(r)), (line) => line
      )}`
    );
  }
);

server.tool(
  "get_anime_details",
  "Get detailed information about a specific anime",
  {
    id: z.number().describe("Anime MAL ID (e.g., 1 for Cowboy Bebop)"),
  },
  async ({ id }) => {
    const data = await fetchJSON<AnimeDetails>(
      buildURL(`https://api.jikan.moe/v4/anime/${id}/full`)
    );

    if (!data.data) return error(`Anime with ID ${id} not found`);

    const anime = data.data;
    const genres = anime.genres.map((g) => g.name).join(", ");
    const studios = anime.studios.map((s) => s.name).join(", ");

    return text(
      keyValue({
        "Title": anime.title,
        "Score": `${anime.score}/10`,
        "Rank": `#${anime.rank}`,
        "Popularity": `#${anime.popularity}`,
        "Episodes": anime.episodes ?? "Unknown",
        "Status": anime.status,
        "Genres": genres || "N/A",
        "Studios": studios || "N/A",
        "Synopsis": truncate(anime.synopsis, 300),
      })
    );
  }
);

server.tool(
  "get_seasonal",
  "Get top anime from a specific season",
  {
    year: z
      .number()
      .optional()
      .describe("Year (e.g., 2024). If omitted, uses current season"),
    season: z
      .enum(["winter", "spring", "summer", "fall"])
      .optional()
      .describe("Season (winter/spring/summer/fall). If omitted, uses current season"),
  },
  async ({ year, season }) => {
    let url: string;
    if (year && season) {
      url = `https://api.jikan.moe/v4/seasons/${year}/${season}`;
    } else {
      url = "https://api.jikan.moe/v4/seasons/now";
    }

    const data = await fetchJSON<SeasonalResponse>(buildURL(url));

    if (!data.data?.length) return error("No seasonal anime found");

    const topAnime = data.data.slice(0, 10).map((anime) => ({
      "Title": anime.title,
      "Score": anime.score,
      "Episodes": anime.episodes ?? "Unknown",
      "Synopsis": truncate(anime.synopsis, 150),
    }));

    const seasonStr = season ? `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}` : "Current Season";

    return text(
      `🎬 Top 10 Anime — ${seasonStr}\n\n${numberedList(
        topAnime.map((a) => keyValue(a)), (line) => line
      )}`
    );
  }
);

server.tool(
  "get_top_anime",
  "Get top-ranked anime by type",
  {
    type: z
      .enum(["tv", "movie", "ova"])
      .default("tv")
      .describe("Anime type (tv/movie/ova, default tv)"),
    limit: z
      .number()
      .min(1)
      .max(25)
      .default(10)
      .describe("Number of results (1-25, default 10)"),
  },
  async ({ type, limit }) => {
    const data = await fetchJSON<TopAnimeResponse>(
      buildURL("https://api.jikan.moe/v4/top/anime", {
        type: type,
        limit: limit,
      })
    );

    if (!data.data?.length) return error(`No top ${type} anime found`);

    const topList = data.data.map((anime) => ({
      "Rank": `#${anime.rank}`,
      "Title": anime.title,
      "Score": `${anime.score}/10`,
      "Episodes": anime.episodes ?? "Unknown",
      "Synopsis": truncate(anime.synopsis, 150),
    }));

    return text(
      `🏆 Top ${limit} ${type.toUpperCase()} Anime\n\n${numberedList(
        topList.map((a) => keyValue(a)), (line) => line
      )}`
    );
  }
);

server.tool(
  "get_recommendations",
  "Get anime recommendations based on a specific anime",
  {
    id: z.number().describe("Anime MAL ID to get recommendations for"),
  },
  async ({ id }) => {
    const data = await fetchJSON<RecommendationsResponse>(
      buildURL(`https://api.jikan.moe/v4/anime/${id}/recommendations`)
    );

    if (!data.data?.length) return error(`No recommendations found for anime ID ${id}`);

    const recommendations = data.data.slice(0, 5).map((rec) => ({
      "Title": rec.entry.title,
      "Votes": rec.votes,
    }));

    return text(
      `💡 Top 5 Recommendations\n\n${numberedList(
        recommendations.map((r) => keyValue(r)), (r) => r
      )}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
