---
sidebar_position: 8
title: "E2E Encryption & Signal Protocol"
---

# E2E Encryption & Signal Protocol

## Mental Model

End-to-end encryption means **only the sender and recipient can read the message**. The server transports ciphertext — it can't decrypt it, even if compelled to. The server is a relay, not a reader.

The hard part isn't encryption itself (AES is well-understood). The hard part is **key exchange**: how do two users who've never met establish a shared secret, without the server being able to derive it?

## Problem Being Solved

Without E2E encryption:
- The server can read all messages (privacy risk)
- A compromised server exposes all user data
- Government subpoenas can compel the company to hand over message content
- Internal employees with database access can read messages

With E2E encryption:
- The server is mathematically locked out
- A database breach reveals only ciphertext
- The company **cannot** comply with content requests (by design)
- Trust is moved from the server to the protocol

## Diffie-Hellman Key Exchange

The foundation of all E2E encryption. Allows two parties to compute a **shared secret** over a public channel, even if an eavesdropper sees everything transmitted.

### How It Works

```
A generates: private key a, public key g^a
B generates: private key b, public key g^b

A and B exchange public keys (server can see these)

A computes: shared_secret = (g^b)^a = g^(ab)
B computes: shared_secret = (g^a)^b = g^(ab)

Same result! Both have g^(ab) without ever transmitting it.
```

### Why the Server Can't Compute the Secret

The server sees:
- `g^a` (A's public key)
- `g^b` (B's public key)

To compute `g^(ab)`, you need either `a` or `b` (a private key). Deriving `a` from `g^a` is the **discrete logarithm problem** — computationally infeasible with sufficiently large numbers.

```
Server has:  g^a and g^b
Server needs: a or b
Server cannot compute: g^(ab) ← mathematically infeasible
```

### Man-in-the-Middle Attack

The one vulnerability: the server could **lie about public keys**. If A asks for B's public key, the server could substitute its own key, establishing two separate shared secrets (one with A, one with B), decrypting and re-encrypting messages in between.

**Mitigation:** Safety numbers / key verification. Users verify each other's identity keys out-of-band (QR code scan in person, comparing number strings). WhatsApp shows "security code changed" notifications when a contact's identity key changes.

## Signal Protocol (Used by WhatsApp, Signal, Facebook Messenger)

### Key Setup: What Each Device Generates

On registration, each **Client (device)** generates:

```
Identity Key (IK)        — long-term key pair, identifies the device. Generated once.
Signed Pre-Key (SPK)     — medium-term key pair, rotated periodically. Signed by IK.
One-Time Pre-Keys (OPK)  — batch of ephemeral key pairs, each used once.
```

**Public keys** are uploaded to the server. Private keys **never leave the device**.

The server stores a **Key Bundle** per device:

```
KeyBundle:
  userId
  clientId (device)
  identityPublicKey
  signedPrePublicKey + signature
  oneTimePrePublicKeys[]    ← consumed one per new conversation
```

### X3DH: First Message Key Exchange

When A messages B for the first time (no prior conversation):

```
1. A fetches B's Key Bundle from server (public keys only)
2. A generates an ephemeral key pair (EK)
3. A performs 3 (or 4) DH computations:

   DH1 = DH(A's IK_priv,  B's SPK_pub)    — A's identity, B's semi-static
   DH2 = DH(A's EK_priv,  B's IK_pub)     — A's ephemeral, B's identity
   DH3 = DH(A's EK_priv,  B's SPK_pub)    — A's ephemeral, B's semi-static
   DH4 = DH(A's EK_priv,  B's OPK_pub)    — A's ephemeral, B's one-time (optional)

4. Shared Secret = KDF(DH1 || DH2 || DH3 || DH4)
5. A encrypts first message with this shared secret
6. A sends: ciphertext + A's IK_pub + A's EK_pub + which OPK was used
7. B receives, performs the same DH computations (mirrored), derives same secret
8. B decrypts the message
```

**Why 3-4 DH operations?** Each provides a different security property:
- DH1: A proves their identity (long-term key)
- DH2: B proves their identity (long-term key)
- DH3: Forward secrecy (ephemeral key)
- DH4: One-time pre-key prevents replay attacks

**The consumed One-Time Pre-Key is deleted from the server.** When the batch runs out, the client uploads more.

### Double Ratchet: Ongoing Messages

After X3DH establishes the initial shared secret, the protocol switches to **Double Ratchet** for all subsequent messages.

#### Why Not Keep Using the Same Key?

If one key is compromised, **all messages** (past and future) are exposed. The Double Ratchet ensures:
- **Forward secrecy** — compromising a current key can't decrypt past messages
- **Break-in recovery** — even if a key leaks, future messages become secure again after one round-trip

#### The Symmetric Ratchet (KDF Chain)

A Key Derivation Function takes the current chain key and produces:
- A **new chain key** (input for next message)
- A **message key** (encrypts this message, then deleted)

```
Root Key (from X3DH)
  ↓ KDF
Chain Key 1  →  Message Key 1  (encrypt msg 1, then delete MK1)
  ↓ KDF
Chain Key 2  →  Message Key 2  (encrypt msg 2, then delete MK2)
  ↓ KDF
Chain Key 3  →  Message Key 3  (encrypt msg 3, then delete MK3)
```

Both sender and receiver derive the same chain independently. The receiver uses the message number to advance their chain to the matching position.

**Forward secrecy:** Message keys are deleted after use. Even if an attacker extracts the current chain key, past message keys are unrecoverable — the KDF is one-way.

#### The Asymmetric Ratchet (DH Ratchet)

Every time the conversation **direction switches** (A was sending, B replies), a new DH exchange happens:

```
A sends messages 1, 2 (using chain from RootKey₁)
B replies with message 3:
  → B generates NEW ephemeral key pair
  → B includes new public key in message header
  → Both compute: RootKey₂ = DH(A's key, B's new key)
  → New sending/receiving chains derived from RootKey₂

A replies with message 4:
  → A generates NEW ephemeral key pair
  → RootKey₃ = DH(A's new key, B's key)
  → New chains again
```

**Break-in recovery:** Even if an attacker has the current chain key, the next DH ratchet step produces a completely new root key. The attacker would need to compromise a private key *again* — each ratchet step heals the breach.

#### The "Double" in Double Ratchet

| Ratchet | What It Does | Advances |
|---------|-------------|----------|
| **Symmetric** (KDF chain) | New message key per message | Every message |
| **Asymmetric** (DH) | New root key, new chains | Every direction change |

Together: a new key per message + a completely new chain per reply exchange = forward secrecy + break-in recovery.

#### What Goes Over the Wire

```
{
  header: {
    senderEphemeralPublicKey,   // for DH ratchet (plaintext, useless without private key)
    previousChainLength,        // messages in previous sending chain
    messageNumber               // position in current chain
  },
  ciphertext: AES-256(messageKey, plaintext)
}
```

## Group Chat: Sender Keys

### The Problem

In a group of N members, pairwise encryption means encrypting every message N-1 times. For a 500-member group, that's 499 encryptions per message on the sender's device.

### How Sender Keys Work

Each group member generates a **Sender Key** specific to this group:

```
User A joins group (100 members):
  1. A generates Sender Key for this group
  2. A distributes Sender Key to all 99 members
     (encrypted pairwise using each member's existing Signal session)
  3. All members store A's Sender Key

Every member does the same → each member stores 100 Sender Keys
```

**Sending a message:**

```
A encrypts "hello" with A's Sender Key → 1 ciphertext
Server fans out the same ciphertext to 99 members
Each member decrypts using A's Sender Key (already stored)
```

| Approach | Encryptions per message | Bandwidth |
|----------|------------------------|-----------|
| Pairwise | N-1 (499 for 500 members) | N-1 ciphertexts |
| **Sender Keys** | **1** | **1 ciphertext** |

### Membership Changes

**Member removed:**
- Removed member still knows everyone's Sender Keys
- **All remaining members must rotate their Sender Keys** and redistribute
- Cost: O(N²) key distribution messages — expensive but infrequent

**Member added:**
- New member needs everyone's current Sender Key → 99 pairwise messages
- New member distributes their Sender Key → 99 pairwise messages
- Existing keys are NOT rotated (new member can't read past messages — they don't have past chain states)

**Trade-off:** O(1) encryption per message, O(N²) cost on membership change. For chat where messages >>> membership changes, this is the right trade-off.

## New Device Problem

User gets a new phone. The server has **deleted** all messages (E2E model). How do they get history?

| Approach | How | Trade-off |
|----------|-----|-----------|
| **Encrypted cloud backup** (WhatsApp) | Backup encrypted with user passphrase → iCloud/Google Drive | Dependent on user remembering passphrase; cloud provider stores encrypted blob |
| **No backup** (Signal) | History lives only on device. New device = fresh start. | Maximum privacy, worst UX for device switching |
| **Device-to-device transfer** | Old device transfers history to new device over local connection | Both devices must be available simultaneously |

## What the Server Stores vs What It Can't See

| Server Stores | Server Cannot See |
|--------------|-------------------|
| Public keys (Identity, Signed Pre-Key, One-Time Pre-Keys) | Private keys |
| Encrypted message ciphertext (temporarily, until delivery) | Message plaintext |
| Who messaged whom (metadata) | Message content |
| Timestamps, message sizes | Shared secrets, message keys |
| Group membership | Sender Keys |

:::note Metadata Leakage
E2E encryption protects **content** but not **metadata**. The server knows that A messaged B at 3:47 PM, in a chat with C, D, and E. Metadata analysis can reveal communication patterns, social graphs, and relationships — even without reading messages.
:::

## Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **One-Time Pre-Keys exhausted** | X3DH falls back to 3 DH operations (no DH4) — still secure, but no one-time pre-key uniqueness | Client monitors pre-key count, uploads new batch when low |
| **Identity key compromised** | Attacker can impersonate the user | Safety number verification; key change notifications to contacts |
| **Device lost/stolen** | Attacker may extract keys from device | Device encryption (iOS/Android), remote wipe, re-register to invalidate old keys |
| **Server substitutes public keys (MITM)** | Server can intercept messages | Safety number verification (out-of-band key comparison) |
| **Sender Key not rotated after member removal** | Removed member can still decrypt new messages | Protocol enforces rotation; client blocks sending until new keys distributed |

## Related Concepts

- [API Gateway](/building-blocks/api-gateway) — authenticates users before establishing encrypted sessions
- [WebSocket Connection Management](/building-blocks/websocket-connection-management) — encrypted messages travel over WebSocket connections
- [S3 / Object Storage](/building-blocks/s3-object-storage) — media files encrypted client-side before upload
