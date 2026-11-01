#!/usr/bin/env node
/**
 * Ownership cross-check (T0.4 / plan: CI cross-check).
 *
 * 1. Every channel address in contracts/asyncapi.yaml has >=1 produce (send)
 *    and >=1 consume (receive) operation.
 * 2. Every row in contracts/event-ownership.md maps to exactly one channel
 *    address, and every channel has a row.
 * 3. Every DLQ topic in the matrix is `<channel>.dlq`.
 *
 * Exit 0 = pass, 1 = fail. No deps beyond node (uses a tiny YAML line parse
 * — the files are machine-owned and flat enough; full YAML parsing is the
 * spectral job).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'contracts');
const errors = [];

// --- asyncapi.yaml ---------------------------------------------------------
const asyncapi = readFileSync(resolve(root, 'asyncapi.yaml'), 'utf8');

// channel addresses: lines like "    address: eventista.vote.cast"
const addresses = [...asyncapi.matchAll(/^\s+address:\s*(\S+)\s*$/gm)].map((m) => m[1]);
if (addresses.length === 0) errors.push('asyncapi.yaml: no channels found');

// operations: capture action + nearest following channel $ref line block
// Layout: "  opName:\n    action: send|receive\n    channel: { $ref: ... }"
const opRe = /^\s{2}(\w+):\s*\n\s+action:\s*(send|receive)\s*\n\s+channel:\s*\{\s*\$ref:\s*['"]#\/channels\/(\w+)['"]\s*\}/gm;
const ops = [...asyncapi.matchAll(opRe)].map((m) => ({ name: m[1], action: m[2], channelKey: m[3] }));

// channel key -> address map
const keyToAddress = {};
for (const m of asyncapi.matchAll(/^\s{2}(\w+):\s*\n(?:\s{4}.*\n)*?\s+address:\s*(\S+)/gm)) {
  keyToAddress[m[1]] = m[2];
}

const producers = new Map(); // address -> op names
const consumers = new Map();
for (const op of ops) {
  const addr = keyToAddress[op.channelKey];
  if (!addr) {
    errors.push(`operation ${op.name}: unknown channel key ${op.channelKey}`);
    continue;
  }
  const bag = op.action === 'send' ? producers : consumers;
  if (!bag.has(addr)) bag.set(addr, []);
  bag.get(addr).push(op.name);
}

for (const addr of addresses) {
  if (!producers.has(addr)) errors.push(`channel ${addr}: no producer (action: send)`);
  if (!consumers.has(addr)) errors.push(`channel ${addr}: no consumer (action: receive)`);
}

// --- event-ownership.md ----------------------------------------------------
const ownership = readFileSync(resolve(root, 'event-ownership.md'), 'utf8');
// table rows: | `vote.cast` | `eventista.vote.cast` | ... | `eventista.vote.cast.dlq` |
const rowRe = /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*`([^`]+)`\s*\|/gm;
const rows = [...ownership.matchAll(rowRe)].map((m) => ({ event: m[1], channel: m[2], dlq: m[3] }));
if (rows.length === 0) errors.push('event-ownership.md: no ownership rows parsed');

const rowChannels = new Set(rows.map((r) => r.channel));
for (const addr of addresses) {
  if (!rowChannels.has(addr)) errors.push(`channel ${addr}: missing row in event-ownership.md`);
}
for (const row of rows) {
  if (!addresses.includes(row.channel)) {
    errors.push(`event-ownership.md row ${row.event}: channel ${row.channel} not in asyncapi.yaml`);
  }
  const expectedDlq = `${row.channel}.dlq`;
  if (row.dlq !== expectedDlq) {
    errors.push(`event-ownership.md row ${row.event}: DLQ ${row.dlq} != ${expectedDlq}`);
  }
}

// --- report ----------------------------------------------------------------
if (errors.length > 0) {
  console.error('check-ownership: FAIL');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check-ownership: OK (${addresses.length} channels, ${rows.length} rows, ${ops.length} operations)`);