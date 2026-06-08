# 08 — Installation

## Prerequisites

- Node.js ≥ 18.17 (use `node --version` to check)
- npm ≥ 9
- Windows / macOS / Linux

## From this repo (Stage 1)

```powershell
# clone or copy the folder, then:
cd mcp-token-tracker
npm install
npm run smoke    # creates ~/.llm-budget, runs a self-test
```

If the smoke test prints `recorded id=…` lines and a `monthly evaluation`
block at the end, you're working.

## Register with a host

### VS Code Copilot Chat (workspace-level — recommended for self-testing)

```powershell
node bin/mcp-token-tracker.js install --target vscode-workspace
```

Writes `.vscode/mcp.json` in the current directory with a `token-tracker`
entry. Restart VS Code / Copilot Chat to pick it up. Verify in the Copilot
Chat tools picker that "token-tracker" is listed.

If you already have `.vscode/mcp.json`, the command merges the new entry
into the existing file.

### VS Code Copilot Chat (user-level)

```powershell
node bin/mcp-token-tracker.js install --target vscode-user
```

Prints the snippet to paste into VS Code's user `settings.json`. (User-level
auto-write isn't done for you because settings.json may contain comments
and overwrite is risky.)

### Claude Code

```powershell
node bin/mcp-token-tracker.js install --target claude-code
```

Writes `~/.claude/mcp_servers.json`.

### All at once

```powershell
node bin/mcp-token-tracker.js install --target all
```

## Configure budgets

```powershell
node bin/mcp-token-tracker.js set-limit --scope monthly --usd 50
node bin/mcp-token-tracker.js set-limit --scope daily   --usd 5
node bin/mcp-token-tracker.js status
```

## Make the agent actually use the tool

Drop the snippet from [10-hooking-into-hosts.md](10-hooking-into-hosts.md)
into your workspace's `copilot-instructions.md`, `CLAUDE.md`, or
`AGENTS.md`. Without this, the agent has tools available but won't call
them proactively.

## Optional: run the HTTP status server

```powershell
node bin/mcp-token-tracker.js http
# in another shell:
curl http://127.0.0.1:47821/status
```

## Verifying it works

1. Open a fresh agent session in VS Code Copilot Chat.
2. Ask: "What's my current LLM budget status?"
3. The agent should call `budget_check` / `budget_status` and report
   back. If it doesn't, your instruction snippet isn't being read —
   double-check the filename and location.

## Uninstall

Remove the `token-tracker` entry from:

- `.vscode/mcp.json` (workspace) or VS Code user settings.
- `~/.claude/mcp_servers.json`.

To wipe data: `node bin/mcp-token-tracker.js reset --yes`.
To wipe entirely: delete `~/.llm-budget/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: Could not locate the bindings file` (better-sqlite3) | `npm rebuild better-sqlite3` |
| Agent doesn't list the tool | Check host's MCP log; verify the path in `mcp.json` is absolute |
| `EACCES` writing `.llm-budget` | Set `LLM_BUDGET_HOME` to a writable path |
| HTTP port 47821 already in use | `set LLM_BUDGET_HTTP_PORT=47822` before `http` command |
| Agent calls `budget_record` but `status` shows nothing | Confirm process is hitting the same store — `mcp-token-tracker paths` prints the location |
