import fs from "node:fs";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";
import { CLIENT_SECRET_PATH, OAUTH_LOOPBACK_PORT, TOKEN_PATH } from "./constants.js";
import type { ClientSecretFile, StoredToken } from "./types.js";

export class AuthConfigError extends Error {}

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/** Loads the installed-app OAuth client id/secret downloaded from Google Cloud Console. */
export function loadClientSecret(): { clientId: string; clientSecret: string } {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    throw new AuthConfigError(
      `OAuth client secret not found at ${CLIENT_SECRET_PATH}.\n` +
        "Create a Desktop app OAuth client in Google Cloud Console (APIs & Services -> Credentials), " +
        "download its JSON, and save it to that path (or point GOOGLE_TASKS_CLIENT_SECRET at it)."
    );
  }
  const data = readJson<ClientSecretFile>(CLIENT_SECRET_PATH);
  const inner = data.installed ?? data.web;
  if (!inner?.client_id || !inner?.client_secret) {
    throw new AuthConfigError(
      `${CLIENT_SECRET_PATH} doesn't look like a valid OAuth client secret file (missing client_id/client_secret).`
    );
  }
  return { clientId: inner.client_id, clientSecret: inner.client_secret };
}

/** Builds an OAuth2Client configured with the loopback redirect URI used for the
 * one-time interactive authorization flow (see src/authorize.ts). */
export function createOAuth2Client(): OAuth2Client {
  const { clientId, clientSecret } = loadClientSecret();
  const redirectUri = `http://localhost:${OAUTH_LOOPBACK_PORT}/oauth2callback`;
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function saveToken(token: StoredToken): void {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function loadToken(): StoredToken {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new AuthConfigError(
      `No cached Google Tasks token found at ${TOKEN_PATH}.\n` +
        "Run `npm run auth` once to complete the OAuth consent flow and cache a token."
    );
  }
  return readJson<StoredToken>(TOKEN_PATH);
}

/**
 * Returns an OAuth2Client authorized with the cached refresh token, ready for API calls.
 * google-auth-library refreshes the access token automatically as it expires; we persist
 * any refreshed token back to disk so future runs don't need to re-authorize.
 */
export function getAuthorizedClient(): OAuth2Client {
  const client = createOAuth2Client();
  const token = loadToken();
  client.setCredentials(token);

  client.on("tokens", (newTokens) => {
    const merged: StoredToken = {
      ...token,
      ...newTokens,
      // A refresh response often omits refresh_token; keep the original.
      refresh_token: newTokens.refresh_token ?? token.refresh_token,
    };
    try {
      saveToken(merged);
    } catch (err) {
      console.error("Warning: failed to persist refreshed Google Tasks token:", err);
    }
  });

  return client;
}
