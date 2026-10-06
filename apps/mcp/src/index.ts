#!/usr/bin/env node
// PromptForge MCP server — stdio transport, one tool: forge_prompt.
// Stdout is protocol-only; diagnostics go to stderr (PF_DEBUG=1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { forgePrompt } from "./forge-tool.js";

const here = dirname(fileURLToPath(import.meta.url));
// tsc does not copy .md files; the build script copies it next to index.js.
const description = readFileSync(join(here, "tool-description.md"), "utf8").trim();
const debug = process.env.PF_DEBUG ? (line: string) => process.stderr.write(line + "\n") : undefined;

const server = new McpServer({ name: "promptforge", version: "0.1.0" });

server.registerTool(
  "forge_prompt",
  {
    title: "Forge prompt",
    description,
    inputSchema: { input: z.string().describe("The user's raw request, unchanged.") },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ input }) => {
    const out = await forgePrompt(input, { log: debug });
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      isError: out.status === "error",
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
debug?.("[promptforge-mcp] ready (stdio)");
