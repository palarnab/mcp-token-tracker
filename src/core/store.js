import Database from 'better-sqlite3';
import { dbPath, ensureRoot } from './paths.js';

let _db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  source TEXT NOT NULL,
  workspace TEXT,
  session_id TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'estimated',
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace, ts);
CREATE INDEX IF NOT EXISTS idx_events_model ON events(model, ts);

CREATE TABLE IF NOT EXISTS budgets (
  scope TEXT PRIMARY KEY,
  limit_usd REAL NOT NULL,
  warn_at_pct INTEGER NOT NULL DEFAULT 80,
  hard_stop INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function getDb() {
  if (_db) return _db;
  ensureRoot();
  _db = new Database(dbPath());
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.exec(SCHEMA);
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function insertEvent(evt) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO events
      (ts, source, workspace, session_id, model, input_tokens, output_tokens,
       cached_tokens, cost_usd, confidence, metadata)
    VALUES
      (@ts, @source, @workspace, @session_id, @model, @input_tokens, @output_tokens,
       @cached_tokens, @cost_usd, @confidence, @metadata)
  `);
  const row = {
    ts: evt.ts ?? Date.now(),
    source: evt.source ?? 'self-report',
    workspace: evt.workspace ?? null,
    session_id: evt.session_id ?? null,
    model: evt.model,
    input_tokens: evt.input_tokens ?? 0,
    output_tokens: evt.output_tokens ?? 0,
    cached_tokens: evt.cached_tokens ?? 0,
    cost_usd: evt.cost_usd ?? 0,
    confidence: evt.confidence ?? 'estimated',
    metadata: evt.metadata ? JSON.stringify(evt.metadata) : null,
  };
  const info = stmt.run(row);
  return info.lastInsertRowid;
}

export function sumUsage({ sinceMs, workspace } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (sinceMs != null) { where.push('ts >= @since'); params.since = sinceMs; }
  if (workspace) { where.push('workspace = @workspace'); params.workspace = workspace; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens),0)  AS input_tokens,
      COALESCE(SUM(output_tokens),0) AS output_tokens,
      COALESCE(SUM(cached_tokens),0) AS cached_tokens,
      COALESCE(SUM(cost_usd),0)      AS cost_usd,
      COUNT(*)                       AS events
    FROM events ${whereSql}
  `);
  return stmt.get(params);
}

export function usageByModel({ sinceMs } = {}) {
  const db = getDb();
  const params = {};
  let whereSql = '';
  if (sinceMs != null) { whereSql = 'WHERE ts >= @since'; params.since = sinceMs; }
  return db.prepare(`
    SELECT model,
           SUM(input_tokens)  AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd)      AS cost_usd,
           COUNT(*)           AS events
    FROM events ${whereSql}
    GROUP BY model
    ORDER BY cost_usd DESC
  `).all(params);
}

export function setBudget({ scope, limit_usd, warn_at_pct = 80, hard_stop = 0 }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO budgets (scope, limit_usd, warn_at_pct, hard_stop, updated_at)
    VALUES (@scope, @limit_usd, @warn_at_pct, @hard_stop, @updated_at)
    ON CONFLICT(scope) DO UPDATE SET
      limit_usd = excluded.limit_usd,
      warn_at_pct = excluded.warn_at_pct,
      hard_stop = excluded.hard_stop,
      updated_at = excluded.updated_at
  `).run({
    scope, limit_usd, warn_at_pct, hard_stop: hard_stop ? 1 : 0,
    updated_at: Date.now(),
  });
}

export function getBudget(scope) {
  const db = getDb();
  return db.prepare('SELECT * FROM budgets WHERE scope = ?').get(scope) ?? null;
}

export function listBudgets() {
  const db = getDb();
  return db.prepare('SELECT * FROM budgets ORDER BY scope').all();
}

export function resetAll() {
  const db = getDb();
  db.exec('DELETE FROM events; DELETE FROM budgets; DELETE FROM meta;');
}
