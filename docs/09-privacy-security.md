# 09 — Privacy & Security

This project is **local-first by charter**. Trust is the entire value
proposition; if a future contribution would weaken it, that contribution
should be refused or made strictly opt-in.

## What is stored on disk

| Field | Sensitivity | Stored? |
|---|---|---|
| Model name (`claude-opus-4`) | Low | Yes |
| Token counts | Low | Yes |
| Computed USD cost | Low | Yes |
| Workspace path (absolute) | Medium — may reveal project names | Yes (nullable; agent decides whether to send) |
| Session id | Low (host-defined opaque string) | Yes (nullable) |
| Timestamps | Low | Yes |
| Prompt text | **High** | **Never** |
| Response text | **High** | **Never** |
| API keys | **Critical** | **Never** |
| User name / email | Medium | Never |

## What leaves the machine

**Nothing.** There are no outbound network calls in Stage 1.

Stage 5 introduces optional reconciliation against provider billing APIs
(OpenAI, Anthropic). That code path is opt-in, key-supplied-by-user, and
makes calls only when the user runs `mcp-token-tracker import`.

## Network exposure

- The MCP server uses **stdio**. No port is opened.
- The HTTP server binds to **127.0.0.1** only, never `0.0.0.0`.
- The HTTP server has no auth in Stage 1 because it cannot be reached
  from another machine. If you tunnel it, **add auth first**.
- No CORS is enabled. Browser-origin requests will be rejected.

## File permissions

`~/.llm-budget/` is created with default user-only permissions
(umask-respecting). No special ACLs are set; on multi-user machines,
ensure your home directory is not world-readable if you treat workspace
paths as sensitive.

## Threat model

| Threat | Severity | Mitigation |
|---|---|---|
| Malicious workspace plants `.vscode/mcp.json` pointing at a hostile binary | High | User must approve unknown MCP servers in VS Code; we recommend always reviewing `mcp.json` diffs in PRs |
| Process on the same machine reads `usage.sqlite` | Medium | Same trust boundary as your shell history; OS user perms apply |
| Prompt-injection from tool output (e.g. attacker-controlled HTTP response tricks the agent into changing budgets) | Medium | `budget_set_limit` is a write operation; users should disallow this tool in auto-approve lists when running untrusted content |
| Pricing tampering | Low | Worst case: cost estimate skewed; no security impact |
| Log scraping (Stage 2) leaks prompts | High if implemented naively | Watcher will be implemented to extract only token-count fields, never message bodies |

## Recommendations for the user

1. Treat `~/.llm-budget/` as personal data. Don't commit it. (`.gitignore`
   in this repo already excludes it for the repo dir.)
2. If you use a shared dev box, set
   `LLM_BUDGET_HOME=/per-user/path/.llm-budget`.
3. Review `.vscode/mcp.json` changes in PRs the same way you'd review
   `.npmrc` or `.envrc` — it can launch arbitrary commands.
4. Do **not** enable auto-approve for `budget_set_limit` in agent
   configurations.

## Reporting security issues

For now (Stage 1): open a GitHub issue marked `security`. Once the project
grows: a `SECURITY.md` with a private disclosure address will be added.
