---
sidebar_position: 2
title: "Consistent Hashing"
---

# Consistent Hashing

## Mental Model

Map both keys and nodes onto a circular ring. Each key is assigned to the first node encountered clockwise from its position. When a node is added or removed, only the keys between it and its predecessor are remapped — not the entire keyspace. This is the fundamental improvement over `hash(key) % N`, which remaps nearly all keys when N changes.

## Problem Being Solved

With **modulo hashing** (`shard = hash(key) % N`), adding or removing a node changes N, causing ~all keys to remap to different nodes. In a cache or database cluster, this means:
- Cache: mass cache misses → thundering herd to the backend
- Database: massive data migration → downtime or inconsistency

Consistent hashing reduces remapping from O(K) to O(K/N) — only ~1/Nth of keys move.

## Core Mechanism

```
1. Hash both nodes and keys onto a ring [0, 2^32)
2. Each key maps to the first node clockwise from its position
3. Adding a node: only keys between the new node and its predecessor move
4. Removing a node: only its keys move to the next node clockwise
```

### Without virtual nodes

```
Ring: [0 ──── Node A ──── Node B ──── Node C ──── 0)

Key "user:123" hashes to position 4500
  → walks clockwise → hits Node B → assigned to Node B

Node D added between A and B:
  → only keys between A and D remap (from B to D)
  → keys on B after D, and all of C's keys, are untouched
```

**Problem:** with few physical nodes, the ring is unbalanced — one node may own a much larger arc than others.

### With virtual nodes (vnodes)

Each physical node places multiple points (virtual nodes) on the ring. E.g., Node A places `A-1, A-2, ..., A-150` at different positions.

```
Ring with 3 physical nodes × 150 vnodes = 450 points

Benefits:
  - Even distribution — each node owns ~1/3 of the ring
  - Node failure: its 150 vnodes' keys scatter across many other nodes
    (not all dumped onto one neighbor)
  - New node: picks up ~1/3 of keys evenly from all existing nodes
```

| vnodes per node | Distribution balance | Remapping on add/remove |
|-----------------|---------------------|-------------------------|
| 1 (no vnodes) | Very uneven | All keys from predecessor to new node |
| 50-100 | Good | ~1/N, spread across many nodes |
| 150-256 | Excellent | ~1/N, very even spread |

## How It Works

### Key assignment

```python
def find_node(key, ring, sorted_positions):
    key_hash = hash(key)
    # Binary search for the first node position >= key_hash
    idx = bisect_right(sorted_positions, key_hash)
    if idx == len(sorted_positions):
        idx = 0  # wrap around the ring
    return ring[sorted_positions[idx]]
```

### Replication along the ring

To replicate data (RF=3), assign the key to the next 3 **distinct physical nodes** clockwise (skip vnodes of the same physical node):

```
Key "order:789" → Node B (primary) → Node C (replica 1) → Node A (replica 2)
```

This is how Cassandra and DynamoDB replicate — each key's replicas are the next N unique nodes on the ring.

### Adding a node

```
Before: [A ──────────── B ──────────── C]
Add D between A and B:
After:  [A ────── D ──── B ──────────── C]

Only keys in range (A, D] move: from B to D
Keys in (D, B], (B, C], (C, A] are untouched
```

With 150 vnodes per node, D's 150 points are scattered across the ring — it absorbs ~1/4 of keys evenly from A, B, and C.

## Scaling Considerations

- **Ring metadata** — all clients/routers must know the ring topology. At 1000 nodes × 150 vnodes = 150K ring entries — fits in memory, but propagation (gossip or config service) takes time.
- **Bounded-load variant** — cap the maximum load per node (Google's "Consistent Hashing with Bounded Loads"). If a node exceeds its bound, the key overflows to the next node. Prevents hot nodes from drowning.
- **Jump hash** — Google's alternative: `O(1)` memory, `O(ln N)` compute, perfect balance. But only supports appending nodes (not arbitrary removal). Good for ordered scale-up scenarios.

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Node failure** | Keys on that node unavailable | Replication along the ring (RF=3); automatic re-routing to next node |
| **Uneven distribution (few nodes, no vnodes)** | One node owns 60%+ of the ring | Virtual nodes (150-256 per physical node) |
| **Ring propagation delay** | Clients route to stale topology; requests go to wrong node | Gossip protocol with short convergence window; or centralized config with push updates |
| **Rehash during scale-out** | Data migration while serving traffic | Background streaming; dual-read from old + new owner during migration |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Consistent hashing over modulo | Minimal remapping (~1/N) but ring management complexity |
| Consistent hashing over hash slots (Redis) | Arbitrary node count vs fixed 16384 slots; ring vs slot-range ownership |
| More vnodes | Better balance but more memory for ring metadata and slower lookups (larger sorted list) |
| Consistent hashing over range-based | Even distribution but no range scans |

## Real-World Examples

| System | Implementation | Notes |
|--------|---------------|-------|
| **Cassandra** | Murmur3 hash + vnodes | Each node owns `num_tokens` positions on the ring (default 256) |
| **DynamoDB** | Consistent hashing + virtual nodes | Adaptive capacity rebalances hot partitions |
| **Memcached** (client-side) | Ketama consistent hashing | Client library routes to the correct server |
| **Akka Cluster** | Consistent hashing router | Actor routing across cluster nodes |
| **Apache Kafka** | Not consistent hashing — uses `hash(key) % num_partitions` | Partition count is fixed per topic; no rehashing on broker add |
| **Redis Cluster** | Not consistent hashing — uses hash slots (CRC16 % 16384) | Simpler; resharding moves slot ranges between nodes |

## Related Concepts

- [Sharding & Partitioning](/distributed-systems/sharding) — the broader context: why, how, and which approach to pick
- [Redis Cluster](/building-blocks/redis) — uses hash slots, not consistent hashing
- [Cassandra](/building-blocks/cassandra) — uses consistent hashing with Murmur3 + vnodes
- [Replication](/distributed-systems/replication) — how replicas are placed along the ring
