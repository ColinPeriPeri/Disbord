# Architecture

This document captures the system design and the reasoning behind it. The
delivery plan that turns this design into shipped code lives in
[`PHASES.md`](./PHASES.md).

## Goals and non-goals

**Goals.** 1:1 text messaging, group voice and video, screen sharing, and
synchronized music playback for ~10-user friend groups. Everything runs
self-hosted on a single laptop or small VPS, exposed to the internet via a
Cloudflare Tunnel. The product feels small, fast, and personal — the way
the early web felt.

**Non-goals.** Massive scale (we are not building for thousands of
concurrent users). Mobile-native apps (web is enough; mobile browsers will
get a responsive layout but no native shell). Federation (no inter-server
protocol). End-to-end encryption (server-side encryption at rest is in
scope; E2EE between clients adds key-management complexity disproportionate
to a friend-group threat model — possible future work). High-resolution
video (720p group calls are the upper bound).

## System diagram

```
                          ┌──────────────────────┐
                          │  Cloudflare Tunnel   │   (Phase 6+)
                          └──────────┬───────────┘
                                     │ HTTPS
                                     ▼
                          ┌──────────────────────┐
                          │       Caddy 2        │   reverse proxy + TLS
                          └──────┬───────┬───────┘
                                 │       │
                     ┌───────────┘       └────────────┐
                     │                                │
                     ▼                                ▼
          ┌──────────────────┐               ┌──────────────────┐
          │    React SPA     │               │  Fastify + WS    │
          │   (Vite build)   │               │    Socket.IO     │
          └──────────────────┘               └────┬─────────────┘
                                                  │
       ┌─────────────────────┐                    │
       │   LiveKit SFU       │◀───── publishes ───┤
       │   audio / video     │                    │
       │   :7880 ws          │            ┌───────┴────────┐
       └─────────────────────┘            │   Music Bot    │
                                          │  server-side   │
                                          │  audio source  │
       ┌─────────────────────┐            └────────────────┘
       │     coturn          │
       │   STUN / TURN       │
       │     :3478           │
       └─────────────────────┘

       ┌──────────────────────────────────────────────────────┐
       │   Postgres  :5432     │     Redis  :6379             │
       │   MinIO  :9000        │     Mailhog (dev only)       │
       └──────────────────────────────────────────────────────┘
```

## Component responsibilities

**Caddy.** Public-facing reverse proxy and automatic TLS. Routes `/api/*`
to Fastify, `/socket.io/*` to Fastify's WebSocket upgrade endpoint,
`/livekit/*` to the LiveKit signaling server (WebSocket), and serves the
SPA static bundle for everything else. Activated in Phase 6.

**Fastify.** HTTP API for everything that isn't realtime media: auth,
users, channels, messages, file metadata, presence aggregation. Validates
requests with Zod via `fastify-type-provider-zod` and serves typed
responses. Issues short-lived LiveKit access tokens.

**Socket.IO.** Realtime fanout for text messages, typing indicators,
presence updates, and room signaling. Lives inside the Fastify process,
sharing the same auth context. Redis adapter (Phase 2+) lets us scale to
multiple Fastify instances later if we ever need to.

**LiveKit.** Selective Forwarding Unit for audio, video, and screen-share
streams. Clients publish their tracks to LiveKit and subscribe to peers.
The Music Bot publishes a single audio track that all clients in a room
receive, which is how synchronized music playback works without per-client
timestamps.

**Music Bot.** A Node-side LiveKit participant (running inside the API
process or as a sibling service) that decodes an audio source — MP3/FLAC
upload, a direct stream URL, or a re-published share-a-tab feed — and
publishes it as a LiveKit audio track. Single source of truth means all
listeners hear the same packets at the same time.

**Postgres.** Source of truth for users, sessions, friendships, channels,
messages, music queues, file metadata. Phase 1+ uses Drizzle ORM with
migrations versioned in the repo.

**Redis.** Volatile state: Socket.IO adapter pub/sub, presence sets, rate
limit counters, short-TTL caches. Not the source of truth — anything in
Redis can be lost without data loss.

**MinIO.** S3-compatible object store for user avatars, uploaded audio
files, and any other binary content. Lives on the same host as everything
else in dev; in production this could be swapped for Backblaze B2 or
Cloudflare R2 with no application changes.

**coturn.** STUN / TURN server. STUN is enough for most peer-to-peer
audio/video connections; TURN is the fallback for NAT scenarios that
block direct RTP. Provisioned alongside LiveKit in Phase 3.

**Cloudflare Tunnel.** Public ingress without exposing the laptop to the
open internet. The tunnel terminates at Cloudflare's edge and forwards
traffic over an outbound-only connection to Caddy. No port forwarding,
no static IP, no inbound firewall changes required.

## Key technical decisions

**LiveKit over mediasoup.** LiveKit is a managed SFU with high-level
client SDKs and a sensible server-publishes-track API. mediasoup is more
flexible but expects us to write the transport plumbing — overkill for a
10-user friend group. LiveKit's server SDK also makes the Music Bot
architecture (server-side audio publisher) the obvious path.

**Server-publishes-music for sync.** Synchronized playback across N
clients is normally an exercise in clock skew and resync logic. By
having a single server-side participant publish one audio track to a
LiveKit room, sync emerges from the SFU's normal forwarding semantics —
every subscriber receives the same packets at near-identical times.

**Lucia over rolling our own auth.** Lucia is a thin, opinionated
session library. We get secure HTTP-only session cookies, password
hashing primitives, and email verification flows without writing JWTs
by hand or maintaining a sessions table from scratch. It also leaves
room for OAuth providers in later phases without rewrites.

**Drizzle over Prisma.** Drizzle is closer to SQL, has a smaller runtime
footprint, and generates types from the schema without a separate engine
binary. Prisma's developer experience is real but its runtime weight and
opaque query planner are heavier than we need.

**Fastify over Express.** Fastify gives us 2–3× throughput, first-class
schema validation, lifecycle hooks, and an encapsulated plugin model.
Express still works, but its API is from another decade.

**Single-host deployment over k8s.** Ten users fit comfortably on one
machine. Kubernetes would add operational overhead with no scaling
benefit at this size. Phase 6 documents the single-host topology; if we
ever needed to grow, the natural next step is two hosts (DB on one,
everything else on another), not a control plane.

**Share-a-tab over server-side YouTube ripping.** Ripping audio from
YouTube via `yt-dlp` or similar violates the platform's ToS, breaks
unpredictably as their anti-scraping evolves, and routes legal liability
through us. Share-a-tab uses the client's already-authenticated session
on YouTube / Spotify / wherever — legal, robust, requires zero
server-side scraping.

## Audio source matrix

| Source                            | Supported? | Notes                                                                  |
| --------------------------------- | ---------- | ---------------------------------------------------------------------- |
| MP3 / FLAC upload                 | ✅         | Uploaded to MinIO; Music Bot decodes and publishes to LiveKit.         |
| Direct stream URL (mp3 / icecast) | ✅         | Music Bot fetches the stream and re-publishes.                         |
| Share-a-tab with audio            | ✅         | Same code path as screen share. Doubles as the YouTube / Spotify path. |
| Server-side YouTube fetch         | ❌         | Violates ToS, anti-scraping defenses make it fragile.                  |
| Server-side Spotify fetch         | ❌         | DRM — not possible without a paid B2B license.                         |

## Phase roadmap

The full 7-phase plan — deliverables, technical specs, gate criteria —
lives in [`PHASES.md`](./PHASES.md). Phase retrospectives are added to
[`RETROSPECTIVES.md`](./RETROSPECTIVES.md) after each gate.
