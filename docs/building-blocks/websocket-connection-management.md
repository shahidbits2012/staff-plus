---
sidebar_position: 3
title: "WebSocket Connection Management at Scale"
---

# WebSocket Connection Management at Scale

## Mental Model

When millions of users hold persistent WebSocket connections to a fleet of servers, two fundamental problems emerge:

1. **Where is User B?** — routing: which server holds a given user's connection
2. **How do servers talk?** — server-to-server communication for message delivery

Every real-time system at scale (chat, ride-hailing, live scores, collaborative editing, gaming) solves these two problems.

## Problem Being Solved

In a small system (1 server), all clients connect to the same server. Routing is trivial — the server has every connection in memory.

At scale (100+ servers), a message sender and recipient are almost certainly on different servers. The system needs:
- A way to **find** which server holds a given connection
- A way to **deliver** a message from one server to another
- A way to **clean up** when connections drop unexpectedly
- Support for **multi-device** (one user, multiple connections on different servers)

## Socket Limits & Server Capacity

Each WebSocket connection = 1 TCP socket = 1 file descriptor. The binding constraint is **memory**, not ports.

| Resource | Limit | Notes |
|----------|-------|-------|
| File descriptors | ~1M per process (tunable via `ulimit`/`sysctl`) | Default is 1024, must be raised |
| Ports | Not a bottleneck | Client connections share the server's listening port; distinguished by `(client IP, client port)` tuple |
| Memory | **The real constraint** | TLS state + read/write buffers + metadata per connection |

### Capacity Planning

| Metric | Formula | Example (500M DAU) |
|--------|---------|-------------------|
| Concurrent connections | DAU × concurrent ratio (typically 10-30%) | 150M |
| Memory per connection | TLS state + buffers + app metadata | ~50KB |
| Connections per server | (Server RAM × allocation %) / per-connection memory | 640K (64GB, 50%) |
| Servers needed | Total connections / connections per server | ~235 |

:::tip Kubernetes Pods
In practice, run fewer connections per pod (100-200K) to leave headroom for GC, spikes, and graceful draining during deploys. This means 750-1500 pods for 150M connections.
:::

## Connection Registry

### The Problem

User A is on Server 47. User B is on Server 182. When A sends a message to B, how does Server 47 know to route to Server 182?

### Approach A: Broadcast to All Servers

Every message is sent to every server. Each server checks if the recipient is locally connected.

| Pros | Cons |
|------|------|
| Simple — no mapping needed | **O(N) fan-out per message** — at 235 servers × 1M msgs/sec = 235M internal messages/sec |
| No single point of failure | Network bandwidth explosion |
| | Doesn't scale beyond ~10 servers |

### Approach B: Consistent Hashing (Sticky Routing)

Hash userId to deterministically route to a specific server. `server = hash(userId) % num_servers`.

| Pros | Cons |
|------|------|
| O(1) lookup — no registry needed | Server add/remove causes **mass reconnection** (rehashing) |
| Simple, deterministic | Multi-device users forced to same server |
| No external dependency | No graceful scaling or failure handling |

:::note Virtual Nodes
Consistent hashing with virtual nodes reduces the rehashing blast radius, but still requires all clients to know the ring topology. At 150M connections, even a small % rehash is millions of reconnections.
:::

### Approach C: ZooKeeper / etcd

Centralized coordination service for the mapping.

| Pros | Cons |
|------|------|
| Strong consistency | **Not designed for millions of keys** — built for small metadata (leader election, config) |
| Watch mechanism for change notification | Write throughput ~10K/sec — far too low for connection churn |
| Mature, battle-tested | ZNode size limits |

**Verdict:** Wrong tool. ZooKeeper/etcd are for coordination (who is the leader?), not for high-throughput key-value lookup (where is this user?).

### Approach D: Redis Cluster

Centralized key-value mapping: `userId → serverId` in Redis.

| Pros | Cons |
|------|------|
| 150M keys is trivial (~20GB memory) | Need TTL + heartbeat for stale entries |
| O(1) lookup, ~1ms latency | Eventually consistent on failover (small window of ~seconds) |
| Multi-device support naturally (hash per user → set of connections) | Redis is an infrastructure dependency |
| Server add/remove is seamless — no rehashing | |
| Built-in sharding across cluster nodes | |

### Approach E: In-Memory with Gossip Protocol

Each server maintains a partial connection map, synchronized via gossip (like Cassandra's membership).

| Pros | Cons |
|------|------|
| No central dependency | Convergence delay → stale routes during propagation |
| Partition-tolerant | N servers × M connections = massive gossip payload |
| | Complex to implement correctly |

### Decision Guide

| Scale | Recommendation |
|-------|---------------|
| < 10 servers | Broadcast — simple and effective |
| 10-50 servers | Consistent hashing with virtual nodes |
| 50+ servers, high connection churn | **Redis Cluster** — O(1) lookup, seamless scaling |
| Extreme partition tolerance needed | Gossip + CRDT (rare, complex) |

### Redis Cluster Implementation

```
On connect:    HSET conn:{userId} "server-182:conn-abc" {timestamp}
On disconnect: HDEL conn:{userId} "server-182:conn-abc"
On route:      HGETALL conn:{recipientId} → [{serverId, connId}, ...]
```

**TTL + Heartbeat for stale cleanup:**
- Client sends heartbeat every 30s → server refreshes TTL to 60s
- Clean disconnect → explicit `HDEL`
- Unclean disconnect (crash, network drop) → TTL expires after 60s
- Server-side sweep every 30s to proactively clean connections that stopped heartbeating

**Multi-device:** Each userId maps to a **set** of `(serverId, connectionId)` pairs. Message delivery fans out to all active devices.

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Server crash** | All connections on that server drop | Client auto-reconnect with jitter (random 0-5s delay); connection registry TTL cleans stale entries |
| **Redis Cluster node failure** | Routing lookups for affected shard fail | Redis auto-failover to replica (~seconds); fallback to broadcast during failover window |
| **Stale registry entries** | Messages routed to wrong server | TTL expiry + heartbeat sweep; recipient server drops unroutable messages |
| **Thundering herd on deploy** | Mass reconnection spike | Graceful drain: server stops accepting new connections, drains existing over 30s; client reconnect jitter |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Redis Cluster over ZooKeeper | Higher throughput, eventual (not strong) consistency on failover |
| Redis Cluster over consistent hashing | External dependency for seamless scaling without rehash storms |
| TTL-based cleanup over explicit tracking | Stale entries possible for up to TTL duration after unclean disconnect |

## Real-World Examples

| System | Connection Management | Notes |
|--------|----------------------|-------|
| **WhatsApp** | Custom Erlang servers, ~2M connections per server | BEAM VM handles cross-node routing natively |
| **Discord** | Elixir/Erlang, consistent hashing + registry | Guild-based routing |
| **Slack** | Go-based gateway servers | Redis for connection state |
| **Uber** | Custom Go servers, Ringpop (gossip) for routing | Gossip-based service discovery |

## Related Concepts

- [Server-to-Server Communication](/building-blocks/server-to-server-communication) — once you know the destination server, how to deliver the message
- [API Gateway](/building-blocks/api-gateway) — L4 vs L7 load balancing for WebSocket connections
- [Redis](/building-blocks/redis) — Redis Cluster internals for the connection registry
