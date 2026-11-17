---
sidebar_position: 2
title: "Google Maps (Navigation & ETA)"
sidebar_class_name: vt-draft
status: draft
summary: "Map tile rendering, driving directions with shortest-path routing, and real-time ETA updates with live traffic data."
---

# Google Maps

Design a system that renders interactive maps, computes driving directions between two points, and provides real-time ETA estimates — like Google Maps, Apple Maps, or Waze.

## 1. Requirements

### Functional Requirements
1. **FR1**: Client can view a map of any region at any zoom level — the system returns pre-rendered map tiles for the viewport
2. **FR2**: Client can search for a place by name or address and receive its coordinates (geocoding)
3. **FR3**: Client can request driving directions between an origin and destination — the system returns a route (sequence of road segments) with distance and estimated duration
4. **FR4**: Client can receive a real-time ETA that updates as they drive, incorporating live traffic conditions

### Non-Functional Requirements (LSDARO)
1. **NFR1 — Latency**: Tile load &lt;200ms (p99); route computation &lt;500ms (p99) for continental-scale queries; ETA updates &lt;100ms
2. **NFR2 — Scale**: ~1B daily active users, ~50B tile requests/day, ~5B route queries/day — the read path must handle extreme fan-out
3. **NFR3 — Availability**: 99.99% — navigation is safety-critical; degraded routing (stale traffic) is better than no routing
4. **NFR4 — Resiliency**: Stale-but-available over fresh-but-down — serve cached tiles and static routes if the live traffic pipeline fails
5. **NFR5 — Observability**: Tile cache hit ratio, route computation latency distribution, traffic data freshness, ETA accuracy drift (predicted vs actual)

### Out of Scope
- Turn-by-turn voice navigation UX (client-side rendering concern)
- Public transit / walking / cycling routing (focus on driving)
- Street View imagery
- Offline maps (pre-downloaded tile packs)
- Business listings, reviews, and place details (Google Places API)
- Map editing and crowdsourced corrections
