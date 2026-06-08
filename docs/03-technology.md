# 03 — Technology

## Stack

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Runtime | Node.js | ≥ 18.17 | Largest MCP ecosystem; `fetch` built-in; works everywhere |
| Language | JavaScript (ESM) | — | Zero build step; lowest contributor friction |
| MCP framework | `@modelcontextprotocol/sdk` | ^1.0 | Reference SDK, maintained by Anthropic |
| Storage | SQLite via `better-sqlite3` | ^11 | Synchronous API, embeddable, prebuilt binaries, WAL mode |
| HTTP | `express` | ^4 | Trivial, well-known, fine for 127.0.0.1 read-only API |
| Validation | `zod` | ^3 | (Reserved for Stage 2 once we accept richer inputs) |

## Why not TypeScript (yet)?

Stage 1 prioritizes "clone → install → run" with **no build step**. Once
the API surface stabilizes (after Stage 2), the codebase will be ported to
TypeScript with `tsx`-style runtime — but that's an internal change, not a
user-visible one.

## Why SQLite (not LMDB / a flat file / JSON)?

- Survives crashes (WAL).
- Queryable from any language a future tool wants to add (Python notebook,
  Go CLI, Rust daemon).
- Indexed reads on `ts` and `workspace` keep `budget_check` cheap even at
  100k+ events.
- Embeddable — no server to install.
- `better-sqlite3` ships prebuilt binaries for Windows/macOS/Linux on x64
  and arm64, so `npm install` is single-step.

## Why Express?

The MCP server itself uses stdio, not HTTP — that is the protocol contract.
Express is used for a **separate**, optional read-only HTTP endpoint on
`127.0.0.1` so that:

- A future companion VS Code extension can poll status without speaking MCP.
- A user can `curl http://127.0.0.1:47821/status` for debugging.
- A team's internal dashboard can scrape (with the user's explicit opt-in).

The HTTP server is bound to loopback only and is **never** exposed externally.

## Dependencies (and what each does)

```
@modelcontextprotocol/sdk    # MCP server framework
better-sqlite3               # storage
express                      # local 127.0.0.1 status server
zod                          # input validation (reserved)
```

That's it. No ORM, no logger framework, no DI container. Anything beyond
this list must be justified in a PR.

## Project layout

```
mcp-token-tracker/
├── bin/
│   └── mcp-token-tracker.js   # CLI entry (install / status / serve / etc.)
├── src/
│   ├── mcp/server.js          # stdio MCP server
│   ├── http/server.js         # 127.0.0.1 Express server
│   └── core/
│       ├── paths.js           # resolve ~/.llm-budget locations
│       ├── store.js           # SQLite wrapper + schema
│       ├── pricing.js         # model catalog + cost computation
│       └── budget.js          # scope evaluation + recommendations
├── data/
│   └── models.json            # bundled pricing
├── scripts/
│   └── smoke-test.js
├── docs/                      # this folder
├── package.json
├── README.md
└── LICENSE
```

## Why this split?

- `core/` has zero MCP or HTTP coupling — it is pure data + logic, so it
  can be reused by a CLI, an extension, or a future daemon.
- `mcp/` and `http/` are thin adapters over `core/`.
- `bin/` is the user-facing entry, and the only thing that touches host
  config files (`.vscode/mcp.json`, `~/.claude/mcp_servers.json`).

## Coding conventions

- ESM only (`"type": "module"`).
- No default exports — explicit named exports make refactors safer.
- One concern per file. If a file grows past ~250 lines, split it.
- Errors thrown from `core/` bubble up; adapters translate to MCP / HTTP
  error envelopes.
