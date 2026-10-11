---
sidebar_position: 2
title: Live Comments (e.g. FB / Instagram Live)
---

# Live Comments

Design a real-time comment system for live streaming — the comment overlay viewers see during a Facebook/Instagram Live broadcast.

## 1. Requirements

### Functional Requirements
1. **FR1**: User should be able to post a comment on a live stream in real-time
2. **FR2**: User should see all comments from other viewers in near real-time; users joining mid-stream should see recent comments posted before they joined
3. **FR3**: User should be able to react to a comment (like, emoji)
4. **FR4**: Comments are ephemeral — visible only during the live session, not persisted after stream ends
5. **FR5**: Streamer should be able to pin a comment to the top
6. **FR6**: Streamer/moderator should be able to delete a comment

### Non-Functional Requirements (LSDARO)
1. **NFR1 — Latency**: Comment should appear on all viewers' screens within 500ms of posting
2. **NFR2 — Scale**: Support 1M+ concurrent viewers on a single stream; 10K comments/sec on a viral stream
3. **NFR3 — Durability**: Comments are ephemeral — no persistence after stream ends. Loss of a comment during delivery is acceptable (best-effort)
4. **NFR4 — Availability**: 99.9% uptime; comment delivery can degrade gracefully (drop/sample comments) under extreme load rather than take down the stream
5. **NFR5 — Resiliency**: System should handle viewer spikes (celebrity goes live) without affecting other streams; isolate blast radius per stream
6. **NFR6 — Observability**: Comments/sec per stream, delivery latency p99, dropped comment rate, active viewer count

### Out of Scope
- Video/audio streaming infrastructure — we only handle the comment overlay
- Comment moderation / spam filtering / toxicity detection — separate ML pipeline
- Comment persistence / history / replay after stream ends
- Threaded replies / conversations within comments
- Monetization (Super Chat / paid comments)
- User authentication — assume identity is resolved upstream
