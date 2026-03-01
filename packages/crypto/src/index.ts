#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-crypto",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface PriceResponse {
  [key: string]: Record<string, number | string>;
}

interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
  };
}

interface TrendingResponse {
  coins: TrendingCoin[];
}

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  description?: {
    en?: string;
  };
  market_data?: {
    current_price?: {
      usd?: number;
    };
    market_cap?: {
      usd?: number | null;
    };
    price_change_24h?: number;
  };
  market_cap_rank?: number | null;
}

interface MarketChartResponse {
  prices: Array<[number, number]>;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_price",
  "Get current price and 24h change for one or more cryptocurrencies",
  {
    coin_ids: z
      .string()
      .describe("Comma-separated coin IDs (e.g. bitcoin,ethereum,cardano)"),
    vs_currencies: z
      .string()
      .default("usd")
      .describe("Target currency (default: usd)"),
  },
  async ({ coin_ids, vs_currencies }) => {
    const data = await fetchJSON<PriceResponse>(
      buildURL("https://api.coingecko.com/api/v3/simple/price", {
        ids: coin_ids,
        vs_currencies: vs_currencies,
        include_24hr_change: "true",
      })
    );

    const lines: string[] = [];
    for (const [coinId, prices] of Object.entries(data)) {
      const price = prices[vs_currencies];
      const change = prices[`${vs_currencies}_24h_change`];
      const changeStr =
        typeof change === "number"
          ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
          : "N/A";
      lines.push(`${coinId.toUpperCase()}: ${price} ${vs_currencies.toUpperCase()} (24h: ${changeStr})`);
    }

    return text(lines.join("\n"));
  }
);

server.tool(
  "get_trending",
  "Get top 7 trending cryptocurrencies",
  {},
  async () => {
    const data = await fetchJSON<TrendingResponse>(
      buildURL("https://api.coingecko.com/api/v3/search/trending", {})
    );

    const lines = data.coins.slice(0, 7).map((coin, idx) => {
      const item = coin.item;
      const rank = item.market_cap_rank ? `#${item.market_cap_rank}` : "N/A";
      return `${idx + 1}. ${item.name} (${item.symbol.toUpperCase()}) — Rank: ${rank}`;
    });

    return text(`🔥 Top 7 Trending Coins\n\n${lines.join("\n")}`);
  }
);

server.tool(
  "get_coin_info",
  "Get detailed information about a specific cryptocurrency",
  {
    coin_id: z.string().describe("Coin ID (e.g. bitcoin, ethereum)"),
  },
  async ({ coin_id }) => {
    const data = await fetchJSON<CoinData>(
      buildURL(`https://api.coingecko.com/api/v3/coins/${coin_id}`, {
        localization: "false",
        tickers: "false",
        community_data: "false",
        developer_data: "false",
      })
    );

    const price = data.market_data?.current_price?.usd ?? "N/A";
    const marketCap = data.market_data?.market_cap?.usd ?? "N/A";
    const change24h = data.market_data?.price_change_24h ?? "N/A";
    const description = data.description?.en
      ? data.description.en.substring(0, 300).replace(/<[^>]*>/g, "")
      : "No description available";

    return text(
      keyValue({
        "💰 Name": data.name,
        "🔤 Symbol": data.symbol.toUpperCase(),
        "💵 Price (USD)": typeof price === "number" ? `$${price.toFixed(2)}` : price,
        "📊 Market Cap": typeof marketCap === "number" ? `$${marketCap.toLocaleString()}` : marketCap,
        "📈 24h Change": typeof change24h === "number" ? `${change24h > 0 ? "+" : ""}${change24h.toFixed(2)}%` : change24h,
        "📝 Description": description,
      })
    );
  }
);

server.tool(
  "get_market_chart",
  "Get price history and statistics for a cryptocurrency",
  {
    coin_id: z.string().describe("Coin ID (e.g. bitcoin, ethereum)"),
    days: z
      .number()
      .min(1)
      .max(365)
      .default(7)
      .describe("Number of days of history (1-365, default 7)"),
  },
  async ({ coin_id, days }) => {
    const data = await fetchJSON<MarketChartResponse>(
      buildURL(`https://api.coingecko.com/api/v3/coins/${coin_id}/market_chart`, {
        vs_currency: "usd",
        days: days.toString(),
      })
    );

    if (!data.prices || data.prices.length === 0) {
      return error(`No market data available for ${coin_id}`);
    }

    const prices = data.prices.map((p) => p[1]);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

    return text(
      keyValue({
        "📊 Period": `${days} days`,
        "💵 First Price": `$${firstPrice.toFixed(2)}`,
        "💵 Last Price": `$${lastPrice.toFixed(2)}`,
        "📉 Min Price": `$${minPrice.toFixed(2)}`,
        "📈 Max Price": `$${maxPrice.toFixed(2)}`,
        "📊 Overall Change": `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
      })
    );
  }
);

server.tool(
  "compare_coins",
  "Compare two cryptocurrencies side-by-side",
  {
    coin1: z.string().describe("First coin ID (e.g. bitcoin)"),
    coin2: z.string().describe("Second coin ID (e.g. ethereum)"),
  },
  async ({ coin1, coin2 }) => {
    const [data1, data2] = await Promise.all([
      fetchJSON<CoinData>(
        buildURL(`https://api.coingecko.com/api/v3/coins/${coin1}`, {
          localization: "false",
          tickers: "false",
          community_data: "false",
          developer_data: "false",
        })
      ),
      fetchJSON<CoinData>(
        buildURL(`https://api.coingecko.com/api/v3/coins/${coin2}`, {
          localization: "false",
          tickers: "false",
          community_data: "false",
          developer_data: "false",
        })
      ),
    ]);

    const formatPrice = (price: number | undefined) =>
      price ? `$${price.toFixed(2)}` : "N/A";
    const formatMarketCap = (cap: number | null | undefined) =>
      cap ? `$${cap.toLocaleString()}` : "N/A";
    const formatChange = (change: number | undefined) =>
      change ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "N/A";

    const comparison = `
🔄 Comparison: ${data1.name} vs ${data2.name}

${data1.name.padEnd(20)} | ${data2.name.padEnd(20)}
${"─".repeat(20)} | ${"─".repeat(20)}
Price: ${formatPrice(data1.market_data?.current_price?.usd).padEnd(17)} | Price: ${formatPrice(data2.market_data?.current_price?.usd)}
Market Cap: ${formatMarketCap(data1.market_data?.market_cap?.usd).padEnd(12)} | Market Cap: ${formatMarketCap(data2.market_data?.market_cap?.usd)}
24h Change: ${formatChange(data1.market_data?.price_change_24h).padEnd(12)} | 24h Change: ${formatChange(data2.market_data?.price_change_24h)}
Rank: ${(data1.market_cap_rank ? `#${data1.market_cap_rank}` : "N/A").padEnd(17)} | Rank: ${data2.market_cap_rank ? `#${data2.market_cap_rank}` : "N/A"}
    `.trim();

    return text(comparison);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
