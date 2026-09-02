# Contributing

Thanks for considering a contribution.

## Setup

```bash
git clone https://github.com/girmmy/google-tasks-mcp-server.git
cd google-tasks-mcp-server
npm install
npm run build
```

You'll need your own Google OAuth client to test against a real account — see the README's Setup section.

## Making changes

- Keep tool schemas in `src/schemas/schemas.ts` using Zod `.strict()` objects (no `.refine()` at the top level — the MCP SDK needs direct access to `.shape`, so put cross-field validation in the tool handler instead).
- Run `npm run build` before opening a PR — it type-checks and compiles.
- Test against a real Google account with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector): `npx @modelcontextprotocol/inspector node dist/index.js`.
- Keep responses supporting both `markdown` and `json` `response_format` — see `src/format.ts` for the shared helpers.

## Reporting bugs / requesting features

Open an issue with as much detail as you can — Node version, OS, and the exact error/output if applicable.
