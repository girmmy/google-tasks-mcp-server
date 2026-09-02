#!/usr/bin/env node
/**
 * MCP server for Google Tasks.
 *
 * Exposes tools to list/create/update/delete/move Google Task lists and tasks,
 * backed by the Google Tasks API v1 via an OAuth-authorized client (see auth.ts).
 *
 * Run `npm run auth` once to authorize before starting this server.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTaskListTools } from "./tools/tasklists.js";
import { registerTaskTools } from "./tools/tasks.js";
import { AuthConfigError } from "./auth.js";
import { TOKEN_PATH } from "./constants.js";
import fs from "node:fs";

const server = new McpServer({
  name: "google-tasks-mcp-server",
  version: "1.0.0",
});

registerTaskListTools(server);
registerTaskTools(server);

async function main(): Promise<void> {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error(
      `ERROR: No cached Google Tasks token found at ${TOKEN_PATH}.\n` +
        "Run `npm run auth` once to complete the OAuth consent flow before starting this server."
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("google-tasks-mcp-server running via stdio");
}

main().catch((error) => {
  if (error instanceof AuthConfigError) {
    console.error(`ERROR: ${error.message}`);
  } else {
    console.error("Server error:", error);
  }
  process.exit(1);
});
