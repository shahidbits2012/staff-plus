#!/usr/bin/env node
/**
 * Validates a Vetora design YAML against the format spec
 * (§3 connection rules, §4.1 binding rules, §10 validation rules).
 *
 * Usage: node scripts/validate-design.js <file.yaml>
 */
const fs = require('fs');
const yaml = require('js-yaml');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/validate-design.js <file.yaml>');
  process.exit(2);
}

const doc = yaml.load(fs.readFileSync(file, 'utf8'));
const comps = doc.components || {};
const edges = doc.edges || [];

const LEGAL = new Set(
  `Client>CDN:API_CALL,Client>GeoDns:API_CALL,Client>ApiGateway:API_CALL,Client>RateLimiter:API_CALL,Client>LoadBalancer:API_CALL,Client>Service:API_CALL,CDN>ApiGateway:API_CALL,CDN>RateLimiter:API_CALL,CDN>LoadBalancer:API_CALL,CDN>Service:API_CALL,ApiGateway>RateLimiter:API_CALL,ApiGateway>LoadBalancer:API_CALL,ApiGateway>Service:API_CALL,LoadBalancer>Service:API_CALL,LoadBalancer>WebSocketService:API_CALL,Service>Service:API_CALL,Service>Cache:CACHE_CALL,Service>Database:DB_CALL,Service>ObjectStorage:API_CALL,Service>WebSocketService:API_CALL,Service>EventStream:KAFKA_EVENT,RateLimiter>LoadBalancer:API_CALL,RateLimiter>Service:API_CALL,WebSocketService>Service:API_CALL,WebSocketService>Database:DB_CALL,WebSocketService>EventStream:KAFKA_EVENT,GeoDns>CDN:API_CALL,GeoDns>ApiGateway:API_CALL,GeoDns>RateLimiter:API_CALL,GeoDns>LoadBalancer:API_CALL,GeoDns>Service:API_CALL,EventStream>Service:KAFKA_EVENT,EventStream>Worker:KAFKA_EVENT,EventStream>StreamProcessor:KAFKA_EVENT,Worker>Service:API_CALL,Worker>Database:DB_CALL,Worker>ObjectStorage:API_CALL,Worker>EventStream:KAFKA_EVENT,Worker>Cache:CACHE_CALL,Worker>WebSocketService:API_CALL,StreamProcessor>EventStream:KAFKA_EVENT,StreamProcessor>Service:API_CALL,StreamProcessor>Database:DB_CALL`.split(
    ',',
  ),
);

// Components that own no contracts of their own (§4.1)
const CONTRACTLESS = new Set([
  'CDN', 'ApiGateway', 'LoadBalancer', 'RateLimiter',
  'WebSocketService', 'GeoDns', 'Worker', 'StreamProcessor',
]);
// Component type -> contract collection key
const CONTRACT_KEY = {
  Service: 'endpoints',
  Cache: 'cacheSpaces',
  Database: 'tables',
  EventStream: 'topics',
  ObjectStorage: 'buckets',
};
// Sources that must carry input_bindings when they define contracts
const BINDING_SOURCES = new Set(['Service', 'EventStream', 'Database', 'Cache']);

const errors = [];
const warnings = [];

const ids = (c) => {
  const key = CONTRACT_KEY[c?.type];
  return key && Array.isArray(c[key]) ? c[key].map((x) => x.id) : [];
};
const outOf = (id) => edges.filter((e) => e.source === id);

// Resolve the set of contract ids a typed edge may legally bind to (§4.1)
function resolvable(edge) {
  const src = comps[edge.source];
  const tgt = comps[edge.target];
  // KAFKA_EVENT out of an EventStream binds the topic on the SOURCE
  if (edge.edge_type === 'KAFKA_EVENT' && src?.type === 'EventStream') {
    return ids(src);
  }
  // Otherwise walk forward through contract-less hops
  const seen = new Set();
  const acc = new Set();
  (function walk(nodeId) {
    if (!nodeId || seen.has(nodeId)) return;
    seen.add(nodeId);
    const n = comps[nodeId];
    if (!n) return;
    if (!CONTRACTLESS.has(n.type)) {
      ids(n).forEach((i) => acc.add(i));
      return;
    }
    outOf(nodeId).forEach((e) => walk(e.target));
  })(edge.target);
  return [...acc];
}

// VTR-001
if (Object.keys(comps).length === 0) errors.push('VTR-001: canvas is empty');
if (typeof comps !== 'object' || Array.isArray(comps)) errors.push('components must be a map');
if (!Array.isArray(edges)) errors.push('edges must be an array');

// Component-level checks
for (const [id, c] of Object.entries(comps)) {
  if (!c.type) errors.push(`${id}: missing type`);
  if (!c.position || c.position.x === undefined || c.position.y === undefined)
    errors.push(`${id}: missing position`);
}

// VTR-002 entry points
const hasIncoming = new Set(edges.map((e) => e.target));
const entryNodes = Object.keys(comps).filter((id) => !hasIncoming.has(id));
if (entryNodes.length === 0) errors.push('VTR-002: no entry point (every node has an incoming edge)');
for (const ep of doc.entry_points || []) {
  if (!comps[ep]) errors.push(`entry_points: "${ep}" is not a component`);
  else if (comps[ep].type !== 'Client') errors.push(`entry_points: "${ep}" is not a Client`);
}

// CL-007 every Client has an outgoing edge
for (const [id, c] of Object.entries(comps)) {
  if (c.type === 'Client' && outOf(id).length === 0)
    warnings.push(`CL-007: Client "${id}" has no outgoing edge`);
}

// VTR-011 reachability from Clients
const reachable = new Set();
(function bfs() {
  const q = Object.entries(comps).filter(([, c]) => c.type === 'Client').map(([id]) => id);
  q.forEach((i) => reachable.add(i));
  while (q.length) {
    const cur = q.shift();
    for (const e of outOf(cur)) {
      if (!reachable.has(e.target)) { reachable.add(e.target); q.push(e.target); }
    }
  }
})();
for (const id of Object.keys(comps)) {
  if (!reachable.has(id)) warnings.push(`VTR-011: "${id}" is not reachable from a Client`);
}

// Edge-level checks
edges.forEach((e, i) => {
  const tag = `edge[${i}] ${e.source}->${e.target}`;
  const src = comps[e.source];
  const tgt = comps[e.target];

  // VTR-004 dangling
  if (!src) return errors.push(`VTR-004: ${tag}: unknown source`);
  if (!tgt) return errors.push(`VTR-004: ${tag}: unknown target`);
  // VTR-005 self loop
  if (e.source === e.target) warnings.push(`VTR-005: ${tag}: self-loop`);

  // §3 legality
  const key = `${src.type}>${tgt.type}:${e.edge_type}`;
  if (!LEGAL.has(key)) errors.push(`§3: ${tag}: illegal pair/edge_type (${key})`);

  // no Service -> WebSocketService push (forms a cycle: Service→WS→Service,
  // and the edge resolves back to the sender's own contracts).
  // Worker/StreamProcessor → WebSocketService is fine — they have no contracts.
  if (tgt.type === 'WebSocketService' && src.type === 'Service')
    errors.push(`§4.1 pitfall: ${tag}: Service->WebSocketService push edge (cycle)`);

  if (!e.edge_type) return;

  // CL-012 contract-bearing target must define contracts
  // (checked independently of contract_id — a missing contract set is an error
  // even when the edge also omits contract_id)
  if (CONTRACT_KEY[tgt.type] && ids(tgt).length === 0)
    errors.push(`CL-012: ${tag}: target "${e.target}" (${tgt.type}) defines no ${CONTRACT_KEY[tgt.type]}`);

  // VTR-061 operation required on DB / Cache / ObjectStorage edges
  const needsOp =
    e.edge_type === 'DB_CALL' ||
    e.edge_type === 'CACHE_CALL' ||
    (e.edge_type === 'API_CALL' && tgt.type === 'ObjectStorage');
  if (needsOp && !e.operation) errors.push(`VTR-061: ${tag}: missing operation`);

  // CL-010 typed edges must set contract_id
  const options = resolvable(e);
  if (!e.contract_id) {
    if (options.length > 0) errors.push(`CL-010: ${tag}: missing contract_id (resolvable: ${options.join(', ')})`);
    else errors.push(`CL-014: ${tag}: typed edge resolves to no contract downstream`);
  } else if (options.length === 0) {
    // CL-014 / VTR-060 contract must resolve
    errors.push(`CL-014: ${tag}: no downstream contract to resolve "${e.contract_id}"`);
  } else if (!options.includes(e.contract_id)) {
    errors.push(`VTR-060: ${tag}: contract_id "${e.contract_id}" not in resolvable set [${options.join(', ')}]`);
  }

  // CL-009 input_bindings when source is contract-bearing and defines contracts
  const srcDefines = ids(src).length > 0;
  if (BINDING_SOURCES.has(src.type) && srcDefines) {
    const ib = e.input_bindings;
    if (!Array.isArray(ib) || ib.length === 0) {
      errors.push(`CL-009: ${tag}: missing input_bindings`);
    } else {
      ib.forEach((b) => {
        if (!b.source_contract_id)
          errors.push(`CL-009: ${tag}: input_binding missing source_contract_id`);
        else if (!ids(src).includes(b.source_contract_id))
          errors.push(`CL-009: ${tag}: source_contract_id "${b.source_contract_id}" not a contract on source "${e.source}"`);
        // EventStream consume: binding topic must equal edge contract_id
        if (src.type === 'EventStream' && b.source_contract_id !== e.contract_id)
          errors.push(`§4.1: ${tag}: consume binding "${b.source_contract_id}" != contract_id "${e.contract_id}"`);
      });
    }
  }
});

console.log(`components: ${Object.keys(comps).length}   edges: ${edges.length}`);
console.log(`entry nodes (no incoming): ${entryNodes.join(', ') || 'none'}`);
if (warnings.length) console.log('\nWARNINGS:\n  ' + warnings.join('\n  '));
if (errors.length) {
  console.log('\nERRORS:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('\n✅ No error-severity issues. Spec §3 / §4.1 / §10 checks pass.');
