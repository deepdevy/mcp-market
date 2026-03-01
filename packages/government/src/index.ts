#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList, truncate } from "@mcp-market/core";
import { requireEnv } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-government",
  version: "0.1.0",
});

// ── API Keys ────────────────────────────────────────────────

const CONGRESS_KEY = requireEnv("CONGRESS_API_KEY");
const OPENSTATES_KEY = requireEnv("OPENSTATES_API_KEY");

// ── Types ──────────────────────────────────────────────────

interface CongressBill {
  number: string;
  title: string;
  type: string;
  latestAction?: {
    text: string;
    actionDate: string;
  };
}

interface CongressBillsResponse {
  bills?: CongressBill[];
}

interface CongressBillDetailResponse {
  bill?: {
    number: string;
    title: string;
    originChamber: string;
    sponsors?: Array<{
      name: string;
      bioguideId: string;
    }>;
    latestAction?: {
      text: string;
      actionDate: string;
    };
    policyArea?: {
      name: string;
    };
    subjects?: Array<{
      name: string;
    }>;
  };
}

interface OpenStatesLegislator {
  name: string;
  current_role?: {
    title: string;
    district?: string;
  };
  party: string;
  image: string;
}

interface OpenStatesResponse {
  results?: OpenStatesLegislator[];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "search_bills",
  "Search for bills in the US Congress",
  {
    query: z.string().describe("Search query for bills"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ query, limit }) => {
    const url = buildURL("https://api.congress.gov/v3/bill", {
      format: "json",
      limit: limit.toString(),
      api_key: CONGRESS_KEY,
      query: query,
    });

    const data = await fetchJSON<CongressBillsResponse>(url);

    if (!data.bills || data.bills.length === 0) {
      return error(`No bills found matching "${query}"`);
    }

    const formatted = numberedList(data.bills, (bill) => {
      const action = bill.latestAction
        ? ` — ${truncate(bill.latestAction.text, 60)} (${bill.latestAction.actionDate})`
        : "";
      return `${bill.number} (${bill.type}): ${truncate(bill.title, 70)}${action}`;
    });

    return text(`Found ${data.bills.length} bills:\n\n${formatted}`);
  }
);

server.tool(
  "recent_bills",
  "Get recently updated bills from the US Congress",
  {
    congress: z
      .number()
      .default(118)
      .describe("Congress number (e.g. 118 for 2023-2024)"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return (1-10, default 5)"),
  },
  async ({ congress, limit }) => {
    const url = buildURL(`https://api.congress.gov/v3/bill/${congress}`, {
      format: "json",
      limit: limit.toString(),
      sort: "updateDate desc",
      api_key: CONGRESS_KEY,
    });

    const data = await fetchJSON<CongressBillsResponse>(url);

    if (!data.bills || data.bills.length === 0) {
      return error(`No bills found for Congress ${congress}`);
    }

    const formatted = numberedList(data.bills, (bill) => {
      const action = bill.latestAction
        ? ` — ${truncate(bill.latestAction.text, 60)} (${bill.latestAction.actionDate})`
        : "";
      return `${bill.number} (${bill.type}): ${truncate(bill.title, 70)}${action}`;
    });

    return text(`Recent bills from Congress ${congress}:\n\n${formatted}`);
  }
);

server.tool(
  "search_legislators",
  "Search for state legislators by state",
  {
    state: z
      .string()
      .length(2)
      .toUpperCase()
      .describe("Two-letter state code (e.g. CA, NY, TX)"),
  },
  async ({ state }) => {
    const jurisdiction = `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;
    const url = buildURL("https://v3.openstates.org/people", {
      jurisdiction: jurisdiction,
      apikey: OPENSTATES_KEY,
    });

    const data = await fetchJSON<OpenStatesResponse>(url, {
      headers: {
        "X-API-KEY": OPENSTATES_KEY,
      },
    });

    if (!data.results || data.results.length === 0) {
      return error(`No legislators found for state ${state}`);
    }

    const formatted = numberedList(data.results, (leg) => {
      const role = leg.current_role?.title || "Unknown";
      const district = leg.current_role?.district ? ` (District ${leg.current_role.district})` : "";
      return `${leg.name} — ${role}${district} [${leg.party}]`;
    });

    return text(`Legislators in ${state}:\n\n${formatted}`);
  }
);

server.tool(
  "get_bill_details",
  "Get detailed information about a specific bill",
  {
    congress: z.number().describe("Congress number (e.g. 118)"),
    bill_type: z
      .string()
      .toLowerCase()
      .describe("Bill type (e.g. hr, s, hjres, sjres)"),
    bill_number: z.number().describe("Bill number"),
  },
  async ({ congress, bill_type, bill_number }) => {
    const url = buildURL(
      `https://api.congress.gov/v3/bill/${congress}/${bill_type}/${bill_number}`,
      {
        format: "json",
        api_key: CONGRESS_KEY,
      }
    );

    const data = await fetchJSON<CongressBillDetailResponse>(url);

    if (!data.bill) {
      return error(`Bill ${bill_type.toUpperCase()}${bill_number} not found in Congress ${congress}`);
    }

    const bill = data.bill;
    const sponsors = bill.sponsors
      ? numberedList(bill.sponsors, (s) => `${s.name} (${s.bioguideId})`)
      : "None listed";
    const subjects = bill.subjects
      ? numberedList(bill.subjects, (s) => s.name)
      : "None listed";

    const details = keyValue({
      "Bill Number": bill.number,
      "Title": truncate(bill.title, 100),
      "Origin Chamber": bill.originChamber,
      "Policy Area": bill.policyArea?.name || "Not specified",
      "Latest Action": bill.latestAction
        ? `${bill.latestAction.text} (${bill.latestAction.actionDate})`
        : "No action recorded",
      "Sponsors": sponsors,
      "Subjects": subjects,
    });

    return text(details);
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
