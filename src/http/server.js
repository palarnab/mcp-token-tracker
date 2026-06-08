#!/usr/bin/env node
// Local HTTP status server. Read-only. Bound to 127.0.0.1 only.
// Intended for a future companion VS Code extension / curl inspection.

import express from 'express';
import { fullStatus, evaluateScope, forecastCost } from '../core/budget.js';
import { listModels } from '../core/pricing.js';
import { insertEvent, setBudget } from '../core/store.js';
import { computeCostUsd } from '../core/pricing.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.LLM_BUDGET_HTTP_PORT ?? 47821);

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, name: 'mcp-token-tracker', version: '0.1.0' }));

app.get('/status', (req, res) => {
  res.json(fullStatus({ workspace: req.query.workspace }));
});

app.get('/scope/:scope', (req, res) => {
  res.json(evaluateScope(req.params.scope, { workspace: req.query.workspace }));
});

app.get('/models', (_req, res) => {
  res.json({ models: listModels() });
});

app.post('/forecast', (req, res) => {
  const { model, input_tokens, output_tokens } = req.body ?? {};
  if (!model) return res.status(400).json({ error: 'model is required' });
  res.json(forecastCost(model, { input_tokens, output_tokens }));
});

app.post('/record', (req, res) => {
  const evt = req.body ?? {};
  if (!evt.model) return res.status(400).json({ error: 'model is required' });
  const { cost_usd, pricing } = computeCostUsd(evt.model, evt);
  const id = insertEvent({ ...evt, cost_usd, confidence: evt.confidence ?? 'self-report' });
  res.json({ recorded: true, id: Number(id), cost_usd, pricing_matched: pricing.matched });
});

app.post('/budget', (req, res) => {
  const { scope, limit_usd, warn_at_pct, hard_stop } = req.body ?? {};
  if (!scope || limit_usd == null) {
    return res.status(400).json({ error: 'scope and limit_usd are required' });
  }
  setBudget({ scope, limit_usd, warn_at_pct, hard_stop });
  res.json({ ok: true, scope, limit_usd });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err?.message ?? String(err) });
});

app.listen(PORT, HOST, () => {
  process.stderr.write(`[mcp-token-tracker http] listening on http://${HOST}:${PORT}\n`);
});
