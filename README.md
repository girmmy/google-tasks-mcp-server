# google-tasks-mcp-server

An [MCP](https://modelcontextprotocol.io) server for [Google Tasks](https://tasks.google.com). Gives any MCP client (Claude Desktop, Claude Code, Cursor, etc.) full read/write access to your task lists and tasks: list, create, update, complete, delete, and move them, with real due dates.

There's no official Google Tasks MCP server, so this covers that. Full CRUD, OAuth installed-app auth flow (your credentials never leave your machine), TypeScript throughout.

## Tools

**Task lists**
- `google_tasks_list_tasklists` list all task lists
- `google_tasks_get_tasklist` get one task list
- `google_tasks_create_tasklist` create a new task list
- `google_tasks_update_tasklist` rename a task list
- `google_tasks_delete_tasklist` delete a task list and all its tasks

**Tasks**
- `google_tasks_list_tasks` list tasks in a list, with due-date/updated filters and pagination
- `google_tasks_get_task` get one task
- `google_tasks_create_task` create a task (optionally as a subtask, optionally positioned)
- `google_tasks_update_task` update title/notes/due date/status
- `google_tasks_complete_task` / `google_tasks_reopen_task` mark done / not done
- `google_tasks_delete_task` delete a task
- `google_tasks_move_task` reorder, re-parent, or move a task to a different list
- `google_tasks_clear_completed_tasks` clear all completed tasks from a list

Every tool supports `response_format: "markdown" | "json"`.

## Quick start

```bash
git clone https://github.com/girmmy/google-tasks-mcp-server.git
cd google-tasks-mcp-server
npm install
npm run build
```

Then follow Setup below to create your own Google OAuth credentials and authorize. There's no shared or hosted version of this, it talks directly to your own Google account.

## Setup

### 1. Create a Google Cloud OAuth client

Each user needs their own OAuth client. It's not something that can be shared, since anyone using your client secret could impersonate your app (though they'd still need each individual user's own consent).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create (or pick) a project.
2. APIs & Services → Library → enable the Google Tasks API.
3. APIs & Services → OAuth consent screen (Google now calls this "Google Auth Platform"):
   - User type: External is fine for personal use.
   - Fill in app name and your email for support/contact.
   - Under Audience → Test users, add your own Google account. While the app is in "Testing" status only listed test users can authorize it, which is fine for running this yourself.
4. Clients → Create Client → Application type Desktop app. Create it.
5. Grab the client ID and client secret, either via "Download JSON" right after creation or from the client's detail page later. Google's console won't show a secret's plaintext again once you navigate away, only download or regenerate it, so if you lose it just add a new secret instead of hunting for the old one.
6. Save that file. By default this server looks for it at:
   `~/.config/google-tasks-mcp-server/client_secret.json`
   (override the path with the `GOOGLE_TASKS_CLIENT_SECRET` env var, useful if you'd rather keep it inside the project directory, e.g. `./credentials/client_secret.json`. `credentials/` is already gitignored.)

The file should look like:

```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "redirect_uris": ["http://localhost"]
  }
}
```

### 2. Install and build

```bash
npm install
npm run build
```

### 3. Authorize (one-time)

```bash
npm run auth
# or, if your client secret lives at a custom path:
GOOGLE_TASKS_CLIENT_SECRET=./credentials/client_secret.json npm run auth
```

This prints a Google consent URL and tries to open it in your default browser. Sign in, grant access, and it redirects back to a short-lived local server on `http://localhost:53682`. The token gets cached to `~/.config/google-tasks-mcp-server/token.json` (override with `GOOGLE_TASKS_TOKEN_PATH`) and refreshed automatically from then on, so you shouldn't need to run this again unless you revoke access.

Run this on the same machine and in the same regular terminal you'll actually use day to day. See Troubleshooting below if you're running it from a container, VM, or sandboxed shell where `localhost` doesn't map back to your browser.

### 4. Run it

```bash
npm start
```

Or wire it into an MCP client. For Claude Desktop / Claude Code, add to your MCP config (usually `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "google-tasks": {
      "command": "node",
      "args": ["/absolute/path/to/google-tasks-mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_TASKS_CLIENT_SECRET": "/absolute/path/to/google-tasks-mcp-server/credentials/client_secret.json"
      }
    }
  }
}
```

Omit the `env` block if you saved your client secret at the default `~/.config/...` path. Fully quit and reopen your MCP client afterward.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `GOOGLE_TASKS_CLIENT_SECRET` | `~/.config/google-tasks-mcp-server/client_secret.json` | Path to the downloaded OAuth client JSON |
| `GOOGLE_TASKS_TOKEN_PATH` | `~/.config/google-tasks-mcp-server/token.json` | Path where the cached OAuth token is stored |
| `GOOGLE_TASKS_OAUTH_PORT` | `53682` | Loopback port used only during `npm run auth` |

## Security notes

- The client secret and cached token are plain files on disk (mode `0600` for the token). Never commit them (`.gitignore` already excludes `client_secret*.json`, `token.json`, `credentials/`).
- The server requests the full `https://www.googleapis.com/auth/tasks` scope (read/write). For read-only access, edit `TASKS_SCOPE` in `src/constants.ts` to `.../auth/tasks.readonly` before running `npm run auth`. Write tools will then fail with a 403 from Google, which is expected.
- Tool annotations mark deletion/clear operations as `destructiveHint: true` so MCP clients can warn or gate on them.
- Nothing here talks to any server but Google's own APIs and, during `npm run auth`, a local loopback listener. No third-party backend involved.

## Troubleshooting

**`npm run auth` opens a URL, I click Allow, and it just hangs.**
The process running `npm run auth` isn't on the same machine/network as the browser you're clicking Allow in. Common if you're running the server inside a container, remote dev environment, or sandboxed shell that isolates `localhost`. Fix: run `npm run auth` directly in a normal local terminal on the machine whose browser you're using.

**`Error [TransformError] ... You installed esbuild for another platform`**
Your `node_modules` was installed on a different OS/architecture than you're running on now, e.g. copied from a Docker container or a different machine. Fix: `rm -rf node_modules package-lock.json && npm install`.

**`Authorization failed: invalid_client`**
Your `client_secret.json` has the wrong client secret in it, usually from copy-pasting it by hand instead of downloading it directly. Go back to Google Cloud Console, add a fresh client secret, download or copy it directly, and update your `client_secret.json`.

**Server exits immediately with "No cached Google Tasks token found"**
You haven't run `npm run auth` yet, or it didn't finish. Run it before starting the server.

## Development

```bash
npm run dev     # run directly from TypeScript with auto-reload
npm run build   # type-check and compile to dist/
```

Test with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Contributing

Issues and PRs welcome. This covers the full Tasks API surface but hasn't been tested across every edge case, so if you hit a bug or want a feature, open an issue.

## License

MIT, see [LICENSE](LICENSE).
