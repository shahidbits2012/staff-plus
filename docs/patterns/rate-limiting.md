---
sidebar_position: 3
title: "Rate Limiting Algorithms"
---

# Rate Limiting Algorithms

## Mental Model

A rate limiter is a **counter with a clock**. It tracks how many requests an identity (IP, API key, user) has made within a time window and decides: allow or reject. The algorithm determines how the counter works, how the window slides, and whether bursts are tolerated.

## Problem Being Solved

Without rate limiting, a single abusive or misbehaving client can:
- Exhaust backend capacity, causing cascading failures
- Starve other clients of fair access
- Drive up infrastructure costs from unplanned traffic spikes

Rate limiting bounds request volume per identity to protect capacity, ensure fairness, and enforce contractual quotas (API tiers).

## Algorithms

<Tabs>
  <TabItem value="fixed-window" label="Fixed Window" default>

### How It Works

Divide time into fixed intervals (e.g., every minute at :00). One counter per window. Increment on each request; reject if count exceeds the limit.

```
Window: 12:00:00–12:00:59 → counter = 87/100  (allow)
Window: 12:01:00–12:01:59 → counter = 0/100   (reset)
```

### Implementation

<Tabs groupId="lang">
  <TabItem value="pseudo" label="Pseudocode" default>

```python
def check_fixed_window(client_id, rule):
    window_id = floor(now() / rule.window_seconds)
    key = f"rl:{rule.id}:{client_id}:{window_id}"

    count = redis.INCR(key)
    if count == 1:
        redis.EXPIRE(key, rule.window_seconds)

    if count > rule.limit:
        return REJECT(retry_after=next_window - now())
    return ALLOW(remaining=rule.limit - count)
```

  </TabItem>
  <TabItem value="java" label="Java">

```java
public RateLimitResult checkFixedWindow(String clientId, Rule rule) {
    long windowId = Instant.now().getEpochSecond() / rule.getWindowSeconds();
    String key = String.format("rl:%s:%s:%d", rule.getId(), clientId, windowId);

    Long count = redis.opsForValue().increment(key);
    if (count == 1) {
        redis.expire(key, Duration.ofSeconds(rule.getWindowSeconds()));
    }

    long remaining = Math.max(0, rule.getLimit() - count);
    long resetEpoch = (windowId + 1) * rule.getWindowSeconds();

    if (count > rule.getLimit()) {
        return RateLimitResult.reject(rule.getLimit(), 0, resetEpoch);
    }
    return RateLimitResult.allow(rule.getLimit(), remaining, resetEpoch);
}
```

  </TabItem>
</Tabs>

**Redis cost:** 1 INCR (+1 EXPIRE on first hit)

### Pros
- Simplest implementation — single INCR + TTL
- O(1) memory per key
- Lowest Redis cost

### Cons
- **Boundary burst problem** — 100 requests at 12:00:59 + 100 at 12:01:00 = 200 in 2 seconds, despite a 100/min limit

### Best For
Coarse-grained limiting where occasional 2× burst at boundaries is acceptable (e.g., internal service-to-service throttling).

  </TabItem>
  <TabItem value="sliding-window" label="Sliding Window Counter">

### How It Works

Weighted average of the current and previous fixed-window counters, based on overlap. Smooths the boundary burst problem without storing individual timestamps.

```
Limit: 100/min. Current time: 12:01:15 (25% into current window)

Previous window (12:00): 84 requests
Current window  (12:01): 36 requests

Weighted count = 84 × 0.75 + 36 × 1.0 = 99 → ALLOW
```

### Implementation

<Tabs groupId="lang">
  <TabItem value="pseudo" label="Pseudocode" default>

```python
def check_sliding_window(client_id, rule):
    now = now_epoch()
    current_window = floor(now / rule.window_seconds)
    previous_window = current_window - 1

    curr_key = f"rl:{rule.id}:{client_id}:{current_window}"
    prev_key = f"rl:{rule.id}:{client_id}:{previous_window}"

    prev_count, curr_count = redis.pipeline(
        GET(prev_key),
        INCR(curr_key)
    )
    if curr_count == 1:
        redis.EXPIRE(curr_key, rule.window_seconds * 2)

    prev_count = int(prev_count or 0)
    elapsed_ratio = (now % rule.window_seconds) / rule.window_seconds
    weighted = prev_count * (1 - elapsed_ratio) + curr_count

    if weighted > rule.limit:
        return REJECT(retry_after=next_window - now)
    return ALLOW(remaining=rule.limit - weighted)
```

  </TabItem>
  <TabItem value="java" label="Java">

```java
public RateLimitResult checkSlidingWindow(String clientId, Rule rule) {
    long now = Instant.now().getEpochSecond();
    long currentWindow = now / rule.getWindowSeconds();
    long previousWindow = currentWindow - 1;

    String currKey = String.format("rl:%s:%s:%d", rule.getId(), clientId, currentWindow);
    String prevKey = String.format("rl:%s:%s:%d", rule.getId(), clientId, previousWindow);

    List<Object> results = redis.executePipelined((RedisCallback<Object>) conn -> {
        conn.get(prevKey.getBytes());
        conn.incr(currKey.getBytes());
        return null;
    });

    long prevCount = results.get(0) != null ? Long.parseLong((String) results.get(0)) : 0;
    long currCount = (Long) results.get(1);

    if (currCount == 1) {
        redis.expire(currKey, Duration.ofSeconds(rule.getWindowSeconds() * 2));
    }

    double elapsedRatio = (double) (now % rule.getWindowSeconds()) / rule.getWindowSeconds();
    double weighted = prevCount * (1.0 - elapsedRatio) + currCount;

    long resetEpoch = (currentWindow + 1) * rule.getWindowSeconds();
    long remaining = Math.max(0, (long) (rule.getLimit() - weighted));

    if (weighted > rule.getLimit()) {
        return RateLimitResult.reject(rule.getLimit(), 0, resetEpoch);
    }
    return RateLimitResult.allow(rule.getLimit(), remaining, resetEpoch);
}
```

  </TabItem>
</Tabs>

**Redis cost:** 1 GET + 1 INCR (pipelined = 1 RTT)

### Pros
- Smooths boundary bursts — no 2× spike at window edges
- Still O(1) memory — just two counters
- Nearly as cheap as fixed window

### Cons
- Approximation, not exact — weighted estimate can be ~1-2% off

### Best For
**Default choice for most rate limiters.** Best balance of accuracy, memory, and simplicity. Used by Cloudflare.

  </TabItem>
  <TabItem value="sliding-log" label="Sliding Window Log">

### How It Works

Store the exact timestamp of every request in a sorted set. On each request, remove entries older than the window, count remaining.

```
Sorted set: [12:00:01, 12:00:03, 12:00:45, 12:01:02, 12:01:15]
                ↑ remove (older than 1 min)        ↑ count these
```

### Implementation

<Tabs groupId="lang">
  <TabItem value="pseudo" label="Pseudocode" default>

```python
def check_sliding_log(client_id, rule):
    now = now_epoch()
    key = f"rl:{rule.id}:{client_id}"
    window_start = now - rule.window_seconds

    redis.ZREMRANGEBYSCORE(key, 0, window_start)
    count = redis.ZCARD(key)

    if count >= rule.limit:
        return REJECT(retry_after=oldest_entry + window - now)

    redis.ZADD(key, now, now)
    redis.EXPIRE(key, rule.window_seconds)
    return ALLOW(remaining=rule.limit - count - 1)
```

  </TabItem>
  <TabItem value="java" label="Java">

```java
private static final String SLIDING_LOG_LUA = """
    local key = KEYS[1]
    local window_start = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
    local count = redis.call('ZCARD', key)

    if count >= limit then
        return {0, count, 0}
    end

    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, ttl)
    return {1, count + 1, limit - count - 1}
    """;

public RateLimitResult checkSlidingLog(String clientId, Rule rule) {
    long now = Instant.now().toEpochMilli();
    long windowStart = now - (rule.getWindowSeconds() * 1000L);
    String key = String.format("rl:%s:%s", rule.getId(), clientId);

    List<Long> result = redis.execute(
            new DefaultRedisScript<>(SLIDING_LOG_LUA, List.class),
            List.of(key),
            String.valueOf(windowStart), String.valueOf(now),
            String.valueOf(rule.getLimit()), String.valueOf(rule.getWindowSeconds()));

    boolean allowed = result.get(0) == 1;
    return allowed
            ? RateLimitResult.allow(rule.getLimit(), result.get(2), 0)
            : RateLimitResult.reject(rule.getLimit(), 0, 0);
}
```

  </TabItem>
</Tabs>

**Redis cost:** ZREMRANGEBYSCORE + ZCARD + ZADD (Lua script = 1 RTT, but O(log N + M) work)

### Pros
- **Perfectly accurate** — exact rolling window, no approximation

### Cons
- **O(N) memory per key** — stores every timestamp. 1000 rps × 60s = 60K entries per key
- Does not scale to high throughput — memory and CPU explode

### Best For
Low-volume, high-accuracy use cases (e.g., rate limiting login attempts — 5/min per IP).

  </TabItem>
  <TabItem value="leaky-bucket" label="Leaky Bucket">

### How It Works

Requests enter a FIFO queue (the bucket). The bucket "leaks" (drains) at a fixed rate. If the bucket is full, new requests are rejected. This **smooths output to a constant rate** — it's a traffic **shaper**, not a rate limiter.

```
Bucket capacity: 10 (burst buffer)
Leak rate: 5 req/sec

Requests arrive in burst → fill bucket → drain at 5/sec
If bucket full → reject new arrivals
```

### What happens with a burst of 50 requests?

```
50 requests arrive at once
→ 10 enter the bucket (capacity)
→ 40 rejected immediately (overflow)
→ The 10 in the bucket drain at exactly 5/sec → takes 2 seconds
→ Downstream sees: 5...5...done (perfectly smooth)
```

### Implementation

<Tabs groupId="lang">
  <TabItem value="pseudo" label="Pseudocode" default>

```python
def check_leaky_bucket(client_id, rule):
    key = f"rl:{rule.id}:{client_id}"

    depth, last_leak = redis.HMGET(key, "depth", "last_leak")
    depth = int(depth or 0)
    last_leak = float(last_leak or now())

    elapsed = now() - last_leak
    leaked = floor(elapsed * rule.leak_rate)
    depth = max(0, depth - leaked)

    if depth >= rule.capacity:
        return REJECT(retry_after=1 / rule.leak_rate)

    depth += 1
    redis.HMSET(key, "depth", depth, "last_leak", now())
    redis.EXPIRE(key, rule.capacity / rule.leak_rate * 2)
    return ALLOW(remaining=rule.capacity - depth)
```

  </TabItem>
  <TabItem value="java" label="Java">

```java
private static final String LEAKY_BUCKET_LUA = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local leak_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    local depth = tonumber(redis.call('HGET', key, 'depth') or '0')
    local last_leak = tonumber(redis.call('HGET', key, 'last_leak') or now)

    local elapsed = now - last_leak
    local leaked = math.floor(elapsed * leak_rate)
    depth = math.max(0, depth - leaked)

    if depth >= capacity then
        return {0, depth, capacity}
    end

    depth = depth + 1
    redis.call('HSET', key, 'depth', depth, 'last_leak', now)
    redis.call('EXPIRE', key, ttl)
    return {1, depth, capacity}
    """;

public RateLimitResult checkLeakyBucket(String clientId, Rule rule) {
    double now = System.currentTimeMillis() / 1000.0;
    String key = String.format("rl:%s:%s", rule.getId(), clientId);
    long ttl = (long) (rule.getCapacity() / rule.getLeakRate() * 2);

    List<Long> result = redis.execute(
            new DefaultRedisScript<>(LEAKY_BUCKET_LUA, List.class),
            List.of(key),
            String.valueOf(rule.getCapacity()), String.valueOf(rule.getLeakRate()),
            String.valueOf(now), String.valueOf(ttl));

    boolean allowed = result.get(0) == 1;
    long remaining = rule.getCapacity() - result.get(1);

    return allowed
            ? RateLimitResult.allow(rule.getCapacity(), remaining, 0)
            : RateLimitResult.reject(rule.getCapacity(), 0, (long)(1.0 / rule.getLeakRate()));
}
```

  </TabItem>
</Tabs>

**Redis cost:** Lua script (HGET + HSET + EXPIRE = 1 RTT)

### Pros
- Perfectly smooth output rate — no bursts reach downstream
- Predictable load on backend services

### Cons
- **Traffic shaper, not a rate limiter** — queues requests instead of instantly allowing/rejecting
- Adds latency to legitimate burst traffic

### Best For
**Outbound traffic shaping** — e.g., your service calls a third-party API that enforces a strict fixed rate. You want to smooth your outgoing calls to exactly 10/sec. Not for inbound request gating.

  </TabItem>
  <TabItem value="token-bucket" label="Token Bucket">

### How It Works

A bucket holds tokens, refilled at a steady rate up to a max capacity. Each request consumes one token. No tokens left → reject. Unlike leaky bucket, this **allows controlled bursts** — a full bucket can drain instantly.

```
Capacity: 100 tokens (max burst)
Refill rate: 10 tokens/sec

Full bucket → 100 requests served instantly (burst)
Then: 10 req/sec sustained until bucket refills
```

### What happens with a burst of 50 requests?

```
50 requests arrive at once
→ Bucket has 50 tokens (was full)
→ All 50 served INSTANTLY (burst!)
→ Bucket is now empty
→ Next requests wait for refill: 5 tokens/sec
→ Downstream sees: 50...then 5/sec
```

### Implementation

<Tabs groupId="lang">
  <TabItem value="pseudo" label="Pseudocode" default>

```python
def check_token_bucket(client_id, rule):
    key = f"rl:{rule.id}:{client_id}"

    tokens, last_refill = redis.HMGET(key, "tokens", "last_refill")
    tokens = float(tokens or rule.capacity)
    last_refill = float(last_refill or now())

    elapsed = now() - last_refill
    tokens = min(rule.capacity, tokens + elapsed * rule.refill_rate)

    if tokens < 1:
        wait = (1 - tokens) / rule.refill_rate
        return REJECT(retry_after=wait)

    tokens -= 1
    redis.HMSET(key, "tokens", tokens, "last_refill", now())
    redis.EXPIRE(key, rule.capacity / rule.refill_rate * 2)
    return ALLOW(remaining=floor(tokens))
```

  </TabItem>
  <TabItem value="java" label="Java">

```java
private static final String TOKEN_BUCKET_LUA = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local ttl = tonumber(ARGV[4])

    local tokens = tonumber(redis.call('HGET', key, 'tokens') or capacity)
    local last_refill = tonumber(redis.call('HGET', key, 'last_refill') or now)

    local elapsed = now - last_refill
    tokens = math.min(capacity, tokens + elapsed * refill_rate)

    if tokens < 1 then
        local wait = (1 - tokens) / refill_rate
        return {0, 0, tostring(wait)}
    end

    tokens = tokens - 1
    redis.call('HSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(now))
    redis.call('EXPIRE', key, ttl)
    return {1, math.floor(tokens), '0'}
    """;

public RateLimitResult checkTokenBucket(String clientId, Rule rule) {
    double now = System.currentTimeMillis() / 1000.0;
    String key = String.format("rl:%s:%s", rule.getId(), clientId);
    long ttl = (long) (rule.getCapacity() / rule.getRefillRate() * 2);

    List<Object> result = redis.execute(
            new DefaultRedisScript<>(TOKEN_BUCKET_LUA, List.class),
            List.of(key),
            String.valueOf(rule.getCapacity()), String.valueOf(rule.getRefillRate()),
            String.valueOf(now), String.valueOf(ttl));

    boolean allowed = ((Long) result.get(0)) == 1;
    long remaining = (Long) result.get(1);
    double retryAfter = Double.parseDouble((String) result.get(2));

    return allowed
            ? RateLimitResult.allow(rule.getCapacity(), remaining, 0)
            : RateLimitResult.reject(rule.getCapacity(), 0, (long) Math.ceil(retryAfter));
}
```

  </TabItem>
</Tabs>

**Redis cost:** Lua script (HGET + HSET + EXPIRE = 1 RTT)

### Pros
- **Allows controlled bursts** — full bucket serves capacity requests instantly
- O(1) memory — two values per key
- Industry standard — used by AWS API Gateway, Stripe, Google Cloud

### Cons
- Requires Lua script for atomic read-compute-write
- Burst capacity must be configured separately from sustained rate

### Best For
APIs where **burst tolerance** matters — idle clients should be able to send a quick burst, not be throttled to the per-second sustained rate. The standard for public API rate limiting.

  </TabItem>
</Tabs>

## Leaky Bucket vs Token Bucket

These two are often confused. They solve **opposite problems**:

| | Leaky Bucket | Token Bucket |
|---|---|---|
| **Mental model** | Bucket with a hole — water leaks out at a fixed rate | Bucket that fills with tokens at a fixed rate |
| **Controls** | **Output rate** — how fast requests leave | **Input rate** — how fast requests are accepted |
| **Burst behavior** | **No bursts** — output is always smooth; excess requests **queue** | **Allows bursts** — a full bucket can drain instantly |
| **When bucket is full** | Incoming request is dropped (overflow) | Request is rejected (no tokens) |
| **Core use case** | Traffic **shaping** — smooth outgoing calls | Traffic **policing** — gate incoming calls |
| **Real-world analogy** | Funnel — pour fast, drip slow | Ticket dispenser — take a ticket, wait for refill |

**When to use which:**
- **Token Bucket** → you're the **gatekeeper** (rate limiting incoming requests). Stripe, AWS, Google all use this. Allows bursts, instant allow/reject.
- **Leaky Bucket** → you're the **caller** (shaping your outbound traffic). E.g., calling a third-party API that enforces 10 req/sec — you want to smooth your calls to exactly that rate.

## Comparison Table

| Algorithm | Memory | Accuracy | Burst Handling | Redis Cost | Complexity | High-Scale Fit |
|-----------|--------|----------|---------------|------------|------------|----------------|
| Fixed Window | O(1) | Poor (boundary burst) | 2× burst at edges | 1 INCR | Trivial | Scales, but inaccurate |
| **Sliding Window Counter** | **O(1)** | **Good (~1-2% off)** | **Smoothed boundaries** | **1 GET + 1 INCR** | **Simple** | **Best default** |
| Sliding Window Log | O(N) | Perfect | No bursts | ZADD + ZREM + ZCARD | Moderate | Memory explodes |
| Leaky Bucket | O(1) | Perfect | Queues (shaper) | Lua script | Moderate | Wrong model for gating |
| **Token Bucket** | **O(1)** | **Good** | **Controlled bursts** | **Lua script** | **Moderate** | **Best if bursts needed** |

## Scaling Considerations

- **Distributed counters** — at scale, all gateway instances share a Redis Cluster for global counter accuracy. Local in-memory counters avoid the network hop but lose global accuracy (each pod sees 1/Nth of traffic).
- **Clock skew** — NTP drift across servers can cause windows to misalign. At 1-10ms skew, the impact on a 60s window is negligible. For sub-second windows, use Redis server time (`TIME` command), not client time.
- **Hot keys** — a single high-traffic client (one API key doing 100K rps) means one Redis key gets 100K INCR/sec. Redis handles ~100K ops/sec per key; beyond that, shard across multiple keys or use local counters with periodic sync.

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Redis down** | Can't read/write counters — all requests are either blocked or unthrottled | Fail-open: allow all traffic with local in-memory fallback counters |
| **Counter lost (Redis restart)** | Current window's count resets to 0 — brief over-admission | Acceptable — counters are ephemeral by design; the next window is correct |
| **Clock skew across pods** | Different pods compute different window IDs for the same moment | Use Redis `TIME` for window computation; or accept ~1% inaccuracy on 60s windows |
| **Hot key (single client)** | One Redis key saturated | Local counter with periodic sync; or shard key across multiple Redis slots |

## Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Sliding window over fixed window | Slightly more compute for no boundary burst |
| Sliding window over sliding log | ~1-2% approximation for O(1) vs O(N) memory |
| Token bucket over leaky bucket | Allows bursts (better DX) but downstream sees spiky traffic |
| Redis over local counters | Network hop (~1ms) for global accuracy |
| Lua scripts over multi-command | Atomicity guaranteed, but Lua errors are harder to debug |

## Real-World Examples

| System | Algorithm | Notes |
|--------|-----------|-------|
| **Stripe** | Token Bucket | Per-API-key limits with burst tolerance |
| **AWS API Gateway** | Token Bucket | Configurable burst + sustained rate |
| **Cloudflare** | Sliding Window | Edge-computed, per-IP and per-zone |
| **Google Cloud** | Token Bucket | Per-project quotas with burst |
| **Kong** | Fixed Window / Sliding Window | Plugin-based, configurable per route |
| **Envoy (Istio)** | Token Bucket | Local + global rate limiting modes |

## Related Concepts

- [API Gateway](/building-blocks/api-gateway) — where rate limiting is typically enforced
- [Circuit Breaker](/patterns/circuit-breaker) — complementary pattern for downstream protection
- [Redis](/building-blocks/redis) — backing store for distributed counters
- [Distributed Rate Limiter](/problems/real-time/rate-limiter) — full system design applying these algorithms
