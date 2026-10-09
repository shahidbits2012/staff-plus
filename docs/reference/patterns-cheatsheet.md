---
sidebar_position: 1
title: Patterns Cheat Sheet
---

# Architecture Patterns Cheat Sheet

_TODO: Quick reference — will be built incrementally as patterns are covered in problems._

| Pattern | When to Use | Key Trade-off |
|---------|-------------|---------------|
| CQRS | Read/write ratio > 10:1 | Complexity vs read performance |
| Event Sourcing | Audit trail, temporal queries | Storage vs queryability |
| Saga | Distributed transactions | Consistency vs availability |
| Circuit Breaker | External dependencies | Latency vs availability |
| Outbox | Reliable event publishing | Complexity vs exactly-once |
