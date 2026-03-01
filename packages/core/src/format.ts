/** MCP tool result type */
interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Return a successful text result */
export function text(content: string): ToolResult {
  return { content: [{ type: "text", text: content }] };
}

/** Return an error text result */
export function error(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Format a key-value object into readable lines */
export function keyValue(data: Record<string, unknown>): string {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/** Format an array of objects into a numbered list */
export function numberedList<T>(items: T[], formatter: (item: T, index: number) => string): string {
  if (items.length === 0) return "No results found.";
  return items.map((item, i) => `${i + 1}. ${formatter(item, i)}`).join("\n\n");
}

/** Truncate text to a max length */
export function truncate(str: string, maxLength: number = 500): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
