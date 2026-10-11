---
sidebar_position: 4
title: "Sharding & Partitioning"
---

# Sharding & Partitioning

## Mental Model

Sharding splits a dataset across multiple machines so that no single machine holds all the data. Each shard is an independent slice that can be read/written independently. The shard key determines which machine owns a given record.

Think of it as a library that outgrew one building — books A-M go to Branch 1, N-Z go to Branch 2. Every visitor must know which branch to go to (the routing rule), and the split must be balanced (you don't want 80% of books in one branch).

## Problem Being Solved

A single database node hits limits:
- **Storage** — one disk can't hold 100TB
- **Throughput** — one node can't serve 1M queries/sec
- **Memory** — working set exceeds one machine's RAM

Sharding distributes data and load so each node handles a fraction of the total.

## Core Mechanism

Every sharding scheme needs three things:
1. **Shard key** — which field determines the partition (e.g., `userId`, `chatId`, `orderId`)
2. **Routing function** — maps shard key → shard number (hash, range, directory)
3. **Rebalancing strategy** — what happens when you add or remove a shard

## Key Lookup Approaches

| Approach | How | Pros | Cons |
|----------|-----|------|------|
| **Modulo hashing** | `shard = hash(key) % N` | Trivial to implement | Adding/removing a node remaps ~all keys (rehash storm) |
| **[Consistent hashing](/distributed-systems/consistent-hashing)** | Keys and nodes on a ring; key maps to next node clockwise | Only ~1/N keys remap on node change | Ring management complexity; need virtual nodes for balance |
| **Hash slots** (Redis Cluster) | 16384 fixed slots; `slot = CRC16(key) % 16384`; each node owns a slot range | Deterministic; resharding = move slots, not recompute all keys | Fixed max 16384 shards (plenty for most systems) |
| **Range-based** | Keys split by value ranges (e.g., A-M → shard 1, N-Z → shard 2) | Good for range scans (all data in a range is co-located) | Hot ranges — popular prefixes cause imbalance |
| **Directory-based** | Lookup table maps each key to its shard | Total control; can rebalance any key independently | Directory is a bottleneck / SPOF; must be cached |

### When to use which

| Use case | Recommended | Example |
|----------|-------------|---------|
| Key-value store (cache, counters) | Hash slots or consistent hashing | Redis Cluster, Memcached |
| Wide-column / distributed DB | Consistent hashing with virtual nodes | Cassandra, DynamoDB |
| Time-series or ordered data | Range-based | HBase, Bigtable, CockroachDB |
| Custom / complex routing | Directory-based | Application-level sharding |
| Prototype / fixed cluster | Modulo hashing | Simple caches |

## Hot Partition Problem

A **hot partition** occurs when one shard receives disproportionately more traffic than others. Common causes:
- **Celebrity key** — one client/user generates vastly more traffic (e.g., `clientId=Walmart` in a rate limiter)
- **Temporal skew** — time-based sharding where "now" is always hot
- **Skewed key distribution** — hash function produces uneven distribution

### Mitigation Strategies

| Strategy | How | Trade-off |
|----------|-----|-----------|
| **Sub-sharding / key splitting** | Split hot key into N sub-keys: `{key}:{shard_N}`. Write to random sub-key; read = SUM across all. | Read fan-out (N reads instead of 1); slight inaccuracy if reads are stale |
| **Local aggregation** | Accumulate writes locally (in-process); periodically flush to shard | Bounded staleness during flush interval |
| **Dedicated shard** | Pin hot keys to a beefier node | Manual; doesn't scale if multiple keys go hot |
| **Salting** | Append random suffix to key before hashing: `hash(key + salt)` | Scatters hot key across shards; but can't do point lookups without knowing the salt |
| **Application-level routing** | Detect hot keys dynamically; route to a pool of replicas | Complex but adaptive; used by DynamoDB (adaptive capacity) |

## Scaling Considerations

- **Resharding** — adding a shard requires moving data. Consistent hashing moves ~1/N; modulo moves ~all. Plan for online resharding (background migration while serving traffic).
- **Cross-shard queries** — queries that span multiple shards (e.g., "all orders for user X" when sharded by orderId) require scatter-gather. Design the shard key to match the primary query pattern.
- **Replication** — each shard should be replicated (primary + replica) for fault tolerance. Shard failure without replicas = data unavailable.
- **Transactions** — cross-shard transactions are expensive (2PC / Saga). Avoid by co-locating related data on the same shard (hash tags in Redis, partition key in Cassandra).

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Shard node down** | Data on that shard unavailable | Replication (primary + replica); auto-failover |
| **Hot shard overloaded** | Increased latency, timeouts for keys on that shard | Sub-sharding, local aggregation, adaptive routing |
| **Resharding during traffic** | Inconsistent reads during migration window | Dual-read (old + new shard) during migration; stop-and-copy as fallback |
| **Uneven distribution** | Some shards over-full, others under-used | Consistent hashing with virtual nodes; monitor shard sizes |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Hash-based over range-based | Uniform distribution but no range scans |
| Consistent hashing over modulo | Minimal remapping but ring complexity |
| More shards | Better parallelism but more coordination overhead |
| Shard key = query key | Optimal reads but limits query flexibility |

## Real-World Examples

| System | Sharding approach | Shard key |
|--------|-------------------|-----------|
| **Redis Cluster** | Hash slots (16384) | `CRC16(key) % 16384` |
| **Cassandra** | Consistent hashing (Murmur3) | Partition key |
| **DynamoDB** | Consistent hashing + adaptive capacity | Partition key |
| **MongoDB** | Range or hash-based | Shard key field |
| **Kafka** | Hash-based partitioning | Message key |
| **Vitess (YouTube)** | Range-based with vschema | Sharding key |

## Related Concepts

- [Consistent Hashing](/distributed-systems/consistent-hashing) — ring-based key distribution
- [Redis Cluster](/building-blocks/redis) — hash-slot sharding, resharding, failover
- [Cassandra](/building-blocks/cassandra) — partition key, virtual nodes, replication
- [Replication](/distributed-systems/replication) — per-shard replication for fault tolerance
