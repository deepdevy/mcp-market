#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchJSON, text, error, keyValue, numberedList } from "@mcp-market/core";

const server = new McpServer({
  name: "mcp-market-dictionary",
  version: "0.1.0",
});

// ── Types ──────────────────────────────────────────────────

interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface Phonetic {
  text?: string;
  audio?: string;
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: Phonetic[];
  meanings: Meaning[];
}

// ── Tools ──────────────────────────────────────────────────

server.tool(
  "define_word",
  "Get the definition of a word with meanings grouped by part of speech",
  {
    word: z.string().describe("The word to define"),
  },
  async ({ word }) => {
    const data = await fetchJSON<DictionaryEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!data || !data.length) {
      return error(`Word "${word}" not found`);
    }

    const entry = data[0];
    const lines: string[] = [];

    lines.push(`📖 ${entry.word}`);
    if (entry.phonetic) {
      lines.push(`🔊 ${entry.phonetic}`);
    }
    lines.push("");

    for (const meaning of entry.meanings) {
      lines.push(`**${meaning.partOfSpeech}**`);
      const defs = meaning.definitions.slice(0, 3);
      lines.push(
        numberedList(defs, (def) => {
          let result = def.definition;
          if (def.example) {
            result += ` — "${def.example}"`;
          }
          return result;
        })
      );
      lines.push("");
    }

    return text(lines.join("\n"));
  }
);

server.tool(
  "get_synonyms",
  "Get all synonyms for a word",
  {
    word: z.string().describe("The word to find synonyms for"),
  },
  async ({ word }) => {
    const data = await fetchJSON<DictionaryEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!data || !data.length) {
      return error(`Word "${word}" not found`);
    }

    const entry = data[0];
    const synonymSet = new Set<string>();

    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        if (def.synonyms) {
          for (const syn of def.synonyms) {
            synonymSet.add(syn);
          }
        }
      }
    }

    if (synonymSet.size === 0) {
      return text(`No synonyms found for "${word}"`);
    }

    const synonyms = Array.from(synonymSet).sort();
    return text(`Synonyms for "${word}":\n${synonyms.join(", ")}`);
  }
);

server.tool(
  "get_antonyms",
  "Get all antonyms for a word",
  {
    word: z.string().describe("The word to find antonyms for"),
  },
  async ({ word }) => {
    const data = await fetchJSON<DictionaryEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!data || !data.length) {
      return error(`Word "${word}" not found`);
    }

    const entry = data[0];
    const antonymSet = new Set<string>();

    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        if (def.antonyms) {
          for (const ant of def.antonyms) {
            antonymSet.add(ant);
          }
        }
      }
    }

    if (antonymSet.size === 0) {
      return text(`No antonyms found for "${word}"`);
    }

    const antonyms = Array.from(antonymSet).sort();
    return text(`Antonyms for "${word}":\n${antonyms.join(", ")}`);
  }
);

server.tool(
  "get_pronunciation",
  "Get the pronunciation of a word with audio URL if available",
  {
    word: z.string().describe("The word to get pronunciation for"),
  },
  async ({ word }) => {
    const data = await fetchJSON<DictionaryEntry[]>(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!data || !data.length) {
      return error(`Word "${word}" not found`);
    }

    const entry = data[0];
    const result: Record<string, string> = {};

    if (entry.phonetic) {
      result["Phonetic"] = entry.phonetic;
    }

    let audioUrl: string | undefined;
    if (entry.phonetics) {
      for (const phonetic of entry.phonetics) {
        if (phonetic.audio) {
          audioUrl = phonetic.audio;
          break;
        }
      }
    }

    if (audioUrl) {
      result["Audio URL"] = audioUrl;
    }

    if (Object.keys(result).length === 0) {
      return text(`No pronunciation data available for "${word}"`);
    }

    return text(keyValue(result));
  }
);

// ── Start ──────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
