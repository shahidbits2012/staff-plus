---
sidebar_position: 11
title: "Push Notifications (APNs / FCM)"
---

# Push Notifications (APNs / FCM)

:::note Placeholder
Stub page. To be fleshed out following the Concept/Reference template.
:::

## Mental Model

A best-effort signal to wake an app or alert a user on a device the server cannot reach directly — delivered through platform gateways (APNs for iOS, FCM for Android).

## Problem Being Solved

_TODO: Reaching offline/backgrounded clients that hold no live connection._

## Core Mechanism

_TODO: Device tokens, platform gateways, payload size limits (~4KB), priority tiers._

## How It Works

_TODO: Token registration, server → APNs/FCM → device, silent vs alert pushes._

## Scaling Considerations

_TODO: Per-platform rate limits, batching/coalescing, token lifecycle & invalidation._

## Failure Modes

_TODO: Best-effort delivery, no ordering, token expiry, throttling by platform._

## Trade-offs

_TODO: Reach vs guarantees — push is a signal, not a delivery channel._

## Real-World Examples

_TODO: WhatsApp encrypted-preview trick (preview built on sender device)._

## Related Concepts

- [Server-to-Server Communication](/building-blocks/server-to-server-communication)
- [Presence & Heartbeat](/patterns/presence-heartbeat)
