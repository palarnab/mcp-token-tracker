# 04 — Architecture

## Process model (Stage 1)

Stage 1 has **one short-lived process per host session**. There is no
background daemon yet — that lands in Stage 3.

```mermaid
flowchart LR
    subgraph VSC["VS Code window (workspace A)"]
        CCA[Copilot Chat]
    end
    subgraph VSC2["VS Code window (workspace B)"]
        CCB[Copilot Chat]
    end
    subgraph CC["Claude Code terminal"]
        CLI[claude]
    end

    CCA -- stdio --> SrvA["mcp-token-tracker (proc A)"]
    CCB -- stdio --> SrvB["mcp-token-tracker (proc B)"]
    CLI -- stdio --> SrvC["mcp-token-tracker (proc C)"]

    SrvA --> DB[("~/.llm-budget/usage.sqlite (WAL)")]
    SrvB --> DB
    SrvC --> DB

    HTTP["mcp-token-tracker http (optional)"] --> DB
```

Three different agent hosts each spawn their own MCP server process. All
three processes read and write the **same** SQLite file. SQLite's WAL
journal mode makes concurrent reads and serialized writes safe across
processes on every supported OS.

## Module diagram

```mermaid
flowchart TB
    subgraph Adapters
        MCP[src/mcp/server.js]
        HTTP[src/http/server.js]
        CLI[bin/mcp-token-tracker.js]
    end
    subgraph Core["src/core/"]
        Budget[budget.js]
        Pricing[pricing.js]
        Store[store.js]
        Paths[paths.js]
    end
    Data[(data/models.json)]
    SQLite[(~/.llm-budget/usage.sqlite)]

    MCP --> Budget
    MCP --> Pricing
    MCP --> Store
    HTTP --> Budget
    HTTP --> Pricing
    HTTP --> Store
    CLI --> Budget
    CLI --> Pricing
    CLI --> Store
    Budget --> Store
    Budget --> Pricing
    Pricing --> Data
    Store --> Paths
    Store --> SQLite
```

The dependency graph points one way: **adapters → core → storage**. Core
has no knowledge of MCP or HTTP — it can be unit-tested in isolation.

## Lifecycle of a request

### `budget_check` (called by agent at session start)

```mermaid
sequenceDiagram
    autonumber
    participant Agent
    participant MCP as MCP server (stdio)
    participant Budget as core/budget.js
    participant Store as core/store.js
    participant SQLite

    Agent->>MCP: tools/call budget_check { scope:"monthly", model:"claude-opus-4" }
    MCP->>Budget: evaluateScope("monthly")
    Budget->>Store: sumUsage(sinceMs=startOfMonth)
    Store->>SQLite: SELECT SUM(...) WHERE ts >= ?
    SQLite-->>Store: aggregated row
    Store-->>Budget: { cost_usd, events, tokens }
    Budget->>Budget: status = ok | warn | breach
    Budget-->>MCP: evaluation
    MCP->>Budget: recommendationFor(evaluation, model)
    Budget-->>MCP: { headline, alternatives }
    MCP-->>Agent: { evaluation, recommendation } (as text content)
    Agent->>Agent: surface "Budget warning, consider claude-haiku-4..." to user
```

### `budget_record` (called after each turn)

```mermaid
sequenceDiagram
    autonumber
    participant Agent
    participant MCP as MCP server
    participant Pricing as core/pricing.js
    participant Store as core/store.js

    Agent->>MCP: tools/call budget_record { model, input_tokens, output_tokens }
    MCP->>Pricing: computeCostUsd(model, tokens)
    Pricing-->>MCP: { cost_usd, pricing.matched }
    MCP->>Store: insertEvent({ ..., cost_usd })
    Store-->>MCP: rowid
    MCP-->>Agent: { recorded:true, cost_usd, pricing_matched }
```

## Concurrency model

- SQLite is opened in **WAL mode** with `synchronous = NORMAL`. This lets
  multiple processes read freely while writes are serialized.
- Each MCP server process holds its own DB handle (`better-sqlite3` is
  synchronous, per-handle).
- No locking is done in JS — SQLite handles it.

## Data flow boundary

| Boundary | What crosses it | What does not |
|---|---|---|
| Agent ↔ MCP server | tool calls with model name + token counts | prompt text, response text |
| MCP server ↔ SQLite | aggregated counts + cost | nothing else |
| HTTP server ↔ caller | read-only status JSON | no write access without explicit POST |
| Local machine ↔ network | **nothing** in Stage 1 | — |

## Failure modes & handling

| Failure | Behavior |
|---|---|
| `~/.llm-budget` not writable | `ensureRoot()` throws on startup; CLI prints a clear error |
| SQLite file corruption | WAL recovery on open; if unrecoverable, user runs `reset --yes` |
| Unknown model name | Cost recorded as 0; response includes `pricing_unknown:true` so agent can warn the user |
| Pricing cache stale | Bundled prices used; no impact on availability |
| Two processes write at the same instant | SQLite serializes; one waits a few ms |
| Agent never calls `budget_record` | Counts go to 0; recommendation says "no usage observed — verify hook is wired" |

## Extension points (for later stages)

- `src/core/store.js` exposes `insertEvent`; a future log-watcher daemon
  can write into the same table via the same function.
- `data/models.json` is hot-reloadable; replacing `~/.llm-budget/pricing-cache.json`
  overrides bundled prices.
- New scopes can be added by extending `evaluateScope()` without touching
  the MCP tool surface.
