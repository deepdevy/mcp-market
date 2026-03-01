#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, truncate } from "@mcp-market/core";
import { requireEnv } from "@mcp-market/core";

const API_KEY = requireEnv("ALPHA_VANTAGE_API_KEY");

const server = new McpServer({
  name: "mcp-market-stocks",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface GlobalQuoteResponse {
  "Global Quote": {
    "01. symbol": string;
    "05. price": string;
    "09. change": string;
    "10. change percent": string;
    "06. volume": string;
    "07. latest trading day": string;
  };
}

interface SymbolSearchResponse {
  bestMatches?: Array<{
    "1. symbol": string;
    "2. name": string;
    "3. type": string;
    "4. region": string;
    "8. currency": string;
  }>;
}

interface TimeSeries {
  [date: string]: {
    "1. open": string;
    "2. high": string;
    "3. low": string;
    "4. close": string;
    "5. volume": string;
  };
}

interface DailyPricesResponse {
  "Time Series (Daily)": TimeSeries;
}

interface CompanyOverviewResponse {
  Name: string;
  Symbol: string;
  Description: string;
  Sector: string;
  Industry: string;
  MarketCapitalization: string;
  PERatio: string;
  DividendYield: string;
  "52WeekHigh": string;
  "52WeekLow": string;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_quote",
  "Get current stock quote for a symbol",
  {
    symbol: z.string().describe("Stock symbol (e.g. AAPL, GOOGL, MSFT)"),
  },
  async ({ symbol }) => {
    const data = await fetchJSON<GlobalQuoteResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "GLOBAL_QUOTE",
        symbol,
        apikey: API_KEY,
      })
    );

    const quote = data["Global Quote"];
    if (!quote || !quote["01. symbol"]) {
      return error(`Symbol "${symbol}" not found`);
    }

    return text(
      keyValue({
        "📈 Symbol": quote["01. symbol"],
        "💰 Price": `$${quote["05. price"]}`,
        "📊 Change": quote["09. change"],
        "📈 Change %": quote["10. change percent"],
        "📉 Volume": quote["06. volume"],
        "📅 Latest Trading Day": quote["07. latest trading day"],
      })
    );
  }
);

server.tool(
  "search_symbol",
  "Search for stock symbols by keywords",
  {
    keywords: z.string().describe("Search keywords (e.g. Apple, Microsoft, Tesla)"),
  },
  async ({ keywords }) => {
    const data = await fetchJSON<SymbolSearchResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "SYMBOL_SEARCH",
        keywords,
        apikey: API_KEY,
      })
    );

    const matches = data.bestMatches;
    if (!matches || matches.length === 0) {
      return error(`No symbols found for "${keywords}"`);
    }

    const results = matches
      .map(
        (m) =>
          `${m["1. symbol"]} — ${m["2. name"]} (${m["3. type"]}, ${m["4. region"]}, ${m["8. currency"]})`
      )
      .join("\n");

    return text(`🔍 Search results for "${keywords}":\n\n${results}`);
  }
);

server.tool(
  "daily_prices",
  "Get daily stock prices for the last N days",
  {
    symbol: z.string().describe("Stock symbol (e.g. AAPL)"),
    days: z
      .number()
      .min(1)
      .max(30)
      .default(5)
      .describe("Number of days to retrieve (1-30, default 5)"),
  },
  async ({ symbol, days }) => {
    const data = await fetchJSON<DailyPricesResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "TIME_SERIES_DAILY",
        symbol,
        apikey: API_KEY,
      })
    );

    const timeSeries = data["Time Series (Daily)"];
    if (!timeSeries) {
      return error(`No data found for symbol "${symbol}"`);
    }

    const dates = Object.keys(timeSeries).slice(0, days);
    const lines = dates.map((date) => {
      const d = timeSeries[date];
      return `${date}: O: $${d["1. open"]}, H: $${d["2. high"]}, L: $${d["3. low"]}, C: $${d["4. close"]}, V: ${d["5. volume"]}`;
    });

    return text(`📊 ${symbol} — Last ${days} trading days:\n\n${lines.join("\n")}`);
  }
);

server.tool(
  "company_overview",
  "Get company overview and fundamental data",
  {
    symbol: z.string().describe("Stock symbol (e.g. AAPL)"),
  },
  async ({ symbol }) => {
    const data = await fetchJSON<CompanyOverviewResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "OVERVIEW",
        symbol,
        apikey: API_KEY,
      })
    );

    if (!data.Symbol) {
      return error(`Company data not found for symbol "${symbol}"`);
    }

    return text(
      keyValue({
        "🏢 Name": data.Name,
        "📈 Symbol": data.Symbol,
        "📝 Description": truncate(data.Description, 300),
        "🏭 Sector": data.Sector,
        "🔧 Industry": data.Industry,
        "💵 Market Cap": data.MarketCapitalization,
        "📊 P/E Ratio": data.PERatio,
        "💸 Dividend Yield": data.DividendYield,
        "📈 52-Week High": `$${data["52WeekHigh"]}`,
        "📉 52-Week Low": `$${data["52WeekLow"]}`,
      })
    );
  }
);

server.tool(
  "compare_stocks",
  "Compare two stocks side-by-side",
  {
    symbol1: z.string().describe("First stock symbol (e.g. AAPL)"),
    symbol2: z.string().describe("Second stock symbol (e.g. MSFT)"),
  },
  async ({ symbol1, symbol2 }) => {
    const data1 = await fetchJSON<GlobalQuoteResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "GLOBAL_QUOTE",
        symbol: symbol1,
        apikey: API_KEY,
      })
    );

    const data2 = await fetchJSON<GlobalQuoteResponse>(
      buildURL("https://www.alphavantage.co/query", {
        function: "GLOBAL_QUOTE",
        symbol: symbol2,
        apikey: API_KEY,
      })
    );

    const quote1 = data1["Global Quote"];
    const quote2 = data2["Global Quote"];

    if (!quote1 || !quote1["01. symbol"] || !quote2 || !quote2["01. symbol"]) {
      return error(`Could not fetch data for one or both symbols`);
    }

    const comparison = `
📊 ${quote1["01. symbol"]} vs ${quote2["01. symbol"]}

${quote1["01. symbol"]}:
  💰 Price: $${quote1["05. price"]}
  📊 Change: ${quote1["09. change"]} (${quote1["10. change percent"]})
  📉 Volume: ${quote1["06. volume"]}

${quote2["01. symbol"]}:
  💰 Price: $${quote2["05. price"]}
  📊 Change: ${quote2["09. change"]} (${quote2["10. change percent"]})
  📉 Volume: ${quote2["06. volume"]}
    `.trim();

    return text(comparison);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
