---
sidebar_position: 6
title: "Idempotency"
---

# Idempotency

:::note Placeholder
Stub page. To be fleshed out following the Concept/Reference template.
:::

## Mental Model

An operation you can safely apply more than once with the same result — the foundation of safe retries in an at-least-once world.

## Problem Being Solved

_TODO: Deduplicating effects when messages/requests are delivered or retried more than once._

## Core Mechanism

_TODO: Idempotency keys, dedup stores, upserts, natural idempotence._

## How It Works

_TODO: Key = f(messageId, userId); write-once guards; exactly-once-effect on at-least-once delivery._

## Scaling Considerations

_TODO: Dedup store TTL/size, partition-local vs global keys._

## Failure Modes

_TODO: Key collisions, dedup store loss, non-idempotent side effects._

## Trade-offs

_TODO: Dedup storage cost vs correctness under retries._

## Real-World Examples

_TODO: Kafka consumer replay, payment idempotency keys._

## Related Concepts

- [Apache Kafka](/building-blocks/kafka)
- [Fan-Out: Write-Time vs Read-Time](/patterns/fan-out)
