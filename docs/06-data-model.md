# 06 — Data Model

## On-disk layout

```
~/.llm-budget/                      # %USERPROFILE%\.llm-budget on Windows
├── usage.sqlite                    # primary store (WAL mode)
├── usage.sqlite-shm                # SQLite shared memory (auto-managed)
├── usage.sqlite-wal                # SQLite write-ahead log (auto-managed)
├── pricing-cache.json              # optional override of bundled prices
├── config.json                     # reserved (Stage 2)
└── logs/                           # daemon logs (Stage 3+)
```

The directory location can be overridden by exporting
`LLM_BUDGET_HOME=/some/path` before launching the server (useful in CI).

## SQLite schema (Stage 1)

```sql
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,           -- unix epoch ms
  source          TEXT    NOT NULL,           -- 'copilot-chat'|'claude-code'|'self-report'|'billing-api'|'smoke-test'
  workspace       TEXT,                       -- absolute path or hash (nullable)
  session_id      TEXT,                       -- agent-supplied if available
  model           TEXT    NOT NULL,           -- raw model name as reported
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cached_tokens   INTEGER NOT NULL DEFAULT 0, -- of the input_tokens, how many were cache-hit
  cost_usd        REAL    NOT NULL DEFAULT 0, -- computed at insert time from pricing catalog
  confidence      TEXT    NOT NULL DEFAULT 'estimated',  -- 'exact'|'logged'|'estimated'
  metadata        TEXT                        -- JSON blob, agent-defined extras
);

CREATE INDEX idx_events_ts        ON events(ts);
CREATE INDEX idx_events_workspace ON events(workspace, ts);
CREATE INDEX idx_events_model     ON events(model, ts);

CREATE TABLE budgets (
  scope        TEXT PRIMARY KEY,              -- 'daily'|'monthly'|'rolling-24h'|'rolling-30d'|'global'|'workspace:<hash>'
  limit_usd    REAL NOT NULL,
  warn_at_pct  INTEGER NOT NULL DEFAULT 80,
  hard_stop    INTEGER NOT NULL DEFAULT 0,    -- 0/1 boolean
  updated_at   INTEGER NOT NULL
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## What we **do** store

- Model name (e.g. `claude-opus-4`).
- Token counts (input, output, cached).
- Computed USD cost.
- Coarse provenance: which tool reported it, optional workspace path,
  optional session id.
- Timestamps in UTC ms.

## What we **never** store (Stage 1)

- Prompt text.
- Response text.
- File contents.
- API keys.
- User identifiers beyond what the agent voluntarily passes.

If a future contribution wants to record richer context, it must go behind
an explicit user-opt-in flag in `config.json`. See
[09-privacy-security.md](09-privacy-security.md).

## Common queries

```sql
-- Spend this month
SELECT SUM(cost_usd) FROM events
WHERE ts >= strftime('%s','now','start of month') * 1000;

-- Top 5 models by spend in last 7 days
SELECT model, SUM(cost_usd) AS spend, COUNT(*) AS turns
FROM events
WHERE ts >= (strftime('%s','now') - 7*86400) * 1000
GROUP BY model
ORDER BY spend DESC
LIMIT 5;

-- Spend per workspace, current month
SELECT workspace, SUM(cost_usd) AS spend
FROM events
WHERE ts >= strftime('%s','now','start of month') * 1000
GROUP BY workspace
ORDER BY spend DESC;
```

## Pricing catalog format (`data/models.json`)

```json
{
  "_meta": { "currency": "USD", "unit": "per_million_tokens", "updated": "2026-06-01" },
  "models": {
    "claude-opus-4": {
      "input_per_mtok": 15.0,
      "output_per_mtok": 75.0,
      "cached_input_per_mtok": 1.5
    },
    ...
  },
  "aliases": {
    "claude-opus": "claude-opus-4",
    ...
  }
}
```

- Exact-match lookup first, then longest-prefix alias.
- Unknown model → cost recorded as `0` and response includes
  `pricing_unknown: true`. The agent should warn the user so they can
  either contribute the missing entry or set a pricing override.

## Cost formula

```
billed_input  = max(0, input_tokens - cached_tokens)
cost = (billed_input  * input_per_mtok        ) / 1_000_000
     + (cached_tokens * cached_input_per_mtok ) / 1_000_000
     + (output_tokens * output_per_mtok       ) / 1_000_000
```

If `cached_input_per_mtok` is not defined for a model, the full input
price is applied to cached tokens (conservative estimate).
