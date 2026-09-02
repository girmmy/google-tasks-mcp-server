import os from "node:os";
import path from "node:path";

/** Max characters returned in a single tool response before truncation kicks in. */
export const CHARACTER_LIMIT = 25000;

/** Default page size for list operations when the caller doesn't specify one. */
export const DEFAULT_PAGE_SIZE = 20;

/** Google Tasks API allows up to 100 results per page. */
export const MAX_PAGE_SIZE = 100;

/** OAuth scope required for full read/write access to Google Tasks. */
export const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

/** Default directory where OAuth credentials are cached, overridable via env. */
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".config", "google-tasks-mcp-server");

/** Path to the installed-app OAuth client secret downloaded from Google Cloud Console. */
export const CLIENT_SECRET_PATH =
  process.env.GOOGLE_TASKS_CLIENT_SECRET ?? path.join(DEFAULT_CONFIG_DIR, "client_secret.json");

/** Path where the user's refresh/access token is cached after the OAuth flow completes. */
export const TOKEN_PATH =
  process.env.GOOGLE_TASKS_TOKEN_PATH ?? path.join(DEFAULT_CONFIG_DIR, "token.json");

/** Loopback port used during the one-time `npm run auth` OAuth flow. */
export const OAUTH_LOOPBACK_PORT = parseInt(process.env.GOOGLE_TASKS_OAUTH_PORT ?? "53682", 10);

export const DEFAULT_TASKLIST_ID = "@default";
