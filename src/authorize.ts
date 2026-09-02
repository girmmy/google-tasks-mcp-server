#!/usr/bin/env node
/**
 * One-time interactive OAuth authorization flow for Google Tasks.
 *
 * Run with `npm run auth`. Opens (or prints) a Google consent URL, starts a
 * short-lived local server to catch the OAuth redirect on localhost, exchanges
 * the returned code for tokens, and caches them to disk (see constants.ts:TOKEN_PATH)
 * for the MCP server to use on every subsequent run.
 */
import http from "node:http";
import { URL } from "node:url";
import { createOAuth2Client, saveToken, AuthConfigError } from "./auth.js";
import { OAUTH_LOOPBACK_PORT, TASKS_SCOPE, TOKEN_PATH, CLIENT_SECRET_PATH } from "./constants.js";

async function openInBrowser(url: string): Promise<void> {
  // Best-effort convenience only — if this fails (headless/remote environment),
  // the user can still copy/paste the printed URL manually.
  try {
    const { execFile } = await import("node:child_process");
    const platform = process.platform;
    if (platform === "darwin") execFile("open", [url]);
    else if (platform === "win32") execFile("cmd", ["/c", "start", "", url]);
    else execFile("xdg-open", [url]);
  } catch {
    // Ignore — printed URL above is the fallback path.
  }
}

async function main(): Promise<void> {
  let client;
  try {
    client = createOAuth2Client();
  } catch (err) {
    if (err instanceof AuthConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is issued even on re-auth
    scope: [TASKS_SCOPE],
  });

  console.log("Google Tasks MCP server — authorization\n");
  console.log(`Using OAuth client secret: ${CLIENT_SECRET_PATH}`);
  console.log(`Token will be cached to:   ${TOKEN_PATH}\n`);
  console.log("1. Open this URL in a browser and sign in / grant access:\n");
  console.log(`   ${authUrl}\n`);
  console.log(`2. Waiting for the redirect back to http://localhost:${OAUTH_LOOPBACK_PORT}/oauth2callback ...`);

  void openInBrowser(authUrl);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${OAUTH_LOOPBACK_PORT}`);
      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get("error");
      const returnedCode = url.searchParams.get("code");

      res.writeHead(200, { "Content-Type": "text/html" });
      if (error) {
        res.end(`<h1>Authorization failed</h1><p>${error}</p><p>You can close this tab.</p>`);
        server.close();
        reject(new Error(`Google returned an OAuth error: ${error}`));
        return;
      }
      if (!returnedCode) {
        res.end("<h1>No authorization code received</h1><p>You can close this tab.</p>");
        server.close();
        reject(new Error("No authorization code in redirect."));
        return;
      }

      res.end("<h1>Authorization complete</h1><p>You can close this tab and return to the terminal.</p>");
      server.close();
      resolve(returnedCode);
    });

    server.listen(OAUTH_LOOPBACK_PORT);
    server.on("error", reject);
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    console.warn(
      "\nWarning: no refresh_token was returned. If you've authorized this app before, " +
        "revoke access at https://myaccount.google.com/permissions and re-run `npm run auth`."
    );
  }
  saveToken(tokens);

  console.log(`\nAuthorization complete. Token cached to ${TOKEN_PATH}.`);
  console.log("You can now run the MCP server (npm run build && npm start).");
}

main().catch((err) => {
  console.error("\nAuthorization failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
