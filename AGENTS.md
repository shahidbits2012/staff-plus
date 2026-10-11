# Staff Prep — Agent Instructions

## Content Philosophy

This is an architecture handbook for Staff+ Engineer preparation. Every page must answer **why, how, trade-offs, and failure modes** — not just definitions.

## Content Management Rules

### Separation of Concerns

- **System Design Problem pages** contain the solution for a specific problem (e.g., Chat System, URL Shortener). They should NOT contain generic explanations of concepts, tools, or patterns.
- **Concept / Reference pages** contain reusable knowledge (e.g., "API Gateway: Roles & Responsibilities", "Consistency Models", "Message Queues"). These live under `docs/foundations/`, `docs/building-blocks/`, `docs/patterns/`, `docs/decisions/`, `docs/staff-plus/`, or `docs/reference/`.
- **When a problem solution touches a generic topic** (like L4 vs L7 load balancing, authentication flows, CAP theorem), that topic belongs in a concept/reference page. The problem page should **hyperlink** to it, not inline the explanation.

### The Rule: Link, Don't Inline

If a concept applies to more than one system design problem, it belongs in its own page. The problem page links to it. This avoids duplication and keeps problem pages focused on the specific design.

Example:
- ✅ Problem page says: "We use an [L7 API Gateway](/building-blocks/api-gateway) for path-based routing and auth token validation on the WebSocket upgrade handshake."
- ❌ Problem page contains a 500-word explanation of L4 vs L7 load balancers.

### Authoring Workflow

1. **Discussion first.** The user discusses a system design problem section by section. Do NOT update the file during discussion.
2. **Publish on request.** Only update the markdown file when the user explicitly says to publish/update.
3. **Problem-first authoring.** Problems are the primary authoring driver. Concepts and reference pages get created/populated as problems surface them — not breadth-first across all topics.
4. **Extract and link.** When a discussion surfaces a reusable concept, create a concept/reference page for it and link from the problem page.

### Problem Page Template (10-Step)

Every system design problem follows this structure:

1. **Requirements** — Functional (numbered), Non-Functional (use **LSDARO** framework, numbered), Out of Scope
2. **Core Entities** — 3-5 key data objects with brief descriptions
3. **API / Interface** — Client→Server frames, Server→Client frames, REST APIs (cold path)
4. **High-Level Design** — Architecture diagram + data model + how each FR is satisfied
5. **Deep Dives** — One per NFR. Each deep dive: approaches → pros/cons → decision + trade-off
6. **Bottlenecks & Failure Scenarios** — Table: scenario, impact, mitigation
7. **Trade-offs & Alternatives** — Summary table of all decisions made
8. **Related Concepts** — Cross-links to concept/reference pages

Scale Assumptions go in an **Appendix** at the bottom, not as a top-level section.

### Concept / Reference Page Template

1. Mental model
2. Problem being solved
3. Core mechanism
4. How it works
5. Scaling considerations
6. Failure modes
7. Trade-offs
8. Real-world examples
9. Related concepts

### Deep Dive Structure

Every deep dive within a problem page follows:

```
Problem: [What NFR are we solving?]

Approach A: [Name]
  - How it works
  - Pros / Cons

Approach B: [Name]
  - How it works
  - Pros / Cons

Decision: [Which approach and WHY]
  - Key trade-off
  - What we're giving up
  - When to revisit
```

### LSDARO — NFR Framework

Every problem page should evaluate NFRs using the **LSDARO** checklist. Not every dimension applies to every problem — include only those that drive architectural decisions, but always consider all six:

1. **L**atency — response time SLOs (p50, p99)
2. **S**cale — throughput (rps), data volume, concurrent users
3. **D**urability — zero data loss guarantees, persistence requirements
4. **A**vailability — uptime SLO (99.9%, 99.99%), fail-open vs fail-closed
5. **R**esiliency — fault tolerance across component failures, graceful degradation
6. **O**bservability — metrics, alerting, tracing required for operations

## Content Rules

- Keep problem pages focused on the specific design decisions. Generic knowledge → separate page + link.
- All entities, schemas, and data models discussed during the design conversation should be reflected in the HLD section. Data models use tabular format: `Field | Type | Description | Example`.
- Media metadata (URL, type, size) is embedded in the Message entity for simplicity. Revisit if media pipeline becomes a deep dive.
- Message rows are ephemeral — deleted after all participants ACK (E2E encryption model).
- Receipts (delivered/read) use MessageStatus table (updated in-place), NOT the Inbox table (avoids write amplification).
- Receipts are fire-and-forget over WebSocket when recipient is online. Missed receipts are synced via `SYNC_SENT_STATUS` on reconnect from the MessageStatus table.

## File Format

- Problem pages use `.md` extension (not `.mdx`) to avoid JSX parsing issues with curly braces in code/schemas.
- If JSX is needed (e.g., iframe with style object), the style must use JSX syntax `style={{...}}` and any curly braces in prose/tables must be wrapped in backticks.
- Mermaid diagrams work in `.md` files (enabled via `docusaurus.config.ts`).
- Use `:::info`, `:::note`, `:::tip` for callout boxes.
