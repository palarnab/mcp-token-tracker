// Stage 1 smoke test. No network. No external services.
// 1. Creates ~/.llm-budget if missing.
// 2. Writes a monthly budget.
// 3. Records two synthetic events.
// 4. Prints status + recommendation.

import { ensureRoot, dbPath } from '../src/core/paths.js';
import { setBudget, insertEvent, resetAll } from '../src/core/store.js';
import { computeCostUsd } from '../src/core/pricing.js';
import { fullStatus, evaluateScope, recommendationFor } from '../src/core/budget.js';

ensureRoot();
console.log('store:', dbPath());

// Don't clobber real user data unless explicitly requested.
if (process.argv.includes('--reset')) {
  resetAll();
  console.log('[reset] cleared store');
}

setBudget({ scope: 'monthly', limit_usd: 10, warn_at_pct: 75 });
setBudget({ scope: 'daily',   limit_usd: 1,  warn_at_pct: 80 });

const events = [
  { model: 'claude-sonnet-4', input_tokens: 12_000, output_tokens: 4_000 },
  { model: 'gpt-5-mini',      input_tokens: 30_000, output_tokens: 2_500 },
  { model: 'claude-opus-4',   input_tokens:  8_000, output_tokens: 6_000 },
];

for (const e of events) {
  const { cost_usd, pricing } = computeCostUsd(e.model, e);
  const id = insertEvent({
    ...e,
    cost_usd,
    source: 'smoke-test',
    workspace: process.cwd(),
    session_id: 'smoke',
    confidence: 'estimated',
  });
  console.log(`recorded id=${id} model=${e.model} cost=$${cost_usd.toFixed(4)} pricing=${pricing.matched}`);
}

const monthly = evaluateScope('monthly');
console.log('\nmonthly evaluation:', monthly);
console.log('recommendation:', recommendationFor(monthly, { model: 'claude-opus-4' }));

console.log('\nfull status:\n', JSON.stringify(fullStatus(), null, 2));
