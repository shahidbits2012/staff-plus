---
sidebar_position: 1
title: System Design Framework
---

# System Design Framework

A structured approach for working through system design problems. This is the template every problem page follows.

## The 10-Step Method

### 1. Requirements

Separate clearly:

- **Functional Requirements (FR)** — what the system must do
- **Non-Functional Requirements (NFR)** — how it must perform (latency, availability, consistency, durability)
- **Out of Scope** — explicitly state what you're NOT designing

:::tip Staff+ Signal
Interviewers watch whether you clarify ambiguity, state assumptions, and set boundaries. Don't just list features — ask about scale, consistency needs, and failure tolerance.
:::

### 2. Scale Assumptions

Back-of-envelope estimation:
- Users (DAU/MAU)
- Read/write ratio
- Data size per entity
- Storage growth per year
- Peak QPS (queries per second)
- Bandwidth

### 3. Core Entities

Identify the key data objects. Keep it minimal — 3-5 entities max. This shapes your data model and API.

### 4. API / Interface

Define the external contract. For each endpoint:
- Method & path (or RPC name)
- Key parameters
- Response shape
- Who calls it (client, internal service, async worker)

### 5. Data Flow

How data moves through the system for the primary use cases. Often a sequence diagram or numbered flow.

### 6. High-Level Design (Satisfying FRs)

Draw the architecture that satisfies all functional requirements. This is the "happy path" design — it works but may not scale or handle failures.

Components: clients, load balancers, API gateway, services, databases, caches, queues, storage.

### 7. Deep Dives (Satisfying NFRs)

This is where Staff+ differentiation happens. For each NFR, explore:

#### Structure per Deep Dive

```
Problem: [What NFR are we solving?]

Approach A: [Name]
  - How it works
  - Pros
  - Cons

Approach B: [Name]
  - How it works
  - Pros
  - Cons

Decision: [Which approach and WHY]
  - Key trade-off being made
  - What we're giving up
  - When we'd revisit this decision
```

Common deep dives:
- **Scaling** — horizontal scaling, sharding, partitioning
- **Consistency** — strong vs eventual, conflict resolution
- **Availability** — replication, failover, graceful degradation
- **Latency** — caching, CDN, read replicas, denormalization
- **Durability** — replication, backups, write-ahead logs
- **Ordering** — sequencing, idempotency, exactly-once

### 8. Bottlenecks & Failure Scenarios

- What happens if [component] goes down?
- What happens at 10x traffic?
- What happens during a network partition?
- Where is the single point of failure?
- What's the blast radius of a bad deploy?

### 9. Trade-offs & Alternatives

Summarize the key trade-offs made across all deep dives. State what you'd do differently if constraints changed.

### 10. Related Concepts

Cross-link to concept pages, pattern pages, and decision pages that this problem exercised.

## Concept Page Structure

When writing concept/pattern pages (not problems), use:

1. Mental model
2. Problem being solved
3. Core mechanism
4. How it works
5. Scaling considerations
6. Consistency implications
7. Failure modes
8. Trade-offs
9. Alternatives
10. Real-world examples
11. Staff+ questions
12. Related concepts
