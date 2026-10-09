---
sidebar_position: 2
title: "API Gateway: Roles & Responsibilities"
---

# API Gateway: Roles & Responsibilities

## Mental Model

An API Gateway is the **single entry point** between external clients and internal services. It handles cross-cutting concerns (auth, TLS, routing, rate limiting) so that backend services don't have to.

Think of it as a bouncer + receptionist: it checks your ID (authentication), decides which room you go to (routing), and controls how many people enter per minute (rate limiting).

## Problem Being Solved

Without a gateway, every backend service must independently handle:
- TLS termination
- Authentication / token validation
- Rate limiting
- Request routing
- Protocol translation (HTTP → gRPC, HTTP → WebSocket)
- Logging, metrics, tracing

This duplicates logic, increases attack surface, and couples clients to internal service topology.

## Core Roles

| Role | What It Does |
|------|-------------|
| **Routing** | Routes requests to the correct backend service based on path, headers, or protocol |
| **TLS Termination** | Handles HTTPS/TLS at the edge; backend services communicate in plaintext internally |
| **Authentication** | Validates auth tokens (JWT, session) on every request before forwarding |
| **Rate Limiting** | Throttles requests per user/IP to protect backend from abuse |
| **Load Balancing** | Distributes traffic across multiple instances of a service |
| **Protocol Translation** | Upgrades HTTP → WebSocket, translates REST → gRPC, etc. |
| **Request/Response Transformation** | Adds headers, strips sensitive fields, compresses responses |
| **Observability** | Centralized logging, metrics, distributed tracing injection |

## L4 vs L7 Load Balancing

### L4 — Transport Layer (TCP/UDP)

Operates at the TCP level. Sees only IP addresses and ports. Forwards raw TCP connections without inspecting content.

```
Client → [L4 LB sees: src IP, dst IP, port] → Backend
```

| Pros | Cons |
|------|------|
| Very fast — no packet inspection | Cannot route by path, header, or cookie |
| Low latency (~0.1ms added) | Cannot terminate TLS (or if it does, can't inspect decrypted content) |
| Handles any protocol (TCP, UDP, WebSocket, gRPC) | No content-based decisions |
| Simple, fewer failure modes | Cannot inject auth, headers, or do request transformation |
| Scales to millions of connections | All traffic to same backend pool |

**Use when:** You need raw throughput, protocol-agnostic load balancing, or a pass-through proxy in front of an L7 gateway.

**Examples:** AWS NLB, HAProxy (TCP mode), Linux IPVS

### L7 — Application Layer (HTTP/HTTPS)

Operates at the HTTP level. Can inspect headers, paths, cookies, query parameters. Understands the application protocol.

```
Client → [L7 LB sees: path, headers, cookies, method] → Backend
```

| Pros | Cons |
|------|------|
| Path-based routing (`/ws` → WebSocket servers, `/api` → REST servers) | Higher latency (~1-2ms added) |
| Can terminate TLS and inspect content | More complex, more failure modes |
| Can validate auth tokens at the edge | Must understand the protocol (HTTP-specific) |
| Can inject/strip headers | Slightly lower throughput than L4 |
| Sticky sessions based on cookies/headers | |
| Can handle HTTP → WebSocket upgrade | |

**Use when:** You need content-based routing, authentication at the gateway, multiple backend pools, or protocol translation.

**Examples:** AWS ALB, Nginx, Envoy, Kong, Traefik

### Decision Guide

| Scenario | Choose |
|----------|--------|
| Single protocol, raw throughput needed | L4 |
| Multiple services behind one domain | L7 |
| Need auth at the gateway | L7 |
| WebSocket + REST on same endpoint | L7 |
| Need path-based routing | L7 |
| UDP traffic (gaming, DNS) | L4 |
| TLS passthrough to backend | L4 |

**Common pattern:** L4 in front of L7. An NLB (L4) distributes TCP connections across multiple Nginx/Envoy (L7) instances. The L4 handles connection distribution; the L7 handles content-aware routing.

## Authentication at the Gateway

### The Flow

1. User authenticates via a separate **Auth Service** → receives a JWT (or session token)
2. Client includes the token in every request:
   - HTTP: `Authorization: Bearer <token>` header
   - WebSocket: token in the upgrade request headers or as a query parameter
3. API Gateway validates the token:
   - Checks signature (JWT public key verification — no Auth Service call needed)
   - Checks expiry
   - Extracts userId, roles, permissions
4. If valid → forwards request to backend with userId injected as a trusted header
5. If invalid → returns 401, connection rejected

### WebSocket Authentication

WebSocket connections start as an HTTP upgrade request. Auth happens **once at connection establishment**, not per message:

```
GET /ws HTTP/1.1
Upgrade: websocket
Authorization: Bearer <jwt-token>

→ Gateway validates JWT
→ If valid: upgrade to WebSocket, connection is now authenticated
→ If invalid: 401, no WebSocket established
```

After the upgrade, the WebSocket connection is the authenticated session. No per-message auth overhead.

**Token expiry during connection:** Gateway or backend can close the WebSocket when the JWT expires, forcing re-auth. Or use a refresh token mechanism over the WebSocket itself.

### Gateway Auth vs Service Auth

| Concern | Where |
|---------|-------|
| **Authentication** (who are you?) | API Gateway — validate token, extract identity |
| **Authorization** (can you do this?) | Backend service — check permissions against business rules |

The gateway should NOT make authorization decisions. It only answers "is this a valid, authenticated user?" The backend service answers "is this user allowed to send a message to this chat?"

## Load Balancing Algorithms

| Algorithm | How It Works | Best For |
|-----------|-------------|----------|
| **Round Robin** | Rotate through servers sequentially | Equal-capacity servers, stateless services |
| **Weighted Round Robin** | Round robin with weights per server | Mixed-capacity servers |
| **Least Connections** | Route to server with fewest active connections | Long-lived connections (WebSocket) |
| **Least Response Time** | Route to fastest-responding server | Latency-sensitive services |
| **IP Hash** | Hash client IP to pick server | Sticky sessions without cookies |
| **Consistent Hashing** | Hash key maps to ring position → nearest server | Caching layers, sticky routing with minimal rehash on scale |
| **Random** | Pick a server randomly | Surprisingly effective at scale (power of two random choices) |

**For WebSocket connections:** Least Connections is typically best — it ensures new connections go to the least-loaded server, which matters when connections are long-lived and each consumes memory.

## TLS Termination

**TLS termination at the gateway** means the gateway handles the TLS handshake and decryption. Backend services receive plaintext HTTP.

```
Client ──[HTTPS/TLS]──→ API Gateway ──[HTTP plaintext]──→ Backend
```

| Pros | Cons |
|------|------|
| Backend services are simpler (no TLS config) | Traffic between gateway and backend is unencrypted |
| Centralized certificate management | Must trust the internal network |
| Gateway can inspect and route based on content | |
| Reduces CPU load on backend (TLS is expensive) | |

**Mitigation for internal plaintext:** Use mutual TLS (mTLS) between gateway and backends if the internal network is not fully trusted, or if compliance requires encryption in transit everywhere.

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Gateway crashes | All traffic drops | Multiple gateway instances behind L4 LB; health checks |
| Auth service down | Can't validate tokens | JWT validation is local (public key) — no Auth Service call needed for validation |
| Certificate expiry | TLS handshake fails, all clients get errors | Automated cert renewal (Let's Encrypt, cert-manager) |
| Gateway overload | Increased latency, dropped connections | Auto-scaling, rate limiting, circuit breaker to backend |
| Misconfigured routing | Traffic goes to wrong service | Canary deployments, config validation in CI |

## Real-World Examples

| Product | Gateway | Notes |
|---------|---------|-------|
| Netflix | Zuul → Spring Cloud Gateway | Custom L7 gateway with dynamic routing |
| Amazon | AWS API Gateway | Managed, per-request pricing |
| Uber | Custom Envoy-based | L7 with mTLS, service mesh integration |
| Cloudflare | Custom | L4 + L7 at edge, Anycast routing |

## Related Concepts

- [Consistency Models](/foundations/consistency)
- [Message Queues](/building-blocks/message-queues)
