import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pricingCachePath } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED = path.resolve(__dirname, '..', '..', 'data', 'models.json');

let _catalog = null;

export function loadCatalog() {
  if (_catalog) return _catalog;
  // Prefer user cache if present and newer than bundled
  const cache = pricingCachePath();
  let source = BUNDLED;
  if (fs.existsSync(cache)) {
    try {
      const cStat = fs.statSync(cache);
      const bStat = fs.statSync(BUNDLED);
      if (cStat.mtimeMs >= bStat.mtimeMs) source = cache;
    } catch { /* ignore */ }
  }
  _catalog = JSON.parse(fs.readFileSync(source, 'utf8'));
  return _catalog;
}

// Returns { input_per_mtok, output_per_mtok, cached_input_per_mtok } in USD.
// Falls back to a heuristic if the exact model is unknown.
export function priceForModel(model) {
  const cat = loadCatalog();
  const direct = cat.models[model];
  if (direct) return { ...direct, matched: model };

  // Family fallback: longest prefix match in 'aliases'
  const aliases = cat.aliases || {};
  const keys = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model.startsWith(k)) {
      const fam = aliases[k];
      const p = cat.models[fam];
      if (p) return { ...p, matched: fam, viaAlias: k };
    }
  }
  // Unknown -> 0 cost, mark unknown so caller can warn
  return {
    input_per_mtok: 0,
    output_per_mtok: 0,
    cached_input_per_mtok: 0,
    matched: null,
    unknown: true,
  };
}

export function computeCostUsd(model, { input_tokens = 0, output_tokens = 0, cached_tokens = 0 } = {}) {
  const p = priceForModel(model);
  const M = 1_000_000;
  const billedInput = Math.max(0, input_tokens - cached_tokens);
  const cost =
      (billedInput   * (p.input_per_mtok        ?? 0)) / M
    + (cached_tokens * (p.cached_input_per_mtok ?? p.input_per_mtok ?? 0)) / M
    + (output_tokens * (p.output_per_mtok       ?? 0)) / M;
  return { cost_usd: cost, pricing: p };
}

export function listModels() {
  const cat = loadCatalog();
  return Object.entries(cat.models).map(([name, p]) => ({ name, ...p }));
}

export function cheaperAlternatives(model, { limit = 3 } = {}) {
  const cat = loadCatalog();
  const target = priceForModel(model);
  if (target.unknown) return [];
  const baseline = (target.input_per_mtok + target.output_per_mtok) / 2;
  return Object.entries(cat.models)
    .map(([name, p]) => ({ name, ...p, avg: (p.input_per_mtok + p.output_per_mtok) / 2 }))
    .filter(m => m.avg > 0 && m.avg < baseline && m.name !== (target.matched ?? model))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, limit)
    .map(({ avg, ...rest }) => rest);
}
