# Contributing

Disbord is a portfolio project. This guide is primarily a checklist for me
and any future contributors who join the project.

## Setting up the dev environment

Prerequisites: a recent Docker, [nvm](https://github.com/nvm-sh/nvm) (or
direct Node 24 install), and [pnpm 9](https://pnpm.io/installation).

```bash
# Pick up Node 24 from .nvmrc.
nvm use

# Install workspace dependencies.
pnpm install

# Boot Postgres, Redis, MinIO, LiveKit, Mailhog.
docker compose -f infra/docker-compose.yml up -d

# Copy the env template (defaults are dev-safe).
cp .env.example .env

# Run the API + web in parallel.
pnpm dev
```

The frontend is at <http://localhost:5173>, the API at
<http://localhost:3001/api/health>. See the README for the full URL list.

## Branch naming

| Prefix             | Use for                                      |
| ------------------ | -------------------------------------------- |
| `phase/N-name`     | A whole phase (PHASES.md). One per phase.    |
| `fix/short-desc`   | Bug fixes against `main`.                    |
| `chore/short-desc` | Tooling, deps, infra without product impact. |
| `docs/short-desc`  | Documentation-only changes.                  |

Avoid `feature/...` outside the phase model. A "new feature" without a
phase home is a signal that the plan needs updating before the code does.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/) — enforced
by commitlint via the `commit-msg` Husky hook.

Allowed types in this project:

`feat`, `fix`, `chore`, `ci`, `docs`, `test`, `refactor`, `style`,
`perf`, `build`.

The subject is lowercase, imperative, ≤ 100 chars total header length.
The body explains _why_, not _what_ — the diff already shows what.

Examples:

```
feat(api): add /api/auth/login with argon2id verification
chore(deps): pin typescript to 5.6.3
fix(web): handle health check 500 without unmounting App
```

## Pre-commit hooks

Husky runs `lint-staged` on staged files:

- `*.{ts,tsx,js,jsx,cjs,mjs}` → `prettier --write` + `eslint --fix`
- `*.{json,md,yml,yaml,css,html}` → `prettier --write`

If a hook fails, fix the issue and re-stage. Don't bypass with
`--no-verify` — if the hook is wrong, fix the hook in its own PR.

## Running the checks locally

```bash
pnpm typecheck   # tsc --noEmit across workspaces
pnpm lint        # eslint across workspaces
pnpm test        # vitest run across workspaces
pnpm build       # tsc / vite build across workspaces
pnpm format      # prettier --write at the root
```

CI runs the same four (`typecheck`, `lint`, `test`, `build`) on every
push and PR.

## Pull requests

Open PRs against `main`. Use the template
([`.github/pull_request_template.md`](./.github/pull_request_template.md))
— it asks for a summary, a list of changes, verification steps, and a
phase reference where applicable. Screenshots or screen recordings for
UI changes.

PRs merge with a **squash merge** so `main`'s history reads one commit per
PR. Conventional Commit titles carry into the squashed commit.

## Code quality standards

These are enforced by lint and review, not just convention:

- **TypeScript strict mode.** `any` is an ESLint error. Unjustified `as`
  casts are a code-review block.
- **Explicit return types** on all exported functions
  (`@typescript-eslint/explicit-module-boundary-types: error`).
- **No `console.log`.** Use the logger
  (`fastify.log` on the server; `console.warn` / `console.error` are
  allowed for genuine failures in the browser).
- **No magic numbers / strings.** Pull constants to the top of the
  file or into a dedicated module.
- **One responsibility per module.** Files much over 200 lines are a
  smell; consider splitting.
- **Tests sit next to the code** they cover: `foo.test.ts` next to
  `foo.ts`.

## What goes where

| Concern                                    | Location               |
| ------------------------------------------ | ---------------------- |
| API routes / plugins                       | `apps/api/src/`        |
| React UI                                   | `apps/web/src/`        |
| Types / schemas shared between web and api | `packages/shared/src/` |
| Base TS config                             | `packages/tsconfig/`   |
| Infra (compose, configs)                   | `infra/`               |
| Architecture / plan docs                   | repo root (`*.md`)     |
| CI                                         | `.github/workflows/`   |

If a piece of code doesn't fit any of the above, it's probably a sign
that the boundary is wrong — flag it in the PR.
