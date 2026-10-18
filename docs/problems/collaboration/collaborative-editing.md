---
sidebar_position: 2
title: "Collaborative Editing (e.g. Google Sheets)"
---

# Collaborative Editing

Design a system that allows multiple users to simultaneously edit a shared spreadsheet in real time, seeing each other's changes and cursors within milliseconds — like Google Sheets, Notion, or Figma.

## 1. Requirements

### Functional Requirements
1. **FR1**: Multiple users can open the same document and edit cells concurrently — all participants see every change within 1 second
2. **FR2**: Each user sees other users' cursor positions and active selections in real time
3. **FR3**: Concurrent edits to different cells apply without conflict; concurrent edits to the same cell are resolved deterministically (last-writer-wins or merge) so all clients converge to the same state
4. **FR4**: Users can undo/redo their own recent changes without undoing other users' changes
5. **FR5**: Document state is persisted — reopening a document shows the latest version with full edit history available

### Non-Functional Requirements (LSDARO)
1. **NFR1 — Latency**: Local edit appears instantly (optimistic); remote edits visible on other clients within 200ms (p99) — perceived real-time collaboration
2. **NFR2 — Scale**: Support up to 100 concurrent editors per document; up to 1M active documents; up to 10M cells per document
3. **NFR3 — Durability**: Zero data loss — every acknowledged edit must be durable. Edit history retained for audit and time-travel.
4. **NFR4 — Availability**: 99.99% — documents must remain viewable (read-only fallback) even if the collaboration layer degrades
5. **NFR5 — Resiliency**: A collaboration server crash must not lose unacknowledged edits (clients hold local state and retry); new server picks up the document session within seconds
6. **NFR6 — Observability**: Operation throughput per document, conflict rate, transform latency, client-server round-trip time, document size growth rate

### Out of Scope
- Spreadsheet formula evaluation engine (assume a formula engine exists; we focus on the collaboration layer)
- Permissions and sharing (view/edit/comment access control) — assume access is resolved upstream
- Charts, pivot tables, and data visualization features
- Import/export (CSV, Excel)
- Comments and suggestion mode
- Mobile-specific offline editing and sync
