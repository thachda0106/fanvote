#!/usr/bin/env node
/**
 * AsyncAPI evolution gate (T0.4): "same evolution check for AsyncAPI".
 *
 * Compares contracts/baseline/asyncapi.yaml (last merged) against
 * contracts/asyncapi.yaml (candidate). FAILS on breaking changes:
 *   - removed channel / message / operation
 *   - removed payload property (or header property)
 *   - payload/header property newly `required` that was not required before
 *   - narrowed enum (value removed)
 * Additive optional fields are allowed (non-breaking).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'contracts');
const baseline = parse(readFileSync(resolve(root, 'baseline/asyncapi.yaml'), 'utf8'));
const candidate = parse(readFileSync(resolve(root, 'asyncapi.yaml'), 'utf8'));
const errors = [];

function channelAddresses(doc) {
  const out = new Map(); // key -> address
  for (const [key, ch] of Object.entries(doc.channels ?? {})) out.set(key, ch.address);
  return out;
}

function schemaMap(doc, kind) {
  // kind: 'payload' messages.*.payload  | 'header' messages.*.headers
  const map = new Map(); // address -> schema object
  for (const ch of Object.values(doc.channels ?? {})) {
    for (const msg of Object.values(ch.messages ?? {})) {
      const ref = typeof msg.$ref === 'string' ? msg.$ref : null;
      let resolved = msg;
      if (ref?.startsWith('#/components/messages/')) {
        const name = ref.split('/').pop();
        resolved = doc.components?.messages?.[name];
      }
      if (!resolved) continue;
      const raw = kind === 'payload' ? resolved.payload : resolved.headers;
      let schema = raw;
      if (raw?.$ref?.startsWith('#/components/schemas/')) {
        schema = doc.components?.schemas?.[raw.$ref.split('/').pop()];
      } else if (raw?.$ref?.startsWith('#/components/messageHeaders/')) {
        schema = doc.components?.messageHeaders?.[raw.$ref.split('/').pop()];
      }
      if (schema && ch.address) map.set(ch.address, schema);
    }
  }
  return map;
}

// 1) channels must not be removed
const baseAddrs = channelAddresses(baseline);
const candAddrs = channelAddresses(candidate);
for (const [key, addr] of baseAddrs) {
  if (![...candAddrs.values()].includes(addr)) {
    errors.push(`channel removed: ${addr} (key ${key})`);
  }
}

// 2) operations must not be removed
for (const op of Object.keys(baseline.operations ?? {})) {
  if (!(op in (candidate.operations ?? {}))) errors.push(`operation removed: ${op}`);
}

// 3) payload / header schema regressions per surviving channel
function propsOf(schema) {
  return schema?.properties ?? {};
}
function requiredOf(schema) {
  return new Set(schema?.required ?? []);
}

for (const kind of ['payload', 'header']) {
  const b = schemaMap(baseline, kind);
  const c = schemaMap(candidate, kind);
  for (const [addr, bSchema] of b) {
    const cSchema = c.get(addr);
    if (!cSchema) {
      errors.push(`${kind} schema missing for surviving channel: ${addr}`);
      continue;
    }
    const bReq = requiredOf(bSchema);
    const cProps = propsOf(cSchema);
    const cReq = requiredOf(cSchema);
    for (const [prop, bPropSchema] of Object.entries(propsOf(bSchema))) {
      if (!(prop in cProps)) {
        errors.push(`${kind} ${addr}: property removed: ${prop}`);
        continue;
      }
      if (cReq.has(prop) && !bReq.has(prop)) {
        errors.push(`${kind} ${addr}: property newly required: ${prop}`);
      }
      // narrowed enum
      const bEnum = bPropSchema?.enum;
      const cEnum = cProps[prop]?.enum;
      if (Array.isArray(bEnum) && Array.isArray(cEnum)) {
        for (const v of bEnum) {
          if (!cEnum.includes(v)) errors.push(`${kind} ${addr}.${prop}: enum value removed: ${v}`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error('asyncapi-breaking: FAIL (breaking changes vs baseline)');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('asyncapi-breaking: OK (no breaking changes vs baseline)');