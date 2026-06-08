# 05 — Future Steps

This document is the **work plan** for what comes after Stage 1. Each step
is concrete, owner-able, and has an exit criterion.

## Stage 2 — Passive Observability (no agent cooperation needed)

**Goal:** stop relying on `budget_record` being called by the agent.

| # | Task | Exit criterion |
|---|---|---|
| 2.1 | Add a `log-watcher` module under `src/watchers/` | Module exports `start({ source, paths, onEvent })` |
| 2.2 | Implement Claude Code watcher (parses `~/.claude/projects/<hash>/*.jsonl`) | Replays a real session and produces correct events |
| 2.3 | Implement VS Code Copilot Chat watcher (parses `%APPDATA%/Code/User/workspaceStorage/<id>/GitHub.copilot-chat/debug-logs/*`) | At least token-count fields extracted on a current build |
| 2.4 | Add `chokidar` dependency for cross-platform file tailing | `npm run watch:claude` tails live |
| 2.5 | Add `mcp-token-tracker watch --source <s>` CLI subcommand | Runs in foreground; logs new events |
| 2.6 | Add an `events.source` distinction in `budget_status` output so users see which counts are exact vs estimated | Status shows `by_source` block |

## Stage 3 — Always-on Daemon + VS Code Extension

**Goal:** "It just works" from boot.

| # | Task | Exit criterion |
|---|---|---|
| 3.1 | Convert watcher into a singleton daemon (`mcp-token-tracker daemon`) | Auto-starts on user login (launchd / systemd / Task Scheduler) |
| 3.2 | Add Unix-socket / named-pipe IPC between MCP server processes and daemon | Eliminates duplicate DB handles |
| 3.3 | Build `vscode-token-tracker` companion extension (status bar item, native notification at warn threshold) | Publishable to Marketplace |
| 3.4 | Add `tray` icon (optional) for daemon control on macOS/Windows | Right-click → quit/status |

## Stage 4 — Attribution & Forecasting

**Goal:** answer "where did the spend go?"

| # | Task | Exit criterion |
|---|---|---|
| 4.1 | Add `git_commit_sha` + `branch` to events | Recorded automatically when workspace is a git repo |
| 4.2 | Add `budget_attribution` tool (group spend by branch, file pattern, time-of-day) | Returns top spenders |
| 4.3 | Improve `budget_forecast` using historical task→cost regression on per-user data | Within ±25% on tasks of similar shape |
| 4.4 | Multi-machine sync via user-chosen backend (git repo, S3, Dropbox folder) | Opt-in; off by default |

## Stage 5 — Provider Billing Reconciliation

**Goal:** ground-truth correction.

| # | Task | Exit criterion |
|---|---|---|
| 5.1 | OpenAI billing API import (`mcp-token-tracker import openai --key …`) | Reconciles last 30 days within 2¢ |
| 5.2 | Anthropic usage API import | Same |
| 5.3 | GitHub Copilot premium-request quota import | Tracks remaining requests, not just $ |
| 5.4 | Drift report: estimated vs billed | Surfaces miscalibrated bundled prices |

## Stage 6 — Community Pricing Registry

**Goal:** keep prices accurate without code changes.

| # | Task | Exit criterion |
|---|---|---|
| 6.1 | Publish `mcp-token-tracker/pricing-registry` GitHub repo with `models.json` | Updated weekly |
| 6.2 | `mcp-token-tracker pricing refresh` fetches and writes to `pricing-cache.json` | Signed via GitHub commit SHA |
| 6.3 | PR template for contributors to update prices when providers change | Verified by CI fixture |

## Immediate next actions (this week)

1. **Run the smoke test on the maintainer's machine** to confirm Stage 1
   works end-to-end on Windows.
2. **Wire it into the maintainer's own Copilot Chat** and observe whether
   the agent obeys the instruction template.
3. **Create the public GitHub repo**, transfer files, enable Issues.
4. **Open Stage 2 as a tracking issue** referencing 2.1 – 2.6 above.

## Open design questions

- Should `budget_check` *block* when in `breach` + `hard_stop`, or only
  return a strong recommendation? (Current Stage 1: recommendation only.)
- Should event aggregation expose a `cost_center` field for enterprise
  chargeback before Stage 4? (Probably yes — cheap to add now.)
- Should the HTTP server stay on a fixed port (47821) or auto-discover?
  Fixed simplifies the future VS Code extension; conflicts are rare.
