# 13 — Contributing

Thanks for considering a contribution. This document tells you how to set
up, where to make changes, and how to get them merged.

## Setup

```powershell
git clone <repo>
cd mcp-token-tracker
npm install
npm run smoke    # confirms your environment works
```

## Branching & commits

- `main` is always shippable.
- Branch from `main` as `feat/<thing>`, `fix/<thing>`, or `docs/<thing>`.
- Conventional commit prefixes preferred (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`). Not enforced by hook.
- One logical change per PR.

## Where to make changes

| Want to … | Edit … |
|---|---|
| Add a pricing entry | [data/models.json](../data/models.json) |
| Add an MCP tool | [src/mcp/server.js](../src/mcp/server.js) and document in [07-mcp-tools.md](07-mcp-tools.md) |
| Add a budget scope or recommendation rule | [src/core/budget.js](../src/core/budget.js) |
| Add an HTTP endpoint | [src/http/server.js](../src/http/server.js) |
| Add a CLI subcommand | [bin/mcp-token-tracker.js](../bin/mcp-token-tracker.js) |
| Track a new event source | (Stage 2) `src/watchers/` |

## Coding rules

- ESM only, named exports.
- No new runtime dependencies without justification in the PR description.
- Keep `core/` free of MCP/HTTP coupling.
- All writes to `~/.llm-budget/` must go through `src/core/store.js`.
- Stdout in `src/mcp/server.js` is **reserved** for MCP framing. Log to
  stderr only.
- Don't add features that require network calls in Stage 1.

## Tests

Stage 1 uses `node --test`. Place tests under `test/` mirroring the
source layout. A test must:

- Set `LLM_BUDGET_HOME` to a temp dir.
- Use only `core/` modules where possible.
- Clean up after itself.

Run all tests: `npm test`.

## Documentation

If your change is user-visible:

- Update the relevant `docs/*.md`.
- Update the README "What this repo contains" section if a feature
  appeared or disappeared.
- Update `docs/12-roadmap.md` if you closed a roadmap item.

## Privacy review

Any change that stores new fields, opens a network port, or reads files
outside `~/.llm-budget/` and `data/` requires an explicit note in the PR
explaining the impact, and updates to
[09-privacy-security.md](09-privacy-security.md).

## License of contributions

By submitting a PR, you agree your contribution is MIT-licensed under
[LICENSE](../LICENSE).

## Code of conduct

Be kind. Disagree about code, not about people. Maintainers reserve the
right to lock or remove discussions that get unproductive.
