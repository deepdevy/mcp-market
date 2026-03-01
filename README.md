# MCP Market

A monorepo of **30 MCP servers** wrapping popular public APIs, enabling AI agents (Claude, Cursor, etc.) to access real-time data through the [Model Context Protocol](https://modelcontextprotocol.io/).

**~130+ tools** across 30 packages. No hosted server needed — runs locally via stdio transport.

## Quick Start

```bash
# Install a specific server
npx @mcp-market/weather

# Or clone and build everything
git clone https://github.com/your-username/mcp-market.git
cd mcp-market
pnpm install
pnpm run build
```

### Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["-y", "@mcp-market/weather"]
    },
    "crypto": {
      "command": "npx",
      "args": ["-y", "@mcp-market/crypto"]
    }
  }
}
```

For servers that require API keys, add `env`:

```json
{
  "mcpServers": {
    "movies": {
      "command": "npx",
      "args": ["-y", "@mcp-market/movies"],
      "env": {
        "OMDB_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Packages

### No API Key Required

| Package | APIs | Tools | Description |
|---------|------|-------|-------------|
| `@mcp-market/weather` | Open-Meteo | 4 | Current weather, forecasts, historical data |
| `@mcp-market/geocoding` | Nominatim | 3 | Address search, reverse geocoding, place lookup |
| `@mcp-market/countries` | REST Countries | 4 | Country info, search, compare, region filter |
| `@mcp-market/holidays` | Nager.Date | 4 | Public holidays by country and year |
| `@mcp-market/earthquakes` | USGS | 3 | Recent earthquakes, search by magnitude/location |
| `@mcp-market/crypto` | CoinGecko | 5 | Prices, trending, market charts, compare coins |
| `@mcp-market/anime` | Jikan/MAL | 5 | Search anime, seasonal, top ranked, recommendations |
| `@mcp-market/books` | Open Library, PoetryDB | 5 | Search books, covers, random poems, poetry by author |
| `@mcp-market/art` | Art Institute Chicago, Met Museum | 4 | Search artworks, random art, artist search |
| `@mcp-market/food` | TheMealDB, TheCocktailDB | 6 | Search meals/cocktails, random recipes, ingredients |
| `@mcp-market/dictionary` | Free Dictionary | 4 | Definitions, synonyms, antonyms, pronunciation |
| `@mcp-market/wikipedia` | Wikipedia REST | 5 | Search, summaries, random articles, on this day |
| `@mcp-market/pokemon` | PokéAPI | 5 | Pokemon info, abilities, types, evolution, compare |
| `@mcp-market/names` | Nationalize, Genderize, Agify | 3 | Predict nationality, gender, age from names |
| `@mcp-market/iss` | Open Notify, Where the ISS at | 4 | ISS position, people in space, satellite tracking |
| `@mcp-market/random` | Bored API, Random User, Numbers | 5 | Random activities, users, number/date facts |
| `@mcp-market/dogs-cats` | Dog CEO, Cat Facts, HTTP Cat | 5 | Dog images, breeds, cat facts, HTTP status cats |
| `@mcp-market/colors` | TheColor API, EmojiHub | 5 | Color info, schemes, random colors, emojis |
| `@mcp-market/exchange` | Frankfurter | 5 | Currency conversion, rates, historical, time series |
| `@mcp-market/ip` | ip-api, ipapi.co | 4 | IP geolocation, timezone, batch lookup |
| `@mcp-market/sports` | TheSportsDB | 5 | Teams, players, leagues, events, scores |
| `@mcp-market/transport` | Open Charge Map, Overpass | 4 | EV chargers, railway stations nearby |

### API Key Required

| Package | APIs | Tools | Env Vars |
|---------|------|-------|----------|
| `@mcp-market/space` | NASA | 5 | `NASA_API_KEY` (optional, DEMO_KEY fallback) |
| `@mcp-market/movies` | OMDB | 5 | `OMDB_API_KEY` |
| `@mcp-market/news` | GNews | 4 | `GNEWS_API_KEY` |
| `@mcp-market/photos` | Unsplash | 5 | `UNSPLASH_ACCESS_KEY` |
| `@mcp-market/stocks` | Alpha Vantage | 5 | `ALPHA_VANTAGE_API_KEY` |
| `@mcp-market/museum` | Harvard Art Museums | 4 | `HARVARD_ART_API_KEY` |
| `@mcp-market/birds` | eBird | 4 | `EBIRD_API_KEY` |
| `@mcp-market/government` | Congress.gov, Open States | 4 | `CONGRESS_API_KEY`, `OPENSTATES_API_KEY` |

## Development

```bash
# Prerequisites
node >= 18
pnpm >= 9

# Setup
pnpm install

# Build all
pnpm run build

# Build single package
pnpm --filter @mcp-market/weather run build

# Dev mode (single package)
pnpm --filter @mcp-market/weather run dev
```

### Project Structure

```
mcp-market/
├── packages/
│   ├── core/          # Shared utilities (fetchJSON, buildURL, formatters)
│   ├── weather/       # Each package is an independent MCP server
│   ├── crypto/
│   └── ...
├── package.json       # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json         # Turborepo build config
└── tsconfig.base.json # Shared TypeScript config
```

### Creating a New Package

Each package follows the same pattern:

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-market/core";

const server = new McpServer({ name: "mcp-market-xxx", version: "0.1.0" });

server.tool("tool_name", "description", { param: z.string() }, async ({ param }) => {
  const data = await fetchJSON(buildURL("https://api.example.com", { q: param }));
  return text(keyValue({ "Key": data.value }));
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Protocol**: MCP SDK (`@modelcontextprotocol/sdk`)
- **Validation**: Zod
- **Build**: Turborepo + tsc
- **Package Manager**: pnpm workspaces

## License

MIT

## Disclaimer

This project wraps third-party public APIs. API availability, rate limits, and terms of service are governed by the respective API providers. Use your own API keys where required. This project is not affiliated with any of the API providers.
