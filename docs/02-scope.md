# 02 — Scope

This document fixes what is and is not part of **Stage 1 (MVP)**. Later
stages are described in [12-roadmap.md](12-roadmap.md).

## In scope (Stage 1)

### Functional
- MCP stdio server exposing budget tools.
- Local SQLite store at `~/.llm-budget/usage.sqlite`.
- Bundled pricing catalog for ~15 popular models
  (Claude 3.5/3.7/4, GPT-4o/5/o4, Gemini 2.5, DeepSeek V3, Qwen 3, local).
- Per-scope budget limits (`daily`, `monthly`, `rolling-24h`, `rolling-30d`,
  `global`) with warning thresholds and optional hard-stop flag.
- Self-reported event recording: the agent calls `budget_record` after each
  turn with `model`, `input_tokens`, `output_tokens`.
- Recommendation engine: returns a human-readable advisory and a sorted
  list of cheaper alternatives.
- Local HTTP server (127.0.0.1) for inspection and future companion tooling.
- CLI for install / status / set-limit / reset / serve.
- One-command host registration for **VS Code Copilot Chat** (workspace
  `.vscode/mcp.json`) and **Claude Code** (`~/.claude/mcp_servers.json`).

### Non-functional
- Cross-platform (Windows, macOS, Linux). Tested first on Windows.
- Zero external network calls at runtime.
- No data leaves `~/.llm-budget/`.
- Pure JS, no native build step beyond `better-sqlite3` (prebuilt binaries).
- Node ≥ 18.17.

## Out of scope (Stage 1)

| Feature | Why deferred | Lands in |
|---|---|---|
| Passive log scraping of Copilot Chat / Claude Code debug logs | Format unstable; needs reverse-engineering and per-host watchers | Stage 2 |
| Long-lived background daemon surviving editor restarts | Not needed for self-report mode; adds OS-specific service mgmt | Stage 3 |
| Companion VS Code extension (status bar, native notifications) | Independent release surface; can ship after MCP stabilizes | Stage 3 |
| Multi-machine sync of usage data | Privacy-sensitive; punt until users ask for it | Stage 4 |
| Pricing auto-refresh from a hosted registry | Stage 1 ships bundled prices; manual override via cache file | Stage 2 |
| GitHub Copilot "premium request" quota tracking (non-token metric) | Requires GitHub API + business plan introspection | Stage 2 |
| Cost attribution per feature/PR | Needs git-blame integration | Stage 4 |
| Web dashboard | Out of charter — local-first project | Never (community fork OK) |
| Telemetry / opt-in metrics back to maintainers | Explicit non-goal for trust reasons | Never |

## Assumptions

1. The host agent will cooperatively call `budget_check` and `budget_record`
   when instructed via `copilot-instructions.md`, `CLAUDE.md`, or `AGENTS.md`.
   Stage 2 will remove this assumption via passive log scraping.
2. The user is willing to drop a short instruction snippet into their
   workspace's agent-instructions file. A template is provided in
   [10-hooking-into-hosts.md](10-hooking-into-hosts.md).
3. Bundled prices may drift; the user accepts ±10% pricing error as a
   tradeoff for offline operation in Stage 1.

## Explicit constraints

- **Stdout discipline**: the MCP server writes only JSON-RPC frames to
  stdout. All logging goes to stderr.
- **Single writer assumption**: stage 1 uses SQLite WAL mode; concurrent
  readers/writers across processes are safe but not tuned for high volume.
- **No prompt content** ever enters the database. Counts only.
