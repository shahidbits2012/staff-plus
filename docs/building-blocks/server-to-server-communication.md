---
sidebar_position: 9
title: "Server-to-Server Communication"
---

# Server-to-Server Communication

## Mental Model

When a fleet of stateful servers (WebSocket gateways, game servers, real-time collaboration nodes) needs to route messages between each other, you need a communication layer. The sender server knows *what* to deliver and *where* (via a connection registry), but needs a mechanism to get the payload to the destination server.

This is distinct from client-server communication and from durable event streaming. It's internal, server-to-server, typically low-latency and ephemeral.

## Problem Being Solved

Server A holds User X's connection. Server B holds User Y's connection. When X sends a message to Y, Server A must deliver it to Server B. At scale (hundreds of servers), the options range from brute-force broadcast to precision routing with varying durability guarantees.

## Approaches

### Approach A: Broadcast

Every message is sent to every server. Each server checks if the recipient is locally connected.

```
Server A sends message for User Y
  → Broadcast to Server B, C, D, E, ..., N
  → Each server checks: "Is User Y connected to me?"
  → Server B: "Yes" → delivers to User Y
  → All others: discard
```

| Pros | Cons |
|------|------|
| Simple — no routing lookup needed | **O(N) fan-out per message** — N servers × M msgs/sec = N×M internal messages/sec |
| No single point of failure | Network bandwidth explosion at scale |
| | Doesn't scale beyond ~10 servers |

**Use when:** Small cluster (fewer than 10 servers), prototyping, or as a fallback during registry outages.

### Approach B: Direct RPC (gRPC / HTTP)

Source server calls destination server directly via RPC.

```
Server A looks up User Y → Server B
Server A → gRPC call → Server B → delivers to User Y
```

| Pros | Cons |
|------|------|
| Lowest latency — direct path, no middleware | Tight coupling — sender must handle recipient server failures |
| Simple, well-understood | Retry, backpressure, circuit breaking all on the sender |
| No external dependency | N² potential connections between servers |

**Use when:** Low server count, strong latency requirements, and you can tolerate coupling.

### Approach C: Redis Pub/Sub

Each server subscribes to a channel named after itself. To deliver a message, publish to the destination server's channel.

```
Server B subscribes to: channel:server-B
Server A publishes to:  channel:server-B → "deliver to User Y"
Server B receives → pushes to User Y
```

| Pros | Cons |
|------|------|
| Decoupled — sender doesn't need server addresses | **Fire-and-forget** — if subscriber is down, message is lost |
| Very low latency (~1ms) | No persistence, no retry, no acknowledgement |
| Simple to implement with existing Redis | No consumer groups, no replay |

**Use when:** Best-effort delivery is acceptable, AND you have another durability layer (e.g., a persistent inbox/queue as fallback).

### Approach D: Redis Streams

Like Pub/Sub but with persistence. Each server has a stream. Messages are appended; the server consumes and ACKs.

```
Server A → XADD stream:server-B * payload "..."
Server B → XREAD from stream:server-B → process → XACK
```

| Pros | Cons |
|------|------|
| **Durable** — messages survive subscriber downtime | More storage than Pub/Sub |
| Consumer groups, ACK, replay on failure | Need stream trimming (MAXLEN or time-based) |
| Backpressure via consumer lag monitoring | Slightly higher latency (~2-5ms vs ~1ms for Pub/Sub) |
| Lightweight — no separate broker infrastructure if already using Redis | |

**Use when:** Guaranteed delivery required between servers, moderate throughput, and you're already running Redis.

### Approach E: Kafka

Durable, partitioned, replicated event log. Can be used for server-to-server routing by creating per-server topics or using consumer groups.

| Pros | Cons |
|------|------|
| Extremely durable (replicated commit log) | **Not designed for dynamic, ephemeral routing** |
| High throughput, well-understood | Topic creation/deletion overhead for per-server topics |
| Consumer groups, replay, exactly-once | Higher latency (~10-50ms due to batching, poll intervals) |
| | Overkill for point-to-point server routing |

**Use when:** Durable event streaming between services, fan-out to multiple consumer groups, or when the server-to-server message is also an event that other systems consume. **Not recommended** for ephemeral server-to-server routing where dynamic topic management becomes a bottleneck.

### Why Not Kafka for Server Routing?

Kafka excels at durable, ordered streams with **stable topics**. Using it for server-to-server routing means:
- One topic per server → hundreds of topics created/destroyed as servers scale
- Topic metadata overhead in ZooKeeper/KRaft
- Partition rebalancing on server fleet changes
- Higher latency than Redis-based solutions

Kafka is the right tool for **durable event pipelines** (message fan-out, analytics, cross-service events). Redis Streams or direct RPC is better for **ephemeral server-to-server routing**.

## Decision Guide

| Requirement | Recommended |
|-------------|-------------|
| Best-effort, lowest latency | Redis Pub/Sub |
| Guaranteed delivery, moderate latency | **Redis Streams** |
| Low server count, tight latency budget | Direct RPC (gRPC) |
| Small cluster, simplicity | Broadcast |
| Durable event log (not routing) | Kafka |

## Fan-Out Optimization: Batch by Destination

When delivering to many recipients across multiple servers, don't make one publish per recipient. Batch by destination server:

```
1. Lookup all recipients in connection registry (batched read)
2. Group by destination server:
   { server-B: [user1, user3], server-D: [user2, user4, user5], ... }
3. One publish per destination server (with list of recipients)
4. Destination server unpacks batch, delivers to local connections
```

This reduces N publishes to K publishes (where K = number of unique destination servers, typically K is much smaller than N).

## Failure Modes

| Failure | Impact by Approach | Mitigation |
|---------|-------------------|------------|
| **Destination server down** | Pub/Sub: message lost. Streams: queued until server recovers. RPC: sender gets error. | Use Streams for guaranteed delivery; fallback to persistent queue (Inbox) for offline recipients |
| **Redis down** | Pub/Sub + Streams: all routing broken | Redis Cluster with replicas; fallback to broadcast during outage |
| **Network partition** | Servers in different partitions can't communicate | Redis Streams durability — messages queue until partition heals |
| **Consumer lag (Streams)** | Delivery delay increases | Monitor lag; scale consumers; trim old entries |

## Real-World Examples

| System | Approach | Notes |
|--------|----------|-------|
| **WhatsApp** | Erlang process messaging (built-in) | No external broker — BEAM VM handles cross-node routing |
| **Discord** | Elixir processes + Pub/Sub | Similar to WhatsApp's actor model |
| **Slack** | Redis for real-time routing | Kafka for durable fan-out (separate concern) |
| **Uber (Ringpop)** | Direct RPC + gossip-based discovery | Custom solution for ride-matching routing |
| **Gaming servers** | Direct UDP/TCP or Redis Pub/Sub | Latency-critical, best-effort acceptable |

## Related Concepts

- [WebSocket Connection Management](/building-blocks/websocket-connection-management) — how to find which server holds a connection (the prerequisite to routing)
- [Apache Kafka](/building-blocks/kafka) — when you need a durable event pipeline, not ephemeral routing
- [Redis](/building-blocks/redis) — Pub/Sub, Streams, and Cluster internals
