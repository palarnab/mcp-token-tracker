#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';

import { ensureRoot, dbPath, rootDir } from '../src/core/paths.js';
import { setBudget, resetAll, listBudgets } from '../src/core/store.js';
import { fullStatus, evaluateScope, recommendationFor } from '../src/core/budget.js';
import { listModels } from '../src/core/pricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MCP_ENTRY = path.join(REPO_ROOT, 'src', 'mcp', 'server.js');
const HTTP_ENTRY = path.join(REPO_ROOT, 'src', 'http', 'server.js');

const args = process.argv.slice(2);
const cmd = args[0];

function parseFlags(rest) {
  const out = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function help() {
  console.log(`mcp-token-tracker — local LLM token & budget tracker

Usage:
  mcp-token-tracker <command> [options]

Commands:
  serve                       Run the MCP stdio server (use this from VS Code / Claude Code MCP config)
  http                        Run the local HTTP status server (127.0.0.1)
  status [--workspace <path>] Print current budget status
  set-limit --scope <s> --usd <n> [--warn <pct>] [--hard-stop]
                              Create or update a budget
  list-budgets                List configured budgets
  list-models                 List models in the pricing catalog
  reset --yes                 Wipe the local store (~/.llm-budget)
  paths                       Print where data is stored
  install --target <t>        Register this server with a host:
                                vscode-workspace   .vscode/mcp.json in CWD
                                vscode-user        VS Code user settings.json snippet (prints only)
                                claude-code        ~/.claude/mcp_servers.json
                                all                vscode-workspace + claude-code
  help                        Show this message
`);
}

async function main() {
  ensureRoot();
  switch (cmd) {
    case 'serve':       return runChild(MCP_ENTRY);
    case 'http':        return runChild(HTTP_ENTRY);
    case 'status':      return cmdStatus(parseFlags(args.slice(1)));
    case 'set-limit':   return cmdSetLimit(parseFlags(args.slice(1)));
    case 'list-budgets':return cmdListBudgets();
    case 'list-models': return cmdListModels();
    case 'reset':       return cmdReset(parseFlags(args.slice(1)));
    case 'paths':       return cmdPaths();
    case 'install':     return cmdInstall(parseFlags(args.slice(1)));
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return help();
    default:
      console.error(`Unknown command: ${cmd}\n`);
      help();
      process.exit(2);
  }
}

function runChild(entry) {
  const child = spawn(process.execPath, [entry], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function cmdStatus(flags) {
  const status = fullStatus({ workspace: flags.workspace });
  console.log(JSON.stringify(status, null, 2));
  for (const ev of status.scopes) {
    const rec = recommendationFor(ev);
    console.log(`\n[${ev.scope}] ${rec.headline}`);
  }
}

function cmdSetLimit(flags) {
  if (!flags.scope || flags.usd == null) {
    console.error('Required: --scope <name> --usd <number>');
    process.exit(2);
  }
  setBudget({
    scope: flags.scope,
    limit_usd: Number(flags.usd),
    warn_at_pct: flags.warn != null ? Number(flags.warn) : 80,
    hard_stop: !!flags['hard-stop'],
  });
  console.log(`Budget set: scope=${flags.scope} limit_usd=${flags.usd}`);
}

function cmdListBudgets() {
  console.log(JSON.stringify(listBudgets(), null, 2));
}

function cmdListModels() {
  console.log(JSON.stringify(listModels(), null, 2));
}

function cmdReset(flags) {
  if (!flags.yes) {
    console.error('Refusing to reset without --yes');
    process.exit(2);
  }
  resetAll();
  console.log('Local store cleared.');
}

function cmdPaths() {
  console.log(JSON.stringify({ root: rootDir(), db: dbPath() }, null, 2));
}

function cmdInstall(flags) {
  const target = flags.target ?? 'vscode-workspace';
  const entry = MCP_ENTRY;
  const def = {
    command: process.execPath,
    args: [entry],
    env: {},
  };

  if (target === 'vscode-workspace' || target === 'all') {
    const dir = path.join(process.cwd(), '.vscode');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'mcp.json');
    const existing = fs.existsSync(file) ? safeJson(file) : { servers: {} };
    existing.servers = existing.servers ?? {};
    existing.servers['token-tracker'] = { type: 'stdio', ...def };
    fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    console.log(`Wrote ${file}`);
  }

  if (target === 'vscode-user') {
    console.log('Add this to VS Code user settings.json under "mcp.servers":');
    console.log(JSON.stringify({ 'token-tracker': { type: 'stdio', ...def } }, null, 2));
  }

  if (target === 'claude-code' || target === 'all') {
    const dir = path.join(os.homedir(), '.claude');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'mcp_servers.json');
    const existing = fs.existsSync(file) ? safeJson(file) : { mcpServers: {} };
    existing.mcpServers = existing.mcpServers ?? {};
    existing.mcpServers['token-tracker'] = def;
    fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    console.log(`Wrote ${file}`);
  }

  if (!['vscode-workspace', 'vscode-user', 'claude-code', 'all'].includes(target)) {
    console.error(`Unknown --target: ${target}`);
    process.exit(2);
  }
}

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return {}; }
}

main().catch(err => {
  console.error(err?.stack ?? err);
  process.exit(1);
});
