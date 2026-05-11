# Disbord

## What is Disbord?

Disbord is a self-hosted Discord clone for ~10-friend groups. The goal is a
focused experience for a small private circle: 1:1 text messaging, group
voice and video, screen sharing, and synchronized music playback — all
running on a single laptop or small VPS behind a Cloudflare Tunnel. It is
built as a portfolio piece. Massive scale, mobile-native apps, and federation
are explicit non-goals.

## Status

| Phase | Title                       | Status |
| ----- | --------------------------- | ------ |
| 0     | Foundation                  | ✅     |
| 1     | Auth & user system          | ⏳     |
| 2     | 1:1 messaging & presence    | ⏳     |
| 3     | Voice & video rooms         | ⏳     |
| 4     | Screen share                | ⏳     |
| 5     | Synchronized music playback | ⏳     |
| 6     | Polish & deployment         | ⏳     |

The full roadmap, per-phase deliverables, and gate criteria live in
[`PHASES.md`](./PHASES.md). System design and decision rationale live in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech stack

- [Node.js 24 LTS](https://nodejs.org/) + [pnpm 9](https://pnpm.io/) workspaces
- [TypeScript](https://www.typescriptlang.org/) (strict, `noUncheckedIndexedAccess`)
- [Fastify 4](https://fastify.dev/) + [`fastify-type-provider-zod`](https://github.com/turkerdev/fastify-type-provider-zod) for the API
- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) + [SWC](https://swc.rs/) for the SPA
- [Tailwind CSS 3.4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (slate, dark mode)
- [Zustand](https://zustand-demo.pmnd.rs/) + [TanStack Query](https://tanstack.com/query) on the client
- [Postgres 16](https://www.postgresql.org/), [Redis 7](https://redis.io/), [MinIO](https://min.io/) for state
- [LiveKit](https://livekit.io/) for voice / video / screen share (Phase 3+)
- [Mailhog](https://github.com/mailhog/MailHog) for dev SMTP
- [Caddy 2](https://caddyserver.com/) for the reverse proxy (Phase 6+)
- [Vitest](https://vitest.dev/), [ESLint 9](https://eslint.org/), [Prettier](https://prettier.io/), Husky, lint-staged, commitlint

## Local development

```bash
# 1. Use Node 24 (picked up from .nvmrc).
nvm use

# 2. Install workspace dependencies.
pnpm install

# 3. Boot the local infrastructure stack.
docker compose -f infra/docker-compose.yml up -d

# 4. Run the API + web app together.
pnpm dev
```

Service URLs (defaults):

| Service         | URL                                         | Notes                                         |
| --------------- | ------------------------------------------- | --------------------------------------------- |
| Frontend (Vite) | http://localhost:5173                       | Proxies `/api/*` to the backend.              |
| API (Fastify)   | http://localhost:3001/api/health            | `{ status, timestamp }`                       |
| MinIO console   | http://localhost:9001                       | Credentials in `.env.example` (dev defaults). |
| Mailhog UI      | http://localhost:8025                       |                                               |
| LiveKit         | ws://localhost:7880                         | Used from Phase 3.                            |
| Postgres        | `postgres://disbord@localhost:5432/disbord` | Password in `.env.example`.                   |
| Redis           | `redis://localhost:6379`                    |                                               |

Verify the toolchain at any time:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Repo layout

```
disbord/
├── apps/
│   ├── api/         # Fastify backend
│   └── web/         # React + Vite SPA
├── packages/
│   ├── shared/      # Types / Zod schemas shared between web and api
│   └── tsconfig/    # Shared base tsconfig
├── infra/
│   ├── docker-compose.yml
│   ├── caddy/       # Reverse-proxy config (enabled in Phase 6)
│   └── livekit/     # LiveKit dev config
├── .github/         # CI + PR template
├── .husky/          # Git hooks (pre-commit, commit-msg)
└── ARCHITECTURE.md, PHASES.md, PARALLELIZATION.md, RETROSPECTIVES.md, CONTRIBUTING.md
```

## How this was built

I architected Disbord end-to-end: system design, technology selection, data
models, API contracts, deployment strategy, and the phased delivery plan
documented in [`PHASES.md`](./PHASES.md) and
[`ARCHITECTURE.md`](./ARCHITECTURE.md). Implementation was delegated to
Claude Code, working from detailed phase specifications I authored and
against gate reviews I conducted at each phase boundary. Every PR was
reviewed and approved by me before merging to `main`.

This workflow — architect-led, AI-implemented, human-reviewed — is how I
think serious software gets built in 2026. The artifacts that matter
(architecture decisions, tradeoffs, retrospectives) are mine; the typing
was delegated.

## License

[MIT](./LICENSE)
