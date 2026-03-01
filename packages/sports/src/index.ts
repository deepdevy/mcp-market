#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-sports",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface Team {
  strTeam?: string;
  strLeague?: string;
  strCountry?: string;
  intFormedYear?: number;
  strDescriptionEN?: string;
  strBadge?: string;
}

interface TeamsResponse {
  teams?: Team[];
}

interface Player {
  strPlayer?: string;
  strTeam?: string;
  strNationality?: string;
  strPosition?: string;
  dateBorn?: string;
  strDescriptionEN?: string;
  strThumb?: string;
}

interface PlayersResponse {
  player?: Player[];
}

interface LeagueTeam {
  strTeam?: string;
  strStadium?: string;
  strCountry?: string;
  strBadge?: string;
}

interface LeagueTeamsResponse {
  teams?: LeagueTeam[];
}

interface Event {
  strEvent?: string;
  strLeague?: string;
  dateEvent?: string;
  strTime?: string;
  strVenue?: string;
  intHomeScore?: number;
  intAwayScore?: number;
}

interface EventsResponse {
  results?: Event[];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_team",
  "Search for a sports team by name",
  {
    team: z.string().describe("Team name to search for (e.g. Manchester United, Lakers)"),
  },
  async ({ team }) => {
    const data = await fetchJSON<TeamsResponse>(
      buildURL("https://www.thesportsdb.com/api/v1/json/3/searchteams.php", {
        t: team,
      })
    );

    if (!data.teams?.length) return error(`Team "${team}" not found`);

    const t = data.teams[0];
    return text(
      keyValue({
        "🏆 Team": t.strTeam || "N/A",
        "🏅 League": t.strLeague || "N/A",
        "🌍 Country": t.strCountry || "N/A",
        "📅 Founded": t.intFormedYear ? String(t.intFormedYear) : "N/A",
        "📝 Description": t.strDescriptionEN ? truncate(t.strDescriptionEN, 300) : "N/A",
        "🔗 Badge": t.strBadge || "N/A",
      })
    );
  }
);

server.tool(
  "search_player",
  "Search for a sports player by name",
  {
    player: z.string().describe("Player name to search for (e.g. Cristiano Ronaldo, LeBron James)"),
  },
  async ({ player }) => {
    const data = await fetchJSON<PlayersResponse>(
      buildURL("https://www.thesportsdb.com/api/v1/json/3/searchplayers.php", {
        p: player,
      })
    );

    if (!data.player?.length) return error(`Player "${player}" not found`);

    const p = data.player[0];
    return text(
      keyValue({
        "👤 Player": p.strPlayer || "N/A",
        "🏆 Team": p.strTeam || "N/A",
        "🌍 Nationality": p.strNationality || "N/A",
        "📍 Position": p.strPosition || "N/A",
        "🎂 Date of Birth": p.dateBorn || "N/A",
        "📝 Description": p.strDescriptionEN ? truncate(p.strDescriptionEN, 300) : "N/A",
        "🖼️ Photo": p.strThumb || "N/A",
      })
    );
  }
);

server.tool(
  "league_teams",
  "Get all teams in a specific league",
  {
    league: z.string().describe("League name (e.g. English Premier League, NBA)"),
  },
  async ({ league }) => {
    const data = await fetchJSON<LeagueTeamsResponse>(
      buildURL("https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php", {
        l: league,
      })
    );

    if (!data.teams?.length) return error(`League "${league}" not found or has no teams`);

    const teams = data.teams.map((t) => ({
      team: t.strTeam || "N/A",
      stadium: t.strStadium || "N/A",
      country: t.strCountry || "N/A",
      badge: t.strBadge || "N/A",
    }));

    return text(
      `🏅 ${league} — ${teams.length} teams\n\n${numberedList(teams, (t) => `${t.team} (${t.stadium}, ${t.country})`)}`
    );
  }
);

server.tool(
  "next_events",
  "Get next 5 upcoming events for a team",
  {
    team_id: z.string().describe("Team ID from TheSportsDB (numeric string)"),
  },
  async ({ team_id }) => {
    const data = await fetchJSON<EventsResponse>(
      buildURL("https://www.thesportsdb.com/api/v1/json/3/eventsnext.php", {
        id: team_id,
      })
    );

    if (!data.results?.length) return error(`No upcoming events found for team ID ${team_id}`);

    const events = data.results.slice(0, 5).map((e) => ({
      event: e.strEvent || "N/A",
      league: e.strLeague || "N/A",
      date: e.dateEvent || "N/A",
      time: e.strTime || "N/A",
      venue: e.strVenue || "N/A",
    }));

    return text(
      `📅 Next 5 Events (Team ID: ${team_id})\n\n${numberedList(events, (e) => `${e.event} — ${e.date} ${e.time} at ${e.venue}`)}`
    );
  }
);

server.tool(
  "past_events",
  "Get last 5 past events for a team",
  {
    team_id: z.string().describe("Team ID from TheSportsDB (numeric string)"),
  },
  async ({ team_id }) => {
    const data = await fetchJSON<EventsResponse>(
      buildURL("https://www.thesportsdb.com/api/v1/json/3/eventslast.php", {
        id: team_id,
      })
    );

    if (!data.results?.length) return error(`No past events found for team ID ${team_id}`);

    const events = data.results.slice(0, 5).map((e) => ({
      event: e.strEvent || "N/A",
      league: e.strLeague || "N/A",
      date: e.dateEvent || "N/A",
      score: `${e.intHomeScore ?? "?"} - ${e.intAwayScore ?? "?"}`,
    }));

    return text(
      `📊 Last 5 Events (Team ID: ${team_id})\n\n${numberedList(events, (e) => `${e.event} — ${e.date} (${e.score})`)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
