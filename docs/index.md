---
sidebar_position: 1
slug: /intro
title: Welcome
---

# Staff Prep

**System design & DSA prep for Staff+ engineers.**

Every page answers **why, how, trade-offs, and failure modes** — not just definitions.

---

## Getting Started

| Section | What's Inside |
|---------|--------------|
| **[Guide](/method/framework)** | Foundations, distributed systems, building blocks, patterns, and architectural decisions |
| **[Problems](/problems/messaging/chat-system)** | System design problems with deep-dive trade-off analysis |
| **[Reference](/reference/patterns-cheatsheet)** | Quick-reference cheat sheets for patterns, decisions, and scaling |

---

## How Problems Are Structured

Each problem follows a consistent 10-step template:

1. **Requirements** — FR / NFR / out of scope
2. **Core Entities** — key data objects
3. **API / Interface** — protocols, frames, endpoints
4. **High-Level Design** — minimal architecture satisfying FRs
5. **Deep Dives** — one per NFR: approaches → pros/cons → decision + trade-off
6. **Bottlenecks & Failure Scenarios** — what breaks, impact, mitigation
7. **Trade-offs & Alternatives** — summary of all decisions
8. **Related Concepts** — cross-links to reusable concept pages

Scale Assumptions live in an Appendix at the bottom.

---

## How Concepts Are Structured

Each concept / building-block page covers:

1. Mental model
2. Problem being solved
3. Core mechanism
4. How it works
5. Scaling considerations
6. Failure modes
7. Trade-offs
8. Real-world examples
9. Related concepts

---

## Mental Hierarchy

> **Why → How → With what → Applied where**

| Layer | Examples |
|-------|---------|
| **Concept** | Consistency, replication, sharding |
| **Pattern** | CQRS, Saga, Outbox, Circuit Breaker |
| **Technology** | Kafka, Redis, PostgreSQL, Cassandra |
| **Decision** | Why choose X over Y |
| **Problem** | Applying concepts + patterns to a real system |
