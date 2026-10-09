---
sidebar_position: 1
title: SQL vs NoSQL
---

# SQL vs NoSQL

## The Decision Framework

This isn't "which is better" — it's "which fits the access pattern." Most production systems use both.

## When to Choose SQL (PostgreSQL, MySQL, Vitess)

| Signal | Why SQL |
|--------|---------|
| Data has relationships (joins needed) | Foreign keys, JOINs, normalized schema |
| Strong consistency required (ACID) | Transactions, isolation levels |
| Complex queries (GROUP BY, aggregations, subqueries) | SQL query planner optimizes these |
| Schema is well-defined and stable | Schema enforcement catches bugs early |
| Dataset fits on one machine (or small shard count) | Vertical scaling is simpler |
| Read-heavy with complex filters | Indexes, query optimizer, materialized views |

**Scale limit:** Single PostgreSQL handles ~10K-50K writes/sec. Beyond that → sharding (Vitess, Citus) or move write-heavy tables to NoSQL.

## When to Choose NoSQL

### Key-Value / Wide-Column (Cassandra, DynamoDB, ScyllaDB)

| Signal | Why |
|--------|-----|
| Write throughput > 100K/sec | Distributed writes, no single-master bottleneck |
| Simple access patterns (get by key, range scan within partition) | Partition key + clustering key model |
| Data doesn't need joins | Denormalized, self-contained rows |
| Massive dataset (TBs to PBs) | Linear horizontal scaling |
| Multi-region replication | Built-in geo-distribution |

### In-Memory (Redis)

| Signal | Why |
|--------|-----|
| Sub-millisecond latency required | All data in RAM |
| Ephemeral / transient data | TTL, clean deletes |
| Rich data structures (sorted sets, hashes, streams) | Not just key-value |
| High-churn data (frequent insert + delete) | No tombstones (unlike Cassandra) |
| Queue-like patterns | Sorted sets, lists, streams |

### Document (MongoDB, DynamoDB)

| Signal | Why |
|--------|-----|
| Schema varies per record | Flexible document structure |
| Self-contained objects (no joins) | Embedded documents |
| Rapid iteration / prototype phase | Schema-less development |

## The Hybrid Pattern

Most systems at scale use **multiple databases**, each optimized for its access pattern:

```
User profiles, config, metadata    → SQL (PostgreSQL)
Message storage, event logs        → Wide-column (Cassandra)
Caching, sessions, ephemeral state → In-memory (Redis)
Search                            → Search engine (Elasticsearch)
Files, media                      → Object storage (S3)
```

**The rule:** Choose the database based on the **access pattern of each table**, not one database for the entire system.

## Decision Table

| Factor | SQL | Cassandra | Redis |
|--------|-----|-----------|-------|
| Consistency | Strong (ACID) | Tunable (eventual → strong) | Eventual (async replication) |
| Write throughput | 10K-50K/sec | 100K-1M+/sec | 100K+/sec per node |
| Read latency | 1-10ms (with index) | 1-10ms (single partition) | < 1ms |
| Data durability | Strongest (WAL + replication) | Strong (commit log + replication) | Weakest (in-memory, AOF optional) |
| Joins | Native | Not supported | Not supported |
| Schema | Enforced | Semi-flexible | Schema-free |
| Scaling | Vertical (or sharded) | Linear horizontal | Linear horizontal (memory-bound) |
| Delete-heavy workloads | Fine | **Tombstone problem** | Fine (clean deletes) |
| Best for | Metadata, config, relational data | Massive append-heavy, time-series | Ephemeral state, caching, queues |

## Related Concepts

- [Redis](/building-blocks/redis) — in-memory data structure server
- [Cassandra](/building-blocks/cassandra) — distributed wide-column store
