#!/usr/bin/env node
/**
 * MCP server for Google Tasks.
 *
 * Exposes tools to list/create/update/delete/move Google Task lists and tasks,
 * backed by the Google Tasks API v1 via an OAuth-authorized client (see auth.ts).
 *
 * Authorize once before starting this server: `google-tasks-mcp-auth` when
 * installed from npm, or `npm run auth` from a source checkout.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTaskListTools } from "./tools/tasklists.js";
import { registerTaskTools } from "./tools/tasks.js";
import { AuthConfigError } from "./auth.js";
import { TOKEN_PATH, CLIENT_SECRET_PATH } from "./constants.js";
import fs from "node:fs";

const server = new McpServer({
  name: "google-tasks-mcp-server",
  version: "1.0.0",
});

registerTaskListTools(server);
registerTaskTools(server);

async function main(): Promise<void> {
  // Check both credential files up front. Without this the server starts
  // cleanly and then fails on every single tool call, which reads as a broken
  // server rather than a missing file.
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    console.error(
      `ERROR: OAuth client secret not found at ${CLIENT_SECRET_PATH}.\n` +
        "Create a Desktop app OAuth client in Google Cloud Console (APIs & Services -> Credentials),\n" +
        "download its JSON, and save it to that path, or point GOOGLE_TASKS_CLIENT_SECRET at it."
    );
    process.exit(1);
  }

  if (!fs.existsSync(TOKEN_PATH)) {
    console.error(
      `ERROR: No cached Google Tasks token found at ${TOKEN_PATH}.\n` +
        "Complete the OAuth consent flow once before starting this server:\n" +
        "  google-tasks-mcp-auth   (installed from npm)\n" +
        "  npx -y -p @girmmy/google-tasks-mcp-server google-tasks-mcp-auth   (no install)\n" +
        "  npm run auth            (from a source checkout)"
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
