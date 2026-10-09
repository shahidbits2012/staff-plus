---
sidebar_position: 2
title: "Fan-Out: Write-Time vs Read-Time"
---

# Fan-Out: Write-Time vs Read-Time

:::note Placeholder
Stub page. To be fleshed out following the Concept/Reference template.
:::

## Mental Model

When one write must reach many readers (a message to a group, a post to followers), you either do the work on write (push into each recipient's inbox) or on read (recipients pull from a shared stream). The choice is a latency-vs-write-amplification trade.

## Problem Being Solved

_TODO: Delivering one event to N recipients without overloading writes or reads._

## Core Mechanism

_TODO: Write-time (push/fan-out-on-write) vs read-time (pull/fan-out-on-read); hybrid by recipient cardinality._

## How It Works

_TODO: Per-user inbox writes vs per-chat/per-author stream; the "celebrity/hot entity" problem._

## Scaling Considerations

_TODO: Threshold-based switching, batching, write amplification math._

## Failure Modes

_TODO: Hot partitions, fan-out lag, inconsistent inbox state._

## Trade-offs

_TODO: Read latency vs write cost; when to flip a hot entity from write-time to read-time._

## Real-World Examples

_TODO: Twitter timelines, Discord channels, WhatsApp groups._

## Related Concepts

- [Apache Kafka](/building-blocks/kafka)
- [Redis](/building-blocks/redis)
- [Idempotency](/patterns/idempotency)
