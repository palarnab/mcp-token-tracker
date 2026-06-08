# 10 — Hooking into Hosts

MCP makes tools **available**. It does not make agents **call** them. To
get the "it just works" behavior, drop a short instruction into the file
the host already reads at session start.

The snippets below are intentionally short. Long instructions get ignored
or summarized.

---

## VS Code Copilot Chat — `.github/copilot-instructions.md`

Create or append to `.github/copilot-instructions.md` in your repo:

```markdown
## LLM budget tracking

This workspace exposes an MCP server called `token-tracker`. Always:

1. At the start of every session, call `budget_check` with the model you
   are about to use. If the response status is `warn` or `breach`, surface
   the recommendation to the user before starting work, and prefer one of
   the suggested cheaper models when the task is routine.
2. After each completed turn, call `budget_record` with the model name
   and token counts for that turn. Set `confidence: "estimated"` if you
   are not certain of exact counts.
3. Before launching multi-turn refactors or batch operations, call
   `budget_forecast` and inform the user of the estimate.
```

---

## Claude Code — `CLAUDE.md`

Place at repo root:

```markdown
## Budget hook

Before doing any work, call the MCP tool `budget_check` (scope: monthly).
After each turn, call `budget_record` with the model and token counts
you used. If `budget_check` returns status `warn` or `breach`, tell the
user and offer to switch to one of the `alternative_models` returned.
```

---

## Generic agents — `AGENTS.md`

Place at repo root:

```markdown
# Agent instructions

## Budget awareness

Use the MCP tools exposed by `token-tracker`:

- `budget_check` — call at session start.
- `budget_record` — call after each turn with `model`, `input_tokens`,
  `output_tokens` (and `cached_tokens` if available).
- `budget_forecast` — call before launching long-running operations.

If a budget is in `warn` or `breach` state, surface the recommendation to
the user before continuing.
```

---

## Cursor — `.cursor/rules/budget.mdc`

```markdown
---
description: Track LLM spend via the token-tracker MCP server.
---

Always start by calling `budget_check`. After each turn, call
`budget_record` with model + token counts. When in `warn` or `breach`
state, recommend a cheaper model from `alternative_models`.
```

---

## Why this works (and its limits)

- Modern coding agents are reliably good at reading these files and using
  small tool sets that are clearly described.
- They are **not** perfect — sometimes the agent will forget to call
  `budget_record`. Stage 2's passive log scraper is the safety net for
  this case.
- Recommendations are advisory. The agent decides whether to surface
  them; the user decides whether to act. Stage 3's companion VS Code
  extension will show a status-bar item independent of the agent.

## Verifying the hook is firing

1. Reset the store: `mcp-token-tracker reset --yes`.
2. Set a tiny budget: `mcp-token-tracker set-limit --scope monthly --usd 0.01`.
3. Open a fresh chat session and ask the agent to do something small.
4. Run `mcp-token-tracker status` — you should see at least one event
   recorded and the monthly scope in `breach`.

If you see zero events, the agent isn't reading your instruction file.
Check filename, location, and (for Copilot) that the file is committed
or recognized as a workspace instructions file.
