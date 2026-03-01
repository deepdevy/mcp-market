<p align="center">
  <h1 align="center">MCP Market</h1>
</p>

<p align="center">
  <strong>30 MCP servers. 133 tools. 40+ public APIs. One monorepo.</strong>
</p>

<p align="center">
  Give your AI agent real-time access to weather, crypto, news, Wikipedia, Pokemon, and 25 more APIs &mdash; zero hosted infrastructure required.
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Compatible-blue?style=flat" alt="MCP Compatible"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/packages-30-blue?style=flat" alt="30 Packages">
  <img src="https://img.shields.io/badge/tools-133-blue?style=flat" alt="133 Tools">
</p>

<br />

## Quick Start

**1. Add to Claude Desktop** &mdash; edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["-y", "@mcp-market/weather"]
    }
  }
}
```

**2. Restart Claude.** That's it. Ask Claude about the weather.

> [!TIP]
> Each package is independently installable. Pick only the ones you need &mdash; no need to install the entire monorepo.

<details>
<summary><strong>Using with Cursor / Windsurf / other MCP clients</strong></summary>

The same pattern works with any MCP-compatible client. Point the client to the package binary:

```bash
npx -y @mcp-market/weather
```

Or run locally after cloning:

```bash
node packages/weather/dist/index.js
```

</details>

<details>
<summary><strong>Servers that need API keys</strong></summary>

Some servers require API keys. Pass them via the `env` field:

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

See the [API Key Required](#-api-key-required) section for the full list.

</details>

---

## What's Inside

### By Category

| | Category | Packages | Tools | Highlights |
|---|----------|----------|-------|------------|
| :earth_americas: | **Geo & Weather** | 4 | 14 | weather, geocoding, countries, earthquakes |
| :moneybag: | **Finance** | 3 | 15 | crypto, exchange, stocks |
| :books: | **Knowledge** | 4 | 18 | wikipedia, dictionary, books, government |
| :movie_camera: | **Entertainment** | 3 | 16 | anime, movies, pokemon |
| :fork_and_knife: | **Food & Drink** | 1 | 6 | meals, cocktails, ingredients |
| :art: | **Art & Culture** | 2 | 8 | Art Institute Chicago, Met Museum, Harvard Art |
| :camera: | **Media** | 2 | 9 | photos (Unsplash), colors & emojis |
| :rocket: | **Science & Space** | 3 | 13 | NASA APOD, ISS tracking, bird watching |
| :newspaper: | **News & Info** | 2 | 8 | headlines, IP geolocation |
| :soccer: | **Sports** | 1 | 5 | teams, players, scores, events |
| :bus: | **Transport** | 1 | 4 | EV chargers, railway stations |
| :game_die: | **Fun & Random** | 4 | 17 | dogs, cats, names, random facts, holidays |

---

### :unlock: No API Key Required

> These servers work out of the box. No configuration needed.

| Package | APIs | Tools | Description |
|---------|------|:-----:|-------------|
| [`weather`](packages/weather) | Open-Meteo | 4 | Current weather, forecasts, historical data |
| [`geocoding`](packages/geocoding) | Nominatim | 3 | Address search, reverse geocoding, place lookup |
| [`countries`](packages/countries) | REST Countries | 4 | Country info, search, compare, region filter |
| [`holidays`](packages/holidays) | Nager.Date | 4 | Public holidays by country and year |
| [`earthquakes`](packages/earthquakes) | USGS | 3 | Recent earthquakes, search by magnitude/location |
| [`crypto`](packages/crypto) | CoinGecko | 5 | Prices, trending coins, market charts, compare |
| [`anime`](packages/anime) | Jikan / MAL | 5 | Search, seasonal, top ranked, recommendations |
| [`books`](packages/books) | Open Library, PoetryDB | 5 | Search books, covers, random poems |
| [`art`](packages/art) | Art Institute Chicago, Met Museum | 4 | Search artworks, random art, artist search |
| [`food`](packages/food) | TheMealDB, TheCocktailDB | 6 | Meals, cocktails, recipes, ingredients |
| [`dictionary`](packages/dictionary) | Free Dictionary | 4 | Definitions, synonyms, antonyms, pronunciation |
| [`wikipedia`](packages/wikipedia) | Wikipedia REST | 5 | Search, summaries, random articles, on this day |
| [`pokemon`](packages/pokemon) | PokeAPI | 5 | Pokemon info, abilities, types, evolution, compare |
| [`names`](packages/names) | Nationalize, Genderize, Agify | 3 | Predict nationality, gender, age from names |
| [`iss`](packages/iss) | Open Notify, Where the ISS at | 4 | ISS position, people in space, satellite tracking |
| [`random`](packages/random) | Bored API, Random User, Numbers | 5 | Random activities, users, number/date facts |
| [`dogs-cats`](packages/dogs-cats) | Dog CEO, Cat Facts, HTTP Cat | 5 | Dog images by breed, cat facts, HTTP status cats |
| [`colors`](packages/colors) | TheColor API, EmojiHub | 5 | Color info, palettes, random colors, emojis |
| [`exchange`](packages/exchange) | Frankfurter | 5 | Currency conversion, rates, historical, time series |
| [`ip`](packages/ip) | ip-api, ipapi.co | 4 | IP geolocation, timezone, batch lookup |
| [`sports`](packages/sports) | TheSportsDB | 5 | Teams, players, leagues, events, scores |
| [`transport`](packages/transport) | Open Charge Map, Overpass | 4 | EV chargers, railway stations nearby |

### :key: API Key Required

| Package | APIs | Tools | Env Variable(s) |
|---------|------|:-----:|-----------------|
| [`space`](packages/space) | NASA | 5 | `NASA_API_KEY` *(optional &mdash; DEMO_KEY fallback)* |
| [`movies`](packages/movies) | OMDB | 5 | `OMDB_API_KEY` |
| [`news`](packages/news) | GNews | 4 | `GNEWS_API_KEY` |
| [`photos`](packages/photos) | Unsplash | 5 | `UNSPLASH_ACCESS_KEY` |
| [`stocks`](packages/stocks) | Alpha Vantage | 5 | `ALPHA_VANTAGE_API_KEY` |
| [`museum`](packages/museum) | Harvard Art Museums | 4 | `HARVARD_ART_API_KEY` |
| [`birds`](packages/birds) | eBird | 4 | `EBIRD_API_KEY` |
| [`government`](packages/government) | Congress.gov, Open States | 4 | `CONGRESS_API_KEY`, `OPENSTATES_API_KEY` |

---

## Example: Multi-Server Setup

Here's a real-world config with multiple servers:

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
    },
    "wikipedia": {
      "command": "npx",
      "args": ["-y", "@mcp-market/wikipedia"]
    },
    "space": {
      "command": "npx",
      "args": ["-y", "@mcp-market/space"],
      "env": {
        "NASA_API_KEY": "DEMO_KEY"
      }
    }
  }
}
```

Then ask your AI agent:

- *"What's the weather in Seoul right now?"*
- *"Show me Bitcoin's price trend for the last 7 days"*
- *"Summarize the Wikipedia article on quantum computing"*
- *"What's NASA's astronomy picture of the day?"*

---

## Development

```bash
git clone https://github.com/deepdevy/mcp-market.git
cd mcp-market
pnpm install
pnpm run build     # builds all 31 packages via Turborepo
```

```bash
# Build a single package
pnpm --filter @mcp-market/weather run build

# Dev mode with auto-reload
pnpm --filter @mcp-market/weather run dev

# Clean all build artifacts
pnpm run clean
```

### Project Structure

```
mcp-market/
├── packages/
│   ├── core/           # Shared utilities (fetchJSON, buildURL, formatters)
│   ├── weather/        # Each package = independent MCP server
│   ├── crypto/
│   ├── anime/
│   └── ... (30 packages)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Adding a New Server

Every server follows the same pattern:

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

### Tech Stack

| | Technology | Role |
|---|-----------|------|
| :globe_with_meridians: | **Node.js 18+** | Runtime |
| :blue_book: | **TypeScript** | Language (strict mode) |
| :electric_plug: | **MCP SDK** | Protocol (`@modelcontextprotocol/sdk`) |
| :shield: | **Zod** | Input validation |
| :triangular_ruler: | **Turborepo** | Monorepo build orchestration |
| :package: | **pnpm** | Package manager (workspaces) |

---

## Contributing

Contributions welcome! Here's how to add a new MCP server:

1. Fork and clone the repo
2. Create `packages/your-api/` with `package.json`, `tsconfig.json`, `src/index.ts`
3. Follow the pattern above &mdash; use `@mcp-market/core` utilities
4. Run `pnpm install && pnpm run build` to verify
5. Open a PR

> [!NOTE]
> All servers must build cleanly with `tsc` in strict mode. No `any` types, no `@ts-ignore`.

---

## License

[MIT](LICENSE)

## Disclaimer

This project wraps third-party public APIs for use via the Model Context Protocol. API availability, rate limits, and terms of service are governed by the respective providers. Use your own API keys where required. This project is not affiliated with any of the API providers listed above.
