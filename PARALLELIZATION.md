# Parallelization

Disbord is built by one architect (me) using a small fleet of Claude Code
sessions. This document describes the development model — not the system
architecture (which is in [`ARCHITECTURE.md`](./ARCHITECTURE.md)).

## Main thread

The main thread is sequential. One phase at a time, one feature branch at
a time, one PR into `main`. Each phase has a written specification
authored at the gate review before implementation begins; each PR ends
with a gate review by me before it merges. `main` is the single source of
truth — nothing ever lands without going through it.

The cadence is **gate-and-review**: at every phase boundary I write down
what was decided, what stayed open, and what the next phase will do. The
review is not a rubber stamp; it is the point where the next phase's
ambiguity gets resolved with the code from the previous phase in hand.

## Lookahead thread

While a phase PR is in review, a separate Claude Code session does
pre-approved isolated work that **cannot conflict with the main thread**.
Examples that pass the "isolated" test:

- UI design tokens (colors, type scale, spacing) — touched by nobody else
- Documentation that doesn't depend on Phase N+1 code (e.g., the
  contributor guide)
- Scaffolding for future-phase modules in directories not touched by the
  current phase (e.g., empty `apps/api/src/music/` while Phase 3 voice
  is in review)

Work that **does not** pass:

- Anything that edits files the current phase changes
- Anything that requires API decisions still under review
- Anything that imports from the current phase's in-flight code

The lookahead thread merges into `main` via its own PR, like everything
else. If it ever conflicts with the main thread, the lookahead thread
loses — the main thread's changes are the authoritative source.

## Side thread

Occasional one-off work: a demo recording, a blog post draft, a marketing
landing page. Same rule — small, isolated, its own PR, reviewed by me
before merge.

## Why this works

The failure mode of multi-agent development is the same as the failure
mode of long-lived feature branches: integration is deferred until it's
expensive. Disbord avoids that by being aggressive about merging the main
thread frequently and constraining parallel work to truly isolated
surfaces.

The architect-level work (deciding what to build, evaluating tradeoffs,
reviewing the result) is the bottleneck and the point — that's the human
in this loop. Everything downstream is parallelizable because the
specifications are explicit. If a phase spec is too vague to delegate, it
isn't ready for implementation yet.
