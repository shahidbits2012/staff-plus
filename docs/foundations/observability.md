---
sidebar_position: 2
title: Observability
---

# Observability

## Mental Model

Monitoring tells you **that** something is wrong. Observability lets you work out **why**, including for failures you didn't predict.

A useful way to organize it is as a **stack of layers**, from the machine up to the user. Each layer answers a different question:

| Layer | Question it answers | Method |
|-------|--------------------|--------|
| **Client / End-to-end** | Is the user getting what we promised? | Real-user monitoring (RUM), synthetic probes |
| **Business / Product** | Is the product doing its job? | Domain KPIs vs baseline |
| **Application / Service** | Is each service serving requests well? | **RED**: Rate, Errors, Duration |
| **Dependencies (DB / Cache / Queue)** | Are the things we call healthy? | Latency, saturation, lag, errors per dependency |
| **Infrastructure / System** | Are the machines healthy? | **USE**: Utilization, Saturation, Errors |

**Alert on the top of the stack (symptoms), debug down the stack (causes).** Users feel symptoms. Causes are only interesting once a symptom exists.

## Problem Being Solved

Distributed systems fail **partially**. Every service can report "healthy" while users see stuck messages, because the failure is in the gap between services: a lagging consumer, a stale cache, a retry storm, a silently open circuit breaker.

Without layered observability:
- Outages are detected by users, on social media, before your dashboards
- Every incident starts with "which of the 40 services is it?"
- **Silent failures** (fail-open paths, dropped messages, best-effort pipelines) are never detected at all
- Capacity problems are found at peak, not weeks before

## Core Mechanism

Three signal types, each with a different cost/detail trade-off:

| Signal | What it is | Cost | Best for |
|--------|-----------|------|----------|
| **Metrics** | Numeric time series, pre-aggregated (counters, gauges, histograms) | Cheap, fixed cost per series | Dashboards, alerting, trends, SLOs |
| **Logs** | Discrete, structured events with context | Expensive at volume | Forensics: "what exactly happened to request X?" |
| **Traces** | Causally-linked spans across services for one request | Expensive, so sampled | "Where did the latency go?" across hops |

They are linked by shared identifiers. An **exemplar** attaches a trace ID to a histogram bucket, so a p99 spike on a dashboard can be clicked through to an actual slow trace, then to its logs.

## How It Works

### Layer 1: Infrastructure / System (USE method)

For every **resource**, check **U**tilization, **S**aturation, **E**rrors.

| Resource | Utilization | Saturation | Errors |
|----------|------------|-----------|--------|
| CPU | % busy | Run-queue length, throttling (cgroup) | — |
| Memory | % used | Swap, OOMKills, GC pause time | Allocation failures |
| Network | Bandwidth % | Dropped packets, retransmits | Interface errors |
| Disk | % busy, space used | I/O wait, queue depth | Device errors |
| File descriptors | Open fds / limit | — | `EMFILE` errors |
| Pods / Nodes | Replicas running vs desired | Pending pods | Restarts, crash loops |

**Why it matters:** these are leading indicators for capacity and the usual root causes of latency. For example, GC pauses show up as p99 spikes, and fd exhaustion shows up as connection refusals.

### Layer 2: Dependencies (DB / Cache / Queue)

Every dependency is a remote resource. Measure it **from the caller's side** (what your service actually experiences) and **from the server's side** (what the dependency thinks is happening).

| Dependency | Key metrics | Classic failure it reveals |
|-----------|-------------|---------------------------|
| **Relational DB** | Query p99, connection-pool usage/wait, replication lag, locks/deadlocks, slow queries | Pool exhaustion, stale reads from replicas |
| **Wide-column / NoSQL** | Read/write p99 per table, tombstones, compaction backlog, hot partitions | Hot partition, compaction storms |
| **Cache (Redis)** | Hit ratio, ops/sec, memory vs maxmemory, **evictions**, latency, replication offset | Silent data loss via eviction, cache stampede |
| **Queue / Log (Kafka, Streams)** | **Consumer lag** (messages and seconds), publish latency, under-replicated partitions, DLQ depth | Slow consumers, poison messages |
| **Object storage** | Request errors (4xx/5xx), latency, throttling | Throttling at prefix hot spots |
| **Downstream services** | Call rate/errors/latency per endpoint, retries, circuit-breaker state, timeouts | Retry storms, cascading failure |

:::tip Lag in seconds beats lag in messages
"50K messages behind" means nothing without throughput. "Consumer is 40 seconds behind" maps directly to a user-facing SLO. Alert on time-lag.
:::

### Layer 3: Application / Service (RED method)

For every **request type** (endpoint, RPC, WebSocket frame type, consumer), measure:

- **R**ate: requests per second
- **E**rrors: failed requests per second (split by class: client 4xx vs server 5xx vs timeout)
- **D**uration: latency **distribution** as a histogram (p50 / p99 / p99.9), never just averages

Plus internal saturation signals the service owns: thread-pool/worker utilization, in-process queue depth, in-flight requests, circuit-breaker state, rate-limit rejections, feature-flag state.

:::note Averages lie
Mean latency hides tail latency. A request that fans out to 100 backends experiences roughly the p99 of each backend: 1 - 0.99^100 ≈ 63% of such requests hit at least one p99 call. Track percentiles via histograms. You can't average percentiles across pods, but you can merge histograms.
:::

### Layer 4: Business / Product KPIs

Domain metrics that only your system can produce: orders/sec, messages delivered/sec, comments/sec per stream, payment success rate, rejection rate.

**Why they matter:** they catch failures that all technical metrics miss. If every service is green but checkouts dropped 30% vs last week, something is broken: a bad deploy that returns 200 with an empty payload, a broken client, a third-party outage. Compare against **seasonal baselines** (same hour last week), not static thresholds.

### Layer 5: Client / End-to-end

What the user actually experiences, measured where they are:

- **RUM (real-user monitoring):** client-reported latency (e.g. time from send to delivery receipt), connect success rate, crash rate, reconnect rate
- **Synthetic probes:** canary users or tenants exercising critical paths continuously from multiple regions. These are the only way to detect "nothing is happening" failures at 3am with no traffic.

Server-side latency excludes the last mile, TLS handshakes, DNS, client queueing and retries. An end-to-end SLO must be measured end-to-end.

### SLIs, SLOs, and Error Budgets

| Term | Definition | Example |
|------|-----------|---------|
| **SLI** | A ratio of good events to valid events | % of messages delivered in under 500ms |
| **SLO** | Target for the SLI over a window | 99.9% over 28 days |
| **Error budget** | 1 - SLO, the failure you are allowed | 0.1% ≈ 40 min/month of "bad" |

The error budget turns reliability into a decision tool. Budget left: ship faster. Budget burned: freeze risky changes and invest in reliability.

### Alerting Strategy

| Principle | Why |
|-----------|-----|
| **Page on symptoms, ticket on causes** | Users don't care that CPU is at 90%; they care that p99 latency doubled. Cause alerts are noisy and often self-heal. |
| **Burn-rate alerts** on SLOs | Alert when the error budget burns fast (e.g. 14× rate over 1h **and** 5m). Catches real incidents quickly and ignores blips. |
| **Exceptions page directly** | Fast, irreversible causes: disk full imminent, cache evictions where eviction means data loss, a stuck consumer, an open circuit breaker on a fail-open path |
| **Every page has a runbook** | An alert without an action is noise |
| **Alert on absence** | "Zero traffic" or "zero rejections" can be the failure (dead pipeline, limiter not enforcing) |

### Distributed Tracing

- Propagate context (W3C `traceparent`) across **every** hop, including async ones: put it in Kafka headers, stream entries and WebSocket frames
- For fan-out (1 → N), use **span links** rather than one giant trace
- **Sampling:** head-based (e.g. 1%) is cheap but misses rare failures. Tail-based keeps 100% of slow or errored traces. Combine both.

### Logs

- **Structured** (JSON) with trace ID, request ID and entity IDs as fields, never free text only
- **Sample** high-volume success logs. Keep all errors.
- **Never log secrets or user content.** This is a hard rule for E2E-encrypted systems: log metadata only.

## Scaling Considerations

### Cardinality is the cost driver

A metric's cost is its number of **unique label combinations** (series). `requests_total` with labels `endpoint × status × pod` is about 50 × 5 × 200 = 50K series, which is fine. Add `user_id` and it becomes 50K × 100M, which crashes the metrics backend.

| Need | Wrong tool | Right tool |
|------|-----------|-----------|
| "Is it broken?" | — | Metrics with **bounded** labels |
| "Which user / tenant / key is affected?" | `user_id` as a metric label | **Traces + logs** (high cardinality is free there), exemplars |
| "Who are the top offenders?" | Per-entity series | **Streaming top-K sketches** (Space-Saving, Count-Min) emitting only the top N |

### Other scaling concerns

- **Aggregation at the edge:** pre-aggregate in-process (histograms, counters) and ship deltas, not raw events
- **Retention tiers:** keep high resolution for days, downsample for months
- **Telemetry must not take down the app:** use async, bounded buffers and drop telemetry before dropping traffic
- **Meta-monitoring:** monitor the monitoring pipeline itself (scrape failures, ingestion lag)

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Cardinality explosion** | Metrics backend OOMs, dashboards blank during an incident | Label allow-lists, cardinality limits per metric, review in CI |
| **Alert fatigue** | Real pages ignored | Symptom-based paging, burn-rate alerts, delete alerts nobody acts on |
| **Silent failure** (fail-open, dropped best-effort data) | System "healthy" while not doing its job | Alert on absence, on breaker-open duration, on business KPIs vs baseline |
| **Missing context across async hops** | Traces break at queues, so root cause is invisible | Propagate trace context in message headers |
| **Telemetry outage during incident** | Flying blind exactly when needed | Independent monitoring stack, meta-monitoring, local fallbacks |
| **Averages hide tail** | p99 users suffer while dashboards look fine | Histograms + percentiles, per-tier breakdowns |
| **Sensitive data in logs** | Compliance breach | Redaction at source, structured fields allow-list |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| More metrics/labels | Faster diagnosis vs cost and backend stability |
| Head-based vs tail-based sampling | Cheap and simple vs catching rare slow/error traces (needs a buffering collector) |
| Static thresholds vs SLO burn rates | Easy to set vs fewer false pages tied to user impact |
| Push vs pull metrics | Push works for short-lived jobs and firewalls; pull gives easy liveness detection and central control |
| Log everything vs sample | Complete forensics vs storage cost and I/O on the hot path |

## Real-World Examples

| Company / Tool | Practice |
|----------------|----------|
| **Google SRE** | Four golden signals (latency, traffic, errors, saturation); SLOs and error budgets |
| **Netflix** | Atlas (dimensional metrics at massive scale), stream-start SPS as the key business KPI |
| **Uber** | Jaeger (distributed tracing), M3 (metrics) |
| **Honeycomb** | High-cardinality event-based observability |
| **Prometheus / Grafana / OpenTelemetry** | De facto open-source stack: OTel for instrumentation, Prometheus for metrics, Tempo/Jaeger for traces, Loki for logs |

## Related Concepts

- [Circuit Breaker](/patterns/circuit-breaker) — breaker state is a key application-level signal
- [Bulkhead](/patterns/bulkhead) — per-pool saturation metrics verify isolation works
- [Failure Thinking](../staff-plus/failure-thinking.md) — designing for, and detecting, partial failure
- [Kafka](/building-blocks/kafka) — consumer lag as the core queue health signal
- [Redis](/building-blocks/redis) — evictions, memory and latency monitoring
