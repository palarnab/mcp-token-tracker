#!/usr/bin/env node
// MCP stdio server. Exposes budget tools to any MCP-capable agent.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { insertEvent, setBudget } from '../core/store.js';
import { computeCostUsd, priceForModel, listModels } from '../core/pricing.js';
import {
  evaluateScope, recommendationFor, fullStatus, forecastCost,
} from '../core/budget.js';

const SERVER_NAME = 'mcp-token-tracker';
const SERVER_VERSION = '0.1.0';

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {}, resources: {} } },
);

const TOOLS = [
  {
    name: 'budget_check',
    description:
      'Check current LLM spend against the configured budget. Returns a recommendation the agent can act on (e.g. switch to a cheaper model). Call this at session start and before launching expensive multi-turn work.',
    inputSchema: {
      type: 'object',
      properties: {
        scope:     { type: 'string', description: 'One of: daily, monthly, rolling-24h, rolling-30d, global. Default: monthly.' },
        workspace: { type: 'string', description: 'Optional workspace path or identifier to scope the query.' },
        model:    { type: 'string', description: 'Optional current model name; enables tailored cheaper-alternative suggestions.' },
      },
    },
  },
  {
    name: 'budget_record',
    description:
      'Record a token-usage event for the current turn. Call this after each completed agent turn to keep the local store accurate. Cost is computed server-side from the bundled pricing catalog.',
    inputSchema: {
      type: 'object',
      required: ['model', 'input_tokens', 'output_tokens'],
      properties: {
        model:          { type: 'string' },
        input_tokens:   { type: 'integer', minimum: 0 },
        output_tokens:  { type: 'integer', minimum: 0 },
        cached_tokens:  { type: 'integer', minimum: 0 },
        source:         { type: 'string', description: 'e.g. copilot-chat, claude-code, self-report' },
        workspace:      { type: 'string' },
        session_id:     { type: 'string' },
        confidence:     { type: 'string', enum: ['exact', 'logged', 'estimated'] },
      },
    },
  },
  {
    name: 'budget_status',
    description:
      'Return a full status snapshot across all configured scopes plus per-model usage for the current month.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
      },
    },
  },
  {
    name: 'budget_set_limit',
    description:
      'Create or update a budget limit for a scope (daily, monthly, etc.).',
    inputSchema: {
      type: 'object',
      required: ['scope', 'limit_usd'],
      properties: {
        scope:       { type: 'string' },
        limit_usd:   { type: 'number', minimum: 0 },
        warn_at_pct: { type: 'integer', minimum: 1, maximum: 100 },
        hard_stop:   { type: 'boolean' },
      },
    },
  },
  {
    name: 'budget_forecast',
    description:
      'Estimate the cost of a planned operation given a model and approximate token counts. Use this before launching a large refactor or batch run.',
    inputSchema: {
      type: 'object',
      required: ['model'],
      properties: {
        model:         { type: 'string' },
        input_tokens:  { type: 'integer', minimum: 0 },
        output_tokens: { type: 'integer', minimum: 0 },
      },
    },
  },
  {
    name: 'budget_list_models',
    description:
      'List models known to the pricing catalog with their per-million-token prices.',
    inputSchema: { type: 'object', properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case 'budget_check': {
        const scope = args.scope ?? 'monthly';
        const evaluation = evaluateScope(scope, { workspace: args.workspace });
        const recommendation = recommendationFor(evaluation, { model: args.model });
        return jsonResult({ evaluation, recommendation });
      }
      case 'budget_record': {
        const { cost_usd, pricing } = computeCostUsd(args.model, args);
        const id = insertEvent({
          ...args,
          cost_usd,
          confidence: args.confidence ?? 'self-report',
        });
        return jsonResult({
          recorded: true,
          id: Number(id),
          cost_usd,
          pricing_matched: pricing.matched,
          pricing_unknown: !!pricing.unknown,
        });
      }
      case 'budget_status': {
        return jsonResult(fullStatus({ workspace: args.workspace }));
      }
      case 'budget_set_limit': {
        setBudget({
          scope: args.scope,
          limit_usd: args.limit_usd,
          warn_at_pct: args.warn_at_pct ?? 80,
          hard_stop: args.hard_stop ? 1 : 0,
        });
        return jsonResult({ ok: true, scope: args.scope, limit_usd: args.limit_usd });
      }
      case 'budget_forecast': {
        return jsonResult(forecastCost(args.model, args));
      }
      case 'budget_list_models': {
        return jsonResult({ models: listModels() });
      }
      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return errorResult(err?.message ?? String(err));
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'budget://status',
      name: 'Current budget status',
      description: 'Aggregated usage and budget evaluation across all scopes.',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === 'budget://status') {
    return {
      contents: [{
        uri: req.params.uri,
        mimeType: 'application/json',
        text: JSON.stringify(fullStatus(), null, 2),
      }],
    };
  }
  throw new Error(`Unknown resource: ${req.params.uri}`);
});

function jsonResult(obj) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stderr is safe; stdout is reserved for the MCP framing protocol.
  process.stderr.write(`[${SERVER_NAME}] v${SERVER_VERSION} ready on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
