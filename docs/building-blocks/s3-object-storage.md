---
sidebar_position: 7
title: "S3 / Object Storage"
---

# S3 / Object Storage

## Mental Model

Object storage is a **flat key-value store for files**. No directories, no hierarchy — just a bucket name and a key (path-like string) that maps to a blob of bytes plus metadata.

```
Bucket: my-app-media
Key:    media/chat-123/msg-456/photo.jpg
Value:  [binary blob]
Metadata: { content-type: image/jpeg, size: 2.4MB, uploaded: 2024-10-08 }
```

Think of it as an infinitely scalable hash map where keys are strings and values are files up to 5TB.

## Problem Being Solved

Traditional file systems and block storage hit limits:
- **Capacity** — disk fills up, scaling requires manual provisioning
- **Throughput** — single disk or NFS mount becomes a bottleneck
- **Durability** — disk failure = data loss without manual replication
- **Distribution** — serving files globally requires CDN integration

Object storage solves all of these by abstracting storage behind an HTTP API with built-in replication, global distribution, and effectively unlimited capacity.

## Core Concepts

### Buckets

A bucket is a top-level container (like a namespace). Globally unique name within the cloud provider.

```
s3://my-app-media/          ← bucket
s3://my-app-media/photo.jpg ← object
```

**One bucket per application** is typical. Use key prefixes for organization, not multiple buckets.

### Objects

An object consists of:
- **Key** — the unique identifier (string, up to 1024 bytes)
- **Value** — the data (up to 5TB per object)
- **Metadata** — system metadata (size, content-type, last-modified) + custom metadata (key-value pairs)
- **Version ID** — if versioning is enabled

### Storage Classes

| Class | Access Pattern | Durability | Latency | Cost |
|-------|---------------|-----------|---------|------|
| **S3 Standard** | Frequent access | 99.999999999% (11 nines) | ms | $$$ |
| **S3 Intelligent-Tiering** | Unknown/changing access | 11 nines | ms | $$ (auto-tiering) |
| **S3 Standard-IA** | Infrequent access (> 30 days) | 11 nines | ms | $$ (lower storage, higher retrieval) |
| **S3 Glacier Instant** | Archive, instant retrieval | 11 nines | ms | $ |
| **S3 Glacier Flexible** | Archive, minutes to hours retrieval | 11 nines | min-hours | ¢ |
| **S3 Glacier Deep Archive** | Long-term archive, 12+ hours retrieval | 11 nines | 12-48 hours | ¢¢ |

**Lifecycle policies** automatically transition objects between classes based on age.

## How S3 Achieves 11 Nines Durability

S3 automatically replicates each object across **a minimum of 3 Availability Zones** within a region.

```
Upload photo.jpg
  → Replicated to AZ-1 (primary)
  → Replicated to AZ-2
  → Replicated to AZ-3
  → ACK to client only after all 3 copies confirmed
```

11 nines = if you store 10 million objects, you'd statistically lose 1 object every 10,000 years.

### How It Actually Works (Simplified)

1. Object is split into **chunks**
2. Chunks are **erasure-coded** (like RAID but across AZs) — can reconstruct data from a subset of chunks
3. Chunks are distributed across multiple physical storage nodes in multiple AZs
4. Continuous background **integrity checking** (checksums) and automatic repair

## Pre-Signed URLs

A pre-signed URL grants **temporary, scoped access** to an S3 object without requiring the requester to have AWS credentials.

### How It Works

```
Server (has AWS credentials):
  1. Generates a URL with embedded signature, expiry, and permissions
  2. Returns URL to client

Client (no AWS credentials):
  3. Uses the URL to upload/download directly to/from S3
  4. S3 validates the signature and expiry
```

### For Upload (PUT)

```
// Server generates:
PUT https://my-bucket.s3.amazonaws.com/media/chat-123/msg-456/photo.jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=AKIA.../s3/aws4_request
  &X-Amz-Date=20241008T120000Z
  &X-Amz-Expires=3600           ← valid for 1 hour
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=abc123...

// Client uploads directly:
PUT <pre-signed-url>
Content-Type: image/jpeg
Body: [encrypted file bytes]
```

### For Download (GET)

```
// Server generates a GET pre-signed URL
// Client downloads directly from S3
GET <pre-signed-url> → [encrypted file bytes]
```

### Security Controls on Pre-Signed URLs

| Control | How |
|---------|-----|
| **Time-limited** | `Expires` parameter (seconds). Typically 1 hour for uploads, shorter for downloads. |
| **Scoped to specific key** | URL is for one specific object path, not the whole bucket |
| **Content-type restriction** | Conditions can enforce allowed content types |
| **Max file size** | `Content-Length-Range` condition prevents oversized uploads |
| **HTTP method** | URL is scoped to PUT (upload) or GET (download), not both |

### Why Pre-Signed URLs?

| Upload via server | Upload via pre-signed URL |
|-------------------|--------------------------|
| File passes through your server | File goes **directly to S3** |
| Server bandwidth is the bottleneck | S3 bandwidth (virtually unlimited) |
| Server CPU/memory for buffering | Zero server load |
| Single point of failure | S3's distributed infrastructure |
| Server needs to scale with media volume | Server only generates URLs (lightweight) |

**At scale (100B msgs/day with media), routing files through your servers is a non-starter.** Pre-signed URLs are the standard approach.

## S3 Event Notifications

S3 can notify your application when objects are created, deleted, or transitioned.

### Delivery Targets

| Target | Latency | Reliability |
|--------|---------|-------------|
| **SQS** | Seconds | At-least-once delivery |
| **SNS** | Seconds | Fan-out to multiple subscribers |
| **Lambda** | Seconds | Serverless processing |
| **EventBridge** | Seconds | Rich filtering and routing |

### Caveats

- **Eventually consistent** — notifications can be delayed (seconds to minutes)
- **At-least-once** — you may receive duplicate notifications
- **Not guaranteed order** — events may arrive out of order
- **For chat media:** Client-notified completion (client tells server "upload done") is faster and more reliable than S3 event notifications

## Multipart Upload

For large files (> 100MB), S3 supports multipart upload:

1. **Initiate** — get an upload ID
2. **Upload parts** — upload file in chunks (5MB-5GB each), in parallel
3. **Complete** — tell S3 to assemble the parts

| Benefit | Why |
|---------|-----|
| **Parallel uploads** | Upload 10 parts simultaneously = 10x faster |
| **Resume on failure** | Only re-upload the failed part, not the whole file |
| **Required for > 5GB** | Single PUT max is 5GB |

**Recommended:** Use multipart for files > 100MB. For chat media (typically < 50MB), single PUT with pre-signed URL is sufficient.

## Consistency Model

S3 provides **strong read-after-write consistency** (since December 2020):

- After a successful PUT, a subsequent GET returns the new object
- After a successful DELETE, a subsequent GET returns 404
- List operations reflect the latest state

This means: after the client uploads a file, the Chat Server's HEAD request to verify the upload will always see it. No stale reads.

## Performance

| Operation | Throughput per prefix |
|-----------|---------------------|
| GET | 5,500 requests/sec |
| PUT/POST/DELETE | 3,500 requests/sec |

**Scaling trick:** Use random prefixes or hash-based key naming to distribute requests across S3's internal partitions.

```
// Bad: sequential prefix → hot partition
media/2024/10/08/photo1.jpg
media/2024/10/08/photo2.jpg

// Good: hash-based prefix → distributed
a3f2/media/chat-123/msg-456/photo.jpg
7b1c/media/chat-789/msg-012/video.mp4
```

For chat, `media/{chatId}/{messageId}/` naturally distributes well since chatId and messageId are UUIDs.

## Cost Model

| Dimension | S3 Standard (us-east-1) |
|-----------|------------------------|
| Storage | ~$0.023 / GB / month |
| PUT requests | ~$0.005 / 1,000 |
| GET requests | ~$0.0004 / 1,000 |
| Data transfer out | ~$0.09 / GB (first 10TB) |

**For chat media:** If messages are E2E encrypted and deleted after delivery, storage costs are transient. The main cost is data transfer (upload + N downloads per recipient).

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **S3 outage** (rare, region-wide) | Media upload/download fails | Client retry with exponential backoff; multi-region replication for critical data |
| **Pre-signed URL expired** | Client can't upload | Client requests a new URL from server |
| **Upload interrupted** | Partial/corrupt object | Client retries upload; multipart upload for large files resumes from last part |
| **Throttling (429)** | Requests rejected at high QPS | Distribute key prefixes; exponential backoff |

## Real-World Usage

| Company | Use Case | Notes |
|---------|----------|-------|
| **Netflix** | Video content storage | PBs of media, S3 as origin for CDN |
| **Airbnb** | Listing photos | Pre-signed URLs for host uploads |
| **Slack** | File sharing | Direct-to-S3 upload with pre-signed URLs |
| **WhatsApp** | Media attachments | Encrypted blobs, deleted after delivery |
| **Dropbox** | File storage | Started on S3, later built custom storage (Magic Pocket) |

## Related Concepts

- [API Gateway](/building-blocks/api-gateway) — generates pre-signed URLs as part of the API
- [Redis](/building-blocks/redis) — caching media metadata
- [Apache Kafka](/building-blocks/kafka) — S3 event notifications can trigger Kafka consumers
