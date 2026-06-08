# 14 — FAQ

### Why MCP and not a VS Code extension?

Because an extension only helps VS Code users, while MCP works with VS
Code Copilot Chat, Claude Code, Cursor, Cline, and anything else that
speaks the protocol. A companion extension is planned (Stage 3) — but as
a polish layer on top of the MCP server, not a replacement.

### Does this actually stop the agent from spending money?

No, and that's intentional. The MCP server can't intercept the host's
model calls — it can only return advice that the agent then surfaces.
What it does provide is:

- A unified view of spend across every tool.
- Proactive warnings the agent passes to you.
- A `hard_stop` flag that recommends refusal of premium models.

If you want a hard kill switch, that has to live outside the agent
(provider-side rate limits, key rotation, prepaid credits).

### How accurate are the cost numbers?

Stage 1 accuracy depends on:

1. The model name reported being a known catalog entry → exact pricing.
2. The token counts reported being accurate → typically exact when the
   agent uses the host's reported counts, ±5–10% when estimated via
   client-side `tiktoken`.
3. Bundled prices matching current provider pricing → as of the
   `_meta.updated` field in `models.json`.

Stage 5 will reconcile against provider billing for ground truth.

### Will this work with GitHub Copilot Business / Enterprise?

Tokens are not a concept users see on those plans — Copilot uses a
"premium request" quota. Stage 1 will record whatever the agent reports;
Stage 2 will add a parallel request-count tracker tied to the GitHub API.

### Does it work on Windows?

Yes. Stage 1 is primarily developed on Windows. Paths are resolved via
`os.homedir()`. The only native dep (`better-sqlite3`) ships prebuilt
Windows binaries.

### Can I use this in a Docker container?

Yes — set `LLM_BUDGET_HOME=/data/llm-budget` and mount a volume. SQLite
plays nicely with bind mounts as long as the filesystem supports flock
(ext4, xfs, btrfs, NTFS via WSL2).

### Can multiple users share the same database?

Not recommended in Stage 1. Each user should have their own
`~/.llm-budget/`. Team aggregation is a Stage 4 feature.

### What happens to the data if I uninstall?

Delete `~/.llm-budget/`. That's the entire state.

### Why is the HTTP server on port 47821?

It's a fixed, reasonably unused port. The companion VS Code extension
(Stage 3) needs a predictable target. Override with
`LLM_BUDGET_HTTP_PORT` if you need to.

### Does this send any data anywhere?

No. Zero outbound network calls in Stage 1. Stage 5 will add **opt-in**
billing-API imports that the user explicitly initiates with their own
keys.

### Can I run the MCP server and the HTTP server at the same time?

Yes. They are separate processes hitting the same SQLite store via WAL.

### How do I add a model that isn't in the catalog?

Either edit `data/models.json` and submit a PR, or drop a local override
into `~/.llm-budget/pricing-cache.json`. See
[11-pricing-engine.md](11-pricing-engine.md).

### What if the agent ignores the instruction file?

It happens. Two safety nets exist:

1. The companion VS Code extension (Stage 3) shows a status-bar warning
   independently of the agent.
2. The passive log scraper (Stage 2) records usage even when the agent
   doesn't call `budget_record`.

Until those land, use the CLI: `mcp-token-tracker status` works
regardless of agent cooperation.

### How is this different from LangSmith / Helicone / Langfuse?

Those are observability platforms aimed at LLM **application developers**
— they sit between your app and the provider, requiring you to route
calls through them. This project is aimed at **end users of coding
agents**, sits on the local machine, requires no proxy, and tracks spend
across multiple unrelated tools you didn't build.
