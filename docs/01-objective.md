# 01 — Objective

## The problem

Every developer who uses AI coding tools in 2026 is using **more than one**:

- GitHub Copilot Chat in VS Code (premium-request quotas).
- Claude Code from a terminal (Anthropic credits).
- A custom agent built on the OpenAI/Anthropic API (BYO key, raw $/token).
- Possibly Cursor, Cline, Aider, or a homegrown CLI on top.

Each of those tools reports its **own** usage in its **own** dashboard,
**after** the spend has happened. Nobody — not the developer, not their team
lead, not finance — knows the **aggregate** number until the credit-card
statement arrives.

Inside the IDE, the situation is worse. The agent itself has no idea how
much you have already spent today, this week, or this month. So it will
happily pick the most expensive model for a trivial rename, or run a 40-turn
plan-and-edit loop on Opus when Haiku would have been fine.

## The objective

Build a **local-first**, **agent-agnostic** MCP server that:

1. Maintains a single source of truth for token usage across every AI tool
   on the developer's machine.
2. Exposes that state back to the agent via MCP tools so the agent can
   **proactively** warn the user and **suggest a cheaper model** before
   burning the next dollar.
3. Requires zero accounts, zero telemetry, and zero external services.
4. Is "drop-in" — once installed, agents that read standard instruction
   files (`copilot-instructions.md`, `CLAUDE.md`, `AGENTS.md`) will start
   calling it without further user effort.

## Who this is for

| Audience | Primary benefit |
|---|---|
| Solo developers on paid plans | Stop end-of-month surprises |
| Engineering managers | First real visibility into per-repo AI spend |
| Enterprises using BYO keys | Cost attribution per workspace / cost center |
| OSS maintainers running experiments | Don't burn Anthropic credits before a release |
| Multi-tool power users | One status line across Copilot + Claude Code + CLI |

## Non-objectives

- **Not** a replacement for the provider's official billing dashboard.
- **Not** a security/secrets scanner.
- **Not** an SaaS — there is no cloud component, ever, by design.
- **Not** a prompt logger; we only count tokens, never store content.

## Success criteria for Stage 1

A user can:

1. `npm install && npm run smoke` — see a working budget evaluation in <30s.
2. Run `mcp-token-tracker install --target all` and have the server
   registered with VS Code and Claude Code.
3. Open VS Code Copilot Chat in a workspace that has a
   `copilot-instructions.md` referencing the tool — and observe the agent
   calling `budget_check` at session start.
4. `mcp-token-tracker status` returns a coherent report including
   per-model breakdown for the current month.
