---
sidebar_position: 7
title: "Presence & Heartbeat"
---

# Presence & Heartbeat

:::note Placeholder
Stub page. To be fleshed out following the Concept/Reference template.
:::

## Mental Model

Track who is online using self-expiring signals: clients periodically "ping" to stay alive, and absence of a ping means offline — no reliance on clean disconnects.

## Problem Being Solved

_TODO: Online/last-seen status at scale without hammering a durable store._

## Core Mechanism

_TODO: Heartbeat interval + TTL key; ephemeral store (Redis) for online, durable store for last-seen._

## How It Works

_TODO: Connect/heartbeat/disconnect/crash transitions; pull-based vs push-based query models._

## Scaling Considerations

_TODO: Write amplification (why last-seen is written on disconnect only), social-graph fan-out cost._

## Failure Modes

_TODO: Staleness window = TTL; false offline on missed heartbeats; clock skew._

## Trade-offs

_TODO: Freshness vs write cost; pull vs push._

## Real-World Examples

_TODO: WhatsApp last-seen, Slack presence dots._

## Related Concepts

- [WebSocket Connection Management](/building-blocks/websocket-connection-management)
- [Redis](/building-blocks/redis)
