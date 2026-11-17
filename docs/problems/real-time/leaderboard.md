---
sidebar_position: 4
title: "Leaderboard (e.g. Gaming / Spotify Charts)"
sidebar_class_name: vt-draft
status: draft
summary: "Real-time leaderboard with full ranking, arbitrary rank lookup, pagination, and score updates for gaming or charts."
---

# Leaderboard

_Coming soon._ Design a system that supports real-time rank lookup for any item, pagination at arbitrary offsets, and score updates — the full ranking problem that [Top-K Heavy Hitters](/problems/real-time/top-k) explicitly scopes out.

**Key differences from Top-K:**

| | Top-K | Leaderboard |
|---|---|---|
| Core question | "What are the most popular items?" | "Where does item X rank?" |
| Data needed | Only top K items | Full ranking of all items |
| Hard problem | Ingestion throughput + approximate counting | Real-time rank computation + pagination |
| Examples | YouTube trending, Twitter trending | Gaming leaderboard, Spotify charts, Stack Overflow reputation |
