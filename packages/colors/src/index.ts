#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, buildURL, text, error, keyValue, numberedList } from "@mcp-mk/core";

const server = new McpServer({
  name: "mcp-market-colors",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface ColorInfo {
  name: {
    value: string;
    closest_named_hex: string;
    exact_match_named_hex: boolean;
  };
  hex: {
    value: string;
  };
  rgb: {
    r: number;
    g: number;
    b: number;
  };
  hsl: {
    h: number;
    s: number;
    l: number;
  };
}

interface SchemeColor {
  hex: {
    value: string;
  };
  name: {
    value: string;
  };
}

interface SchemeResponse {
  colors: SchemeColor[];
}

interface EmojiData {
  name: string;
  category: string;
  group: string;
  htmlCode: string[];
  unicode: string[];
}

interface EmojiCategoryResponse extends Array<EmojiData> {}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "get_color_info",
  "Get detailed information about a color including name, RGB, HSL, and closest named colors",
  {
    hex: z.string().describe("Hex color code without # (e.g. FF5733)"),
  },
  async ({ hex }) => {
    const data = await fetchJSON<ColorInfo>(
      buildURL("https://www.thecolorapi.com/id", {
        hex: hex,
      })
    );

    return text(
      keyValue({
        "🎨 Color Name": data.name.value,
        "🔷 Hex": `#${data.hex.value}`,
        "🔴 RGB": `rgb(${data.rgb.r}, ${data.rgb.g}, ${data.rgb.b})`,
        "🌈 HSL": `hsl(${data.hsl.h}, ${data.hsl.s}%, ${data.hsl.l}%)`,
        "🏷️ Closest Named": data.name.closest_named_hex,
        "✅ Exact Match": data.name.exact_match_named_hex ? "Yes" : "No",
      })
    );
  }
);

server.tool(
  "color_scheme",
  "Generate a color scheme based on a hex color and mode",
  {
    hex: z.string().describe("Hex color code without # (e.g. FF5733)"),
    mode: z
      .enum(["monochrome", "monochrome-dark", "monochrome-light", "analogic", "complement", "analogic-complement", "triad", "quad"])
      .default("analogic")
      .describe("Color scheme mode (default: analogic)"),
    count: z
      .number()
      .min(2)
      .max(10)
      .default(5)
      .describe("Number of colors in scheme (2-10, default 5)"),
  },
  async ({ hex, mode, count }) => {
    const data = await fetchJSON<SchemeResponse>(
      buildURL("https://www.thecolorapi.com/scheme", {
        hex: hex,
        mode: mode,
        count: count,
      })
    );

    const colorList = data.colors.map((color) => `#${color.hex.value} — ${color.name.value}`);

    return text(
      `🎨 Color Scheme (${mode}, ${count} colors)\n\n${numberedList(colorList, (item) => item)}`
    );
  }
);

server.tool(
  "random_color",
  "Generate a random color and get its detailed information",
  {},
  async () => {
    const randomHex = Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")
      .toUpperCase();

    const data = await fetchJSON<ColorInfo>(
      buildURL("https://www.thecolorapi.com/id", {
        hex: randomHex,
      })
    );

    return text(
      keyValue({
        "🎨 Color Name": data.name.value,
        "🔷 Hex": `#${data.hex.value}`,
        "🔴 RGB": `rgb(${data.rgb.r}, ${data.rgb.g}, ${data.rgb.b})`,
        "🌈 HSL": `hsl(${data.hsl.h}, ${data.hsl.s}%, ${data.hsl.l}%)`,
        "🏷️ Closest Named": data.name.closest_named_hex,
        "✅ Exact Match": data.name.exact_match_named_hex ? "Yes" : "No",
      })
    );
  }
);

server.tool(
  "random_emoji",
  "Get a random emoji with its details",
  {},
  async () => {
    const data = await fetchJSON<EmojiData>(
      "https://emojihub.yurace.pro/api/random"
    );

    return text(
      keyValue({
        "😀 Name": data.name,
        "📂 Category": data.category,
        "🏷️ Group": data.group,
        "📝 HTML Code": data.htmlCode.join(", "),
        "🔤 Unicode": data.unicode.join(", "),
      })
    );
  }
);

server.tool(
  "emojis_by_category",
  "Get emojis by category (first 10)",
  {
    category: z
      .string()
      .describe("Category name (e.g. smileys-and-people, animals-and-nature, food-and-drink)"),
  },
  async ({ category }) => {
    const data = await fetchJSON<EmojiCategoryResponse>(
      buildURL("https://emojihub.yurace.pro/api/all/category", {
        category: category,
      })
    );

    const emojis = data.slice(0, 10).map((emoji) => `${emoji.htmlCode[0]} ${emoji.name}`);

    return text(
      `😀 Emojis in "${category}" (first 10)\n\n${numberedList(emojis, (item) => item)}`
    );
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
