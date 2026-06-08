import { sumUsage, getBudget, listBudgets, usageByModel } from './store.js';
import { cheaperAlternatives, priceForModel } from './pricing.js';

const DAY_MS   = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function startOfDayMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonthMs(now = Date.now()) {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function evaluateScope(scope, { workspace } = {}) {
  const budget = getBudget(scope);
  let sinceMs;
  switch (scope) {
    case 'daily':   sinceMs = startOfDayMs(); break;
    case 'monthly': sinceMs = startOfMonthMs(); break;
    case 'rolling-24h': sinceMs = Date.now() - DAY_MS; break;
    case 'rolling-30d': sinceMs = Date.now() - MONTH_MS; break;
    case 'global':  sinceMs = 0; break;
    default:
      if (scope?.startsWith('workspace:')) {
        sinceMs = startOfMonthMs();
      } else {
        sinceMs = startOfMonthMs();
      }
  }
  const usage = sumUsage({ sinceMs, workspace });
  const limit = budget?.limit_usd ?? null;
  const used  = usage.cost_usd;
  const usedPct = limit ? Math.round((used / limit) * 1000) / 10 : null;
  const remaining = limit != null ? Math.max(0, limit - used) : null;
  const warnAt = budget?.warn_at_pct ?? 80;

  let status = 'unconfigured';
  if (limit != null) {
    if (used >= limit) status = 'breach';
    else if (usedPct >= warnAt) status = 'warn';
    else status = 'ok';
  }

  return {
    scope,
    sinceMs,
    limit_usd: limit,
    used_usd: round(used, 4),
    remaining_usd: remaining != null ? round(remaining, 4) : null,
    used_pct: usedPct,
    warn_at_pct: warnAt,
    hard_stop: !!budget?.hard_stop,
    status,
    events: usage.events,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  };
}

export function recommendationFor(evaluation, { model } = {}) {
  const lines = [];
  const alternatives = model ? cheaperAlternatives(model) : [];

  switch (evaluation.status) {
    case 'unconfigured':
      lines.push(`No budget set for scope "${evaluation.scope}". Run: mcp-token-tracker set-limit --scope ${evaluation.scope} --usd <amount>`);
      break;
    case 'ok':
      lines.push(`Budget OK: $${evaluation.used_usd.toFixed(2)} of $${evaluation.limit_usd.toFixed(2)} (${evaluation.used_pct}%) used in scope "${evaluation.scope}".`);
      break;
    case 'warn':
      lines.push(`Budget WARNING: ${evaluation.used_pct}% of "${evaluation.scope}" budget consumed ($${evaluation.used_usd.toFixed(2)} / $${evaluation.limit_usd.toFixed(2)}).`);
      if (alternatives.length) {
        lines.push(`Consider a cheaper model for routine work: ${alternatives.map(a => a.name).join(', ')}.`);
      }
      break;
    case 'breach':
      lines.push(`Budget BREACHED: $${evaluation.used_usd.toFixed(2)} of $${evaluation.limit_usd.toFixed(2)} used in scope "${evaluation.scope}".`);
      if (evaluation.hard_stop) {
        lines.push(`Hard-stop is enabled — agent should refuse premium models until budget resets or user raises the limit.`);
      }
      if (alternatives.length) {
        lines.push(`Switch to one of: ${alternatives.map(a => a.name).join(', ')}.`);
      }
      break;
  }

  return {
    headline: lines[0],
    detail: lines.join(' '),
    alternative_models: alternatives,
  };
}

export function fullStatus({ workspace } = {}) {
  const scopes = listBudgets().map(b => b.scope);
  const seen = new Set(scopes);
  for (const s of ['daily', 'monthly']) if (!seen.has(s)) scopes.push(s);
  const evaluations = scopes.map(s => evaluateScope(s, { workspace }));
  const byModel = usageByModel({ sinceMs: startOfMonthMs() });
  return {
    generated_at: new Date().toISOString(),
    scopes: evaluations,
    by_model_this_month: byModel.map(r => ({
      ...r,
      cost_usd: round(r.cost_usd, 4),
    })),
  };
}

export function forecastCost(model, { input_tokens = 0, output_tokens = 0 } = {}) {
  // very simple heuristic for stage 1
  const p = priceForModel(model);
  const M = 1_000_000;
  const cost = (input_tokens * p.input_per_mtok + output_tokens * p.output_per_mtok) / M;
  return { model, pricing: p, estimated_cost_usd: round(cost, 6) };
}

function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
