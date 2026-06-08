// Resolves the on-disk locations used by the tracker.
// Everything lives under ~/.llm-budget so it survives across VS Code instances,
// Claude Code sessions, and any other MCP client on the same machine.

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const ROOT_ENV = 'LLM_BUDGET_HOME';

export function rootDir() {
  if (process.env[ROOT_ENV]) return process.env[ROOT_ENV];
  return path.join(os.homedir(), '.llm-budget');
}

export function dbPath() {
  return path.join(rootDir(), 'usage.sqlite');
}

export function configPath() {
  return path.join(rootDir(), 'config.json');
}

export function pricingCachePath() {
  return path.join(rootDir(), 'pricing-cache.json');
}

export function logsDir() {
  return path.join(rootDir(), 'logs');
}

export function ensureRoot() {
  const root = rootDir();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  const logs = logsDir();
  if (!fs.existsSync(logs)) fs.mkdirSync(logs, { recursive: true });
  return root;
}
