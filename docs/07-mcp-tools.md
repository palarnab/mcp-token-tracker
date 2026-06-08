# 07 — MCP Tools

The server exposes six tools and one resource. All responses are JSON
serialized into a single `text` content block (per MCP convention).

## `budget_check`

Check current spend against the configured budget for a scope.

**Input**

```json
{
  "scope":     "monthly",          // optional, default "monthly"
  "workspace": "C:\\path\\to\\repo", // optional
  "model":     "claude-opus-4"      // optional, enables tailored alternatives
}
```

Valid scopes: `daily`, `monthly`, `rolling-24h`, `rolling-30d`, `global`,
or any custom string you've set a budget for.

**Output**

```json
{
  "evaluation": {
    "scope": "monthly",
    "limit_usd": 50,
    "used_usd": 41.23,
    "remaining_usd": 8.77,
    "used_pct": 82.5,
    "warn_at_pct": 80,
    "status": "warn",
    "events": 312
  },
  "recommendation": {
    "headline": "Budget WARNING: 82.5% of monthly budget consumed.",
    "detail":   "Budget WARNING: ... Consider a cheaper model for routine work: claude-haiku-4, gpt-5-mini.",
    "alternative_models": [
      { "name": "claude-haiku-4", "input_per_mtok": 0.8, "output_per_mtok": 4.0 },
      { "name": "gpt-5-mini",     "input_per_mtok": 0.5, "output_per_mtok": 2.0 }
    ]
  }
}
```

**When to call**: at session start, before any expensive multi-turn plan,
and whenever the user asks "how much have I spent?".

---

## `budget_record`

Record one turn's token usage.

**Input**

```json
{
  "model":         "claude-opus-4",  // required
  "input_tokens":  12000,            // required
  "output_tokens": 3500,             // required
  "cached_tokens": 8000,             // optional
  "source":        "self-report",    // optional, defaults to "self-report"
  "workspace":     "C:\\repo",       // optional
  "session_id":    "abc-123",        // optional
  "confidence":    "exact"           // optional, one of: exact|logged|estimated
}
```

**Output**

```json
{
  "recorded": true,
  "id": 42,
  "cost_usd": 0.3025,
  "pricing_matched": "claude-opus-4",
  "pricing_unknown": false
}
```

**When to call**: after each completed agent turn. If the host doesn't
expose exact counts, the agent may estimate with `tiktoken` and set
`confidence: "estimated"`.

---

## `budget_status`

Full snapshot across all configured scopes plus per-model totals for the
current month.

**Input**: `{ "workspace": "..." }` (optional)

**Output**

```json
{
  "generated_at": "2026-06-08T10:30:00.000Z",
  "scopes": [
    { "scope": "monthly", "status": "warn", "used_usd": 41.23, ... },
    { "scope": "daily",   "status": "ok",   "used_usd": 0.42,  ... }
  ],
  "by_model_this_month": [
    { "model": "claude-opus-4", "cost_usd": 28.4, "events": 91, ... },
    { "model": "gpt-5-mini",    "cost_usd": 4.1,  "events": 220, ... }
  ]
}
```

---

## `budget_set_limit`

Create or update a budget rule.

**Input**

```json
{
  "scope":       "monthly",   // required
  "limit_usd":   50,          // required
  "warn_at_pct": 80,          // optional, default 80
  "hard_stop":   false        // optional, default false
}
```

**Output**: `{ "ok": true, "scope": "monthly", "limit_usd": 50 }`

---

## `budget_forecast`

Estimate the cost of a planned operation before launching it.

**Input**

```json
{
  "model":         "claude-opus-4",
  "input_tokens":  120000,
  "output_tokens": 8000
}
```

**Output**

```json
{
  "model": "claude-opus-4",
  "pricing": { "input_per_mtok": 15, "output_per_mtok": 75, "matched": "claude-opus-4" },
  "estimated_cost_usd": 2.4
}
```

---

## `budget_list_models`

Enumerate models known to the pricing catalog.

**Input**: `{}`

**Output**

```json
{
  "models": [
    { "name": "claude-opus-4", "input_per_mtok": 15, "output_per_mtok": 75, "cached_input_per_mtok": 1.5 },
    ...
  ]
}
```

---

## Resource: `budget://status`

Hosts that support `resources/read` can read this URI to obtain the same
JSON as `budget_status`. Useful for surfaces that prefer resources over
tool calls (e.g. a side panel that re-reads on focus).

## Error handling

Errors are returned with `isError: true` and a human-readable `text`
block. Common error messages:

| Message | Cause |
|---|---|
| `model is required` | `budget_record` called without `model` |
| `Unknown scope: <s>` | (Future) once strict scope validation lands |
| `pricing_unknown: true` (not an error, a flag) | Model not in catalog; cost recorded as 0 |
