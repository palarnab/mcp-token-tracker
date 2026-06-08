# 11 — Pricing Engine

## Where prices come from

The bundled catalog at [data/models.json](../data/models.json) holds public
list prices as of the date in its `_meta.updated` field. All prices are
USD per **million** tokens.

Each entry has three fields:

```json
{
  "input_per_mtok":        15.0,   // standard input
  "output_per_mtok":       75.0,   // completion
  "cached_input_per_mtok":  1.5    // prompt-caching discount tier
}
```

If a provider charges a flat rate for input regardless of cache state,
omit `cached_input_per_mtok`; the engine will fall back to
`input_per_mtok`.

## Cost computation

For an event with `input_tokens`, `output_tokens`, `cached_tokens`:

```
billed_input = max(0, input_tokens - cached_tokens)

cost = (billed_input  / 1e6) * input_per_mtok
     + (cached_tokens / 1e6) * cached_input_per_mtok
     + (output_tokens / 1e6) * output_per_mtok
```

This is performed in `src/core/pricing.js::computeCostUsd`.

## Model name resolution

The pricing lookup is two-pass:

1. **Exact match** on the canonical model name.
2. **Longest-prefix alias** from the `aliases` map.

If neither matches, cost is `0` and the result is flagged
`pricing_unknown: true`. The MCP tool surfaces this so the agent can warn
the user and prompt them to add the model.

## Overriding prices locally

Drop a JSON file with the same shape at `~/.llm-budget/pricing-cache.json`.
If its `mtime` is newer than the bundled file, it wins. Useful for:

- Custom enterprise rates (negotiated discounts).
- New models that ship between releases.
- A/B testing pricing assumptions.

Schema is identical to `data/models.json`. The engine validates only the
fields it uses; extra fields are ignored.

## Updating the bundled catalog

For Stage 1, edit `data/models.json` and bump `_meta.updated`. Stage 6 will
replace this with a community registry refresh command.

## Known limitations

- Some providers price differently for the **same** model based on
  deployment (e.g. Azure OpenAI vs OpenAI direct). Stage 1 collapses these
  into one entry. If you need separation, add per-deployment aliases like
  `gpt-5-azure-eastus`.
- Image / audio / tool-use token surcharges are not modeled. Add to
  Stage 5 along with billing reconciliation.
- GitHub Copilot's "premium request" model uses a non-token quota.
  Stage 2 will add a parallel events table for request-count tracking.

## Adding a new model

1. Edit `data/models.json`.
2. Add the canonical entry under `models`.
3. (Optional) add a shorter alias under `aliases`.
4. Bump `_meta.updated`.
5. Run `npm run smoke` to confirm parsing.
6. Open a PR — include a link to the provider's pricing page.

## Cheaper-alternative selection

`cheaperAlternatives(model)` ranks the catalog by average of
`(input_per_mtok + output_per_mtok) / 2` and returns the top 3 entries
whose average is **strictly less** than the target's. This is a
deliberately simple heuristic. Stage 4 will refine it using historical
task→cost data so the suggestions reflect the user's actual workload mix.
