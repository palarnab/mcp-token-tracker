# mcp-token-tracker

> A local-first MCP server that tracks LLM token usage and cost **across every
> AI coding tool you use** — VS Code Copilot Chat, Claude Code, Cursor, Cline,
> custom agents — and warns the agent (and you) when you are about to blow
> your budget so it can suggest a cheaper model.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stage](https://img.shields.io/badge/stage-1%20MVP-blue)](docs/12-roadmap.md)
[![Node](https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen)](https://nodejs.org/)

---

## Why this exists

Today, nobody knows their **total** AI spend. Copilot Chat has its own quota,
Claude Code burns Anthropic credits, your CLI agent uses a third key. Each
tool reports its own usage in its own dashboard (if any). At the end of the
month you get a surprise bill.

`mcp-token-tracker` is a single local store every agent reports into via the
[Model Context Protocol](https://modelcontextprotocol.io/). It then exposes
that aggregated state back to the agent so the agent can:

- Tell you "you've used 82% of your monthly budget, consider switching to a
  cheaper model for routine edits".
- Forecast whether a planned task will breach your budget *before* it runs.
- Surface a status line / HTTP endpoint a companion extension can render.

Data stays on your machine. No telemetry. No accounts.

## What this repo contains (Stage 1)

- **MCP stdio server** with four tools:
  `budget_check`, `budget_record`, `budget_status`, `budget_set_limit`.
- **SQLite store** at `~/.llm-budget/usage.sqlite` (cross-platform).
- **Express HTTP status server** for quick inspection / future VS Code extension.
- **CLI** (`mcp-token-tracker`) with `install`, `status`, `reset`, `serve` commands.
- **Bundled pricing** for ~15 popular models in [data/models.json](data/models.json).

Future stages (log scraping, daemon mode, VS Code extension) are described in
[docs/12-roadmap.md](docs/12-roadmap.md).

## Quick start

```powershell
# 1. install
cd mcp-token-tracker
npm install

# 2. smoke test (creates ~/.llm-budget, runs an in-process check)
npm run smoke

# 3. set a monthly budget
node bin/mcp-token-tracker.js set-limit --scope monthly --usd 50

# 4. see current status
node bin/mcp-token-tracker.js status

# 5. register with VS Code (writes to .vscode/mcp.json in current workspace)
node bin/mcp-token-tracker.js install --target vscode-workspace

# 6. register with Claude Code (writes ~/.claude/mcp_servers.json entry)
node bin/mcp-token-tracker.js install --target claude-code
```

Once installed, the agent will see the `budget_*` tools. Drop the snippet
from [docs/10-hooking-into-hosts.md](docs/10-hooking-into-hosts.md) into your
`copilot-instructions.md` / `CLAUDE.md` / `AGENTS.md` to make the agent
**automatically** check the budget at session start.

## Documentation

| # | Document | What's in it |
|---|---|---|
| 00 | [README.md](README.md) | This file |
| 01 | [docs/01-objective.md](docs/01-objective.md) | Why the project exists, who it's for |
| 02 | [docs/02-scope.md](docs/02-scope.md) | What's in / out of Stage 1 |
| 03 | [docs/03-technology.md](docs/03-technology.md) | Stack, dependencies, why each was chosen |
| 04 | [docs/04-architecture.md](docs/04-architecture.md) | Process model, diagrams, data flow |
| 05 | [docs/05-future-steps.md](docs/05-future-steps.md) | Concrete next implementation milestones |
| 06 | [docs/06-data-model.md](docs/06-data-model.md) | SQLite schema, file layout |
| 07 | [docs/07-mcp-tools.md](docs/07-mcp-tools.md) | Tool contracts (input/output schemas) |
| 08 | [docs/08-installation.md](docs/08-installation.md) | Detailed install / uninstall |
| 09 | [docs/09-privacy-security.md](docs/09-privacy-security.md) | What is stored, what is not |
| 10 | [docs/10-hooking-into-hosts.md](docs/10-hooking-into-hosts.md) | Copilot Chat / Claude Code / Cursor hooks |
| 11 | [docs/11-pricing-engine.md](docs/11-pricing-engine.md) | How costs are computed, updating prices |
| 12 | [docs/12-roadmap.md](docs/12-roadmap.md) | Staged delivery plan |
| 13 | [docs/13-contributing.md](docs/13-contributing.md) | How to contribute |
| 14 | [docs/14-faq.md](docs/14-faq.md) | Common questions |

## Status

Stage 1 MVP — usable today for **self-reported** token tracking (the agent
calls `budget_record` after each turn). Passive log scraping (no agent
cooperation required) lands in Stage 2.

## License

MIT — see [LICENSE](LICENSE).
