# Phases

Disbord ships in seven phases. Each phase has a single architect-led
specification (gate review at the boundary), a single feature branch, and a
single PR into `main`. The plan is sequential: Phase N+1 does not start
until Phase N is merged. The exception is the lookahead thread documented
in [`PARALLELIZATION.md`](./PARALLELIZATION.md), which does pre-approved
isolated work in parallel.

Open questions inside each phase are deliberate — they are not gaps in the
plan but decisions that benefit from being made with the code in hand at
the gate review.

---

## Phase 0 — Foundation

**Goal.** Stand up the monorepo, infrastructure, and tooling. No product
features. Everything from later phases will plug into the scaffolding built
here.

**Deliverables.**

- [x] pnpm workspace with `apps/{web,api}` and `packages/{shared,tsconfig}`
- [x] React + Vite + SWC + Tailwind + shadcn (init) frontend showing
      "Disbord — Phase 0" and querying `/api/health`
- [x] Fastify + Zod backend with `GET /api/health` and graceful shutdown
- [x] Docker Compose stack: Postgres, Redis, MinIO, LiveKit, Mailhog
      (Caddy defined but disabled until Phase 6)
- [x] CI workflow on every push: typecheck, lint, test, build
- [x] Husky + commitlint + lint-staged enforcing Conventional Commits
- [x] `ARCHITECTURE.md`, `PHASES.md`, `RETROSPECTIVES.md`,
      `PARALLELIZATION.md`, `CONTRIBUTING.md`

**Key technical specs.**

- Node 24 LTS, pnpm 9, TypeScript 5.5+ (strict, `noUncheckedIndexedAccess`)
- React 18.3 + Vite 5 + `@vitejs/plugin-react-swc`
- Fastify 4 with `@fastify/cors`, `@fastify/helmet`, `@fastify/sensible`,
  `@fastify/env`, `fastify-type-provider-zod`
- Tailwind 3.4 + shadcn (slate, dark mode) — init only, no components
- Vitest for both apps; ESLint flat config at the root applying to all
  workspaces

**Gate criteria.**

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes
  locally and in CI.
- `pnpm dev` boots the API on `:3001` and the SPA on `:5173`. The SPA
  fetches `/api/health` and renders `backend: ok`.
- `docker compose -f infra/docker-compose.yml up -d` starts Postgres,
  Redis, MinIO (console at `:9001`), LiveKit (`:7880`), and Mailhog
  (`:8025`) healthily.

---

## Phase 1 — Auth & user system

**Goal.** Working signup → email verification → login → session flow.
Verified accounts are the only ones allowed past the login screen. Account
identity is a tuple of a stable `username` and a mutable `displayName`,
mirroring Discord — the username is what other users `@`-reference, the
display name is what they see.

**Locked decisions** (already settled at the Phase 0 → 1 gate, not open
for re-debate during implementation):

- Username + displayName model, Discord-style.
- Email verification is required before first login.

**Deliverables.**

- [ ] Drizzle schema for `users`, `sessions`, `email_verifications`,
      and Drizzle migrations checked in
- [ ] `POST /api/auth/signup`, `POST /api/auth/verify`,
      `POST /api/auth/login`, `POST /api/auth/logout`,
      `GET /api/auth/me`
- [ ] Session middleware that decorates `request.user` from the cookie
- [ ] Mailhog-integrated verification email
- [ ] Argon2id password hashing
- [ ] Rate limiting on auth endpoints (per IP + per account)
- [ ] Web pages: signup, login, verification-pending, verification-success,
      logged-in landing
- [ ] End-to-end test that walks signup → verify → login → `/api/auth/me`

**Key technical specs.**

- [Lucia](https://lucia-auth.com/) for session primitives; sessions stored
  in Postgres
- HTTP-only, SameSite=Lax session cookies — no JWTs in this phase
- Verification tokens single-use, 24h TTL, opaque random bytes
- Argon2id with sane defaults (m=64MB, t=3, p=4)
- Username validation: 3–32 chars, `[a-z0-9_]`, immutable after creation
- displayName: 1–32 chars, Unicode allowed, mutable

**Open questions** (resolve at the Phase 1 → 2 gate):

- OAuth providers (Google / GitHub) — Phase 2 or Phase 6?
- Password reset flow in this phase or deferred?
- Username changes — disallowed forever, or rate-limited?

**Gate criteria.**

- A new user can sign up, receive an email in Mailhog, click the
  verification link, log in, see their `/me`, and log out. The session
  cookie is invalidated server-side on logout.
- Unverified accounts cannot log in.
- Rate limit triggers on 5 failed logins per IP in 60s.

---

## Phase 2 — 1:1 messaging & presence

**Goal.** Real 1:1 text messaging with presence and typing indicators.
Two friends can open the app, see each other online, and chat.

**Deliverables.**

- [ ] Drizzle schema for `friendships`, `dm_channels`, `messages`
- [ ] Friend-request flow (send / accept / reject)
- [ ] Socket.IO server attached to Fastify, sharing the session auth
- [ ] Realtime message send / receive, typing indicators, presence
      (online / idle / offline)
- [ ] Message history pagination (cursor-based, 50 per page)
- [ ] Web UI: friends list, DM thread, message composer

**Key technical specs.**

- Socket.IO with `@socket.io/redis-adapter` (forward-compatible with
  multi-instance even though Phase 6 ships single-host)
- Presence tracked in Redis sets keyed by `presence:<userId>` with a TTL
  refreshed by the socket's ping
- Message edits and soft-deletes from day one — no destructive deletes
  ever land in this codebase
- All HTTP routes that touch friends/messages require an authenticated
  session

**Open questions** (resolve at the Phase 2 → 3 gate):

- How rich do messages get — markdown? mentions? attachments?
- Group DMs in this phase or after voice rooms?
- Read receipts — opt-in, default-on, or absent?

**Gate criteria.**

- Two browser sessions can exchange messages in real time.
- Presence transitions visible within 5s of disconnect.
- Refreshing the page restores history and re-establishes presence.

---

## Phase 3 — Voice & video rooms

**Goal.** Persistent rooms a friend group can drop into. Group voice and
video for up to ~10 participants. Mute / deafen / leave work.

**Deliverables.**

- [ ] Drizzle schema for `rooms`, `room_members`
- [ ] LiveKit token issuance endpoint (short-TTL JWT keyed by room + user)
- [ ] Web UI: room list, room view with participant tiles, mute/deafen,
      device picker
- [ ] LiveKit room lifecycle (auto-create / cleanup empty rooms)
- [ ] coturn deployment alongside LiveKit

**Key technical specs.**

- LiveKit web SDK on the client; server SDK on Fastify for token signing
- coturn with credentials rotated from the API
- Codec config: Opus for audio, VP8 for video (broad codec support)
- Adaptive simulcast for video to handle mixed-bandwidth participants
- Token TTL: 15 minutes, refresh endpoint for long sessions

**Open questions** (resolve at the Phase 3 → 4 gate):

- Recording — in scope for any phase, or never?
- Push-to-talk vs always-open mic — default behavior?
- What does the room UX look like with 1, 3, 10 participants?

**Gate criteria.**

- Three users can join the same room and see/hear each other within 3s
  of joining.
- Mute, deafen, leave all work; rejoining picks up the conversation.
- A user dropping their connection cleanly leaves the room within 30s.

---

## Phase 4 — Screen share

**Goal.** A user can share a tab, window, or whole screen into a room.
Other participants see the shared screen and (when permitted) hear its
audio.

**Deliverables.**

- [ ] Screen-share button in the room toolbar
- [ ] LiveKit screen-share track publication path
- [ ] "Active sharer" UI: the shared screen takes the main viewport;
      other tiles dock to the side
- [ ] Tab-audio support for share-a-tab (browser-permitting)

**Key technical specs.**

- `getDisplayMedia({ audio: true })` with graceful fallback when audio
  capture is unavailable
- Separate LiveKit track per screen-share publication
- One active sharer at a time per room in this phase

**Open questions** (resolve at the Phase 4 → 5 gate):

- Multiple simultaneous shares — useful, or visual noise?
- Annotation / "draw on the share" — defer indefinitely?

**Gate criteria.**

- A user can share a tab with audio. Other room members see and hear it.
- Stopping the share returns the room to the normal tile layout.

---

## Phase 5 — Synchronized music playback

**Goal.** Per-room music queue. Drop in an MP3, paste a stream URL, or
share a tab. All listeners hear the same packets at the same time. This
is the headline feature of Disbord.

**Deliverables.**

- [ ] Drizzle schema for `music_queues`, `music_items`
- [ ] Music Bot service: a server-side LiveKit participant that publishes
      one audio track per room
- [ ] Audio source ingestion: file upload to MinIO, direct stream URL,
      re-publish of a share-a-tab feed
- [ ] Queue UI: add / reorder / vote-skip / now-playing
- [ ] Server-side decoding via FFmpeg

**Key technical specs.**

- Music Bot connects to LiveKit as a normal participant identity
  (`bot:<roomId>`) so existing room ACLs apply
- One Music Bot instance per active room; idle bots are reaped
- Decoded audio fed to LiveKit's track-publish API as Opus frames
- Sync emerges from LiveKit's forwarding — there is no per-client
  resync logic, because the SFU dispatches the same packets to everyone

**Open questions** (resolve at the Phase 5 → 6 gate):

- Music Bot — same process as Fastify, or sibling service?
- Should the queue persist across restarts, or be ephemeral per session?
- File-upload size limits and storage quotas per user?

**Gate criteria.**

- An MP3 uploaded by one user plays for three listeners with no audible
  drift.
- A direct stream URL plays for the same group with no audible drift.
- A user sharing a YouTube tab (audio captured) plays for the same group
  with no audible drift.

---

## Phase 6 — Polish & deployment

**Goal.** Production-ready deployment. Public URL via Cloudflare Tunnel
behind Caddy. Onboarding for a new user feels finished. The host can be
nuked and restored from backups in under 30 minutes.

**Deliverables.**

- [ ] Activated Caddy reverse proxy (`infra/caddy/Caddyfile`)
- [ ] Cloudflare Tunnel setup documented + checked-in config template
- [ ] Production `.env` template with no dev defaults
- [ ] Nightly Postgres backups to MinIO with retention policy
- [ ] MinIO replication path (off-host) documented (optional execution)
- [ ] Restart and log-rotation policies verified across all services
- [ ] Runbook: deploy, upgrade, restore, common-failure recovery
- [ ] Pre-launch polish: empty-state copy, error pages, favicon, OG tags

**Key technical specs.**

- Caddy auto-TLS via Let's Encrypt; certificates persist in a named volume
- Cloudflare Tunnel as outbound-only ingress — no port forwarding on the
  host
- pg_dump cron in a sidecar container, dumps to MinIO via the S3 SDK
- Single-host topology — explicit non-goal of horizontal scaling

**Open questions** (resolve at the Phase 6 → 1.0 gate):

- Monitoring: Grafana + Prometheus, or something lighter (uptime ping
  - log scrape)?
- On-call story for a 10-user system — is there one?

**Gate criteria.**

- An external user can hit `https://<host>` and use every Phase 1–5
  feature.
- Killing and recreating the host from backups restores all user data,
  files, and message history.
- All services come up healthy after a clean reboot of the host.
