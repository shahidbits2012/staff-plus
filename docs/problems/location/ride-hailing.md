---
sidebar_position: 3
title: "Ride Hailing (e.g. Uber / Lyft)"
---

# Ride Hailing

Design a system that matches riders with nearby drivers in real time, tracks trip progress, computes fares, and handles surge pricing — like Uber, Lyft, or Grab.

## 1. Requirements

### Functional Requirements
1. **FR1**: Rider can request a ride by specifying pickup and dropoff locations — the system finds nearby available drivers and offers the trip to the best match
2. **FR2**: Driver can accept or decline a trip offer — if declined, the system offers it to the next best driver
3. **FR3**: Both rider and driver can see each other's real-time location during an active trip
4. **FR4**: System computes the fare at trip completion based on distance, time, and demand multiplier (surge pricing)
5. **FR5**: Rider can see an estimated fare and ETA before requesting the ride

### Non-Functional Requirements (LSDARO)
1. **NFR1 — Latency**: Match a rider to a driver within 5 seconds (p99) — directly impacts conversion; every second of "finding your driver" loses riders
2. **NFR2 — Scale**: ~500K concurrent trips, ~1M active drivers sending location updates every 4 seconds (250K location writes/sec), ~10M ride requests/day
3. **NFR3 — Availability**: 99.99% for ride requests and matching — a matching outage means zero revenue and stranded riders
4. **NFR4 — Resiliency**: Matching must survive a single-zone failure with no rider-visible impact; trip state must survive driver app crashes (trip recovery on reconnect)
5. **NFR5 — Durability**: Trip and fare records must never be lost — they drive payments, disputes, and regulatory compliance
6. **NFR6 — Observability**: Match rate, accept rate, surge multiplier distribution, location update lag, trip state machine transition latency, driver utilization

### Out of Scope
- Payment processing (assume a payment service exists; we call it at trip end)
- Driver onboarding, background checks, vehicle verification
- Multi-stop / shared rides (UberPool) — focus on 1:1 matching
- Scheduling rides in advance
- In-app messaging between rider and driver
- Rating and review system
- Driver earnings, tips, and incentive programs
