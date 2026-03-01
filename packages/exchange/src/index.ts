#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-exchange",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface ConvertResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface LatestRatesResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface HistoricalRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface TimeSeriesResponse {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

interface CurrenciesResponse {
  [key: string]: string;
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "convert",
  "Convert an amount from one currency to another using latest exchange rates",
  {
    amount: z.number().positive().describe("Amount to convert (e.g. 100)"),
    from: z.string().length(3).describe("Source currency code (e.g. USD, EUR, GBP)"),
    to: z.string().length(3).describe("Target currency code (e.g. EUR, JPY, CHF)"),
  },
  async ({ amount, from, to }) => {
    const data = await fetchJSON<ConvertResponse>(
      buildURL("https://api.frankfurter.dev/v1/latest", {
        amount: amount.toString(),
        from: from.toUpperCase(),
        to: to.toUpperCase(),
      })
    );

    const rate = data.rates[to.toUpperCase()];
    if (!rate) return error(`Unable to convert ${from} to ${to}`);

    return text(
      keyValue({
        "💱 Amount": `${data.amount} ${data.base}`,
        "📊 Rate": `1 ${data.base} = ${rate} ${to.toUpperCase()}`,
        "✅ Result": `${rate * data.amount} ${to.toUpperCase()}`,
        "📅 Date": data.date,
      })
    );
  }
);

server.tool(
  "latest_rates",
  "Get latest exchange rates for a base currency against all supported currencies",
  {
    base: z
      .string()
      .length(3)
      .default("USD")
      .describe("Base currency code (default USD)"),
  },
  async ({ base }) => {
    const data = await fetchJSON<LatestRatesResponse>(
      buildURL("https://api.frankfurter.dev/v1/latest", {
        base: base.toUpperCase(),
      })
    );

    const rates = Object.entries(data.rates).map(([code, rate]) => `${code}: ${rate}`);

    return text(
      `📊 Latest Exchange Rates (Base: ${data.base})\n📅 Date: ${data.date}\n\n${numberedList(rates, (item) => item)}`
    );
  }
);

server.tool(
  "historical_rate",
  "Get historical exchange rates for a specific date",
  {
    date: z.string().describe("Date in YYYY-MM-DD format (e.g. 2024-01-15)"),
    base: z
      .string()
      .length(3)
      .default("USD")
      .describe("Base currency code (default USD)"),
    to: z
      .string()
      .length(3)
      .optional()
      .describe("Target currency code (optional, e.g. EUR)"),
  },
  async ({ date, base, to }) => {
    const params: Record<string, string> = {
      base: base.toUpperCase(),
    };
    if (to) {
      params.symbols = to.toUpperCase();
    }

    const data = await fetchJSON<HistoricalRateResponse>(
      buildURL(`https://api.frankfurter.dev/v1/${date}`, params)
    );

    if (!data.rates || Object.keys(data.rates).length === 0) {
      return error(`No rates available for ${date}`);
    }

    const rates = Object.entries(data.rates).map(([code, rate]) => `${code}: ${rate}`);

    return text(
      `📊 Historical Exchange Rates\n📅 Date: ${data.date}\n🏦 Base: ${data.base}\n\n${numberedList(rates, (item) => item)}`
    );
  }
);

server.tool(
  "time_series",
  "Get exchange rate time series between two dates",
  {
    from_date: z.string().describe("Start date in YYYY-MM-DD format"),
    to_date: z.string().describe("End date in YYYY-MM-DD format"),
    base: z
      .string()
      .length(3)
      .default("USD")
      .describe("Base currency code (default USD)"),
    to: z.string().length(3).describe("Target currency code (e.g. EUR)"),
  },
  async ({ from_date, to_date, base, to }) => {
    const data = await fetchJSON<TimeSeriesResponse>(
      buildURL(`https://api.frankfurter.dev/v1/${from_date}..${to_date}`, {
        base: base.toUpperCase(),
        symbols: to.toUpperCase(),
      })
    );

    const dates = Object.keys(data.rates).sort();
    if (dates.length === 0) {
      return error(`No data available for ${from_date} to ${to_date}`);
    }

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const firstRate = data.rates[firstDate][to.toUpperCase()];
    const lastRate = data.rates[lastDate][to.toUpperCase()];
    const change = lastRate - firstRate;
    const changePercent = ((change / firstRate) * 100).toFixed(2);

    return text(
      keyValue({
        "📊 Currency Pair": `${data.base}/${to.toUpperCase()}`,
        "📅 Period": `${from_date} to ${to_date}`,
        "📈 First Rate": `${firstRate} (${firstDate})`,
        "📉 Last Rate": `${lastRate} (${lastDate})`,
        "💹 Change": `${change > 0 ? "+" : ""}${change.toFixed(4)} (${changePercent}%)`,
        "📊 Data Points": dates.length.toString(),
      })
    );
  }
);

server.tool(
  "list_currencies",
  "List all supported currency codes and their names",
  {},
  async () => {
    const data = await fetchJSON<CurrenciesResponse>(
      "https://api.frankfurter.dev/v1/currencies"
    );

    const currencies = Object.entries(data).map(([code, name]) => `${code}: ${name}`);

    return text(
      `💱 Supported Currencies (${currencies.length} total)\n\n${numberedList(currencies, (item) => item)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
