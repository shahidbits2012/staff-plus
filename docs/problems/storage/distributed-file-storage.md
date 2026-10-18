---
sidebar_position: 2
title: "Distributed File Storage (e.g. Amazon S3)"
---

# Distributed File Storage

Design a system that stores and retrieves arbitrary binary objects (files, images, backups) at exabyte scale with high durability, availability, and low latency — like Amazon S3, Google Cloud Storage, or Azure Blob Storage.

## 1. Requirements

### Functional Requirements
1. **FR1**: Client can upload an object (up to 5 TB) to a named bucket with a unique key
2. **FR2**: Client can download an object by bucket + key
3. **FR3**: Client can delete an object by bucket + key
4. **FR4**: Client can list objects in a bucket with prefix filtering and pagination
5. **FR5**: Support multi-part upload for large objects (>100 MB) — upload in parallel chunks, then finalize

### Non-Functional Requirements (LSDARO)
1. **NFR1 — Durability**: 11 nines (99.999999999%) — the defining requirement. Losing a customer's data is an existential event. Drives erasure coding, cross-AZ replication, and integrity verification.
2. **NFR2 — Availability**: 99.99% for reads, 99.9% for writes — reads are served from replicas; writes require quorum coordination
3. **NFR3 — Scale**: Trillions of objects, exabytes of storage, 100K+ requests/sec per partition — metadata and data layers must scale independently
4. **NFR4 — Latency**: First-byte latency &lt;100ms (p99) for GETs on hot objects; PUTs acknowledged within 200ms (p99) for small objects (&lt;1 MB)
5. **NFR5 — Resiliency**: Survive AZ failure with zero data loss and no read degradation; survive region failure with RPO=0 for cross-region-replicated buckets
6. **NFR6 — Observability**: Per-bucket request metrics, error rates, storage utilization, replication lag, integrity check failures

### Out of Scope
- File system semantics (directories, rename, append) — S3 is a flat key-value object store
- Real-time notifications on object changes (event triggers like S3 Event Notifications)
- Storage class transitions (Glacier, Infrequent Access tiering)
- Access control policies (IAM, bucket policies, pre-signed URLs) — assume identity resolved upstream
- Content delivery / edge caching (CDN layer)
- Server-side encryption key management (KMS integration)
