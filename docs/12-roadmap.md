# 12 — Roadmap

A condensed view of where the project is heading. Detail lives in
[05-future-steps.md](05-future-steps.md).

```mermaid
gantt
    title mcp-token-tracker delivery
    dateFormat  YYYY-MM-DD
    section Stage 1 — MVP
    MCP server + SQLite + CLI         :done, s1a, 2026-06-01, 7d
    Bundled pricing + docs            :done, s1b, after s1a, 3d
    Public repo launch                :active, s1c, after s1b, 3d
    section Stage 2 — Passive obs
    Claude Code log watcher           :s2a, 2026-06-15, 10d
    Copilot debug log watcher         :s2b, after s2a, 10d
    Pricing refresh command           :s2c, after s2b, 5d
    section Stage 3 — Daemon + Extension
    Background daemon                 :s3a, 2026-07-15, 14d
    VS Code companion extension       :s3b, after s3a, 14d
    section Stage 4 — Attribution
    git/branch attribution            :s4a, 2026-08-15, 10d
    Forecast regression model         :s4b, after s4a, 10d
    Optional multi-machine sync       :s4c, after s4b, 14d
    section Stage 5 — Reconciliation
    Provider billing import           :s5,  2026-10-01, 21d
    section Stage 6 — Registry
    Community pricing registry        :s6,  2026-11-01, 21d
```

## Versioning

- **0.1.x** — Stage 1 (current). Schema may change without migration.
- **0.2.x** — Stage 2 lands. First **public** schema; migrations begin.
- **0.x → 1.0** when daemon + extension ship and three external users
  report a month of clean operation.

## Backward compatibility commitments

- After 0.2.0: any new column added to `events` must be nullable.
- After 1.0.0: MCP tool input schemas can only add optional fields, never
  remove or rename. Tool removals require a deprecation cycle.

## What we will not do

- Build a hosted dashboard or SaaS.
- Ingest prompt content even if a user requests it. Forks may.
- Add features that require an account.
- Add a billing/payment layer.

## How to influence the roadmap

- Open issues with concrete use cases (numbers help — "I spend ~$X on Y").
- Send PRs that include tests and update docs in the same change.
- For larger changes, open a discussion first; small ones can go straight
  to PR.
