# Antigravity Instructions

Read `AGENTS.md` first. This file is a thin compatibility wrapper for Antigravity or another agent tool.

## Default Workflow

1. Ground in `CONTEXT.md`, `ROADMAP.md`, and `MEMORY.md`.
2. Inspect the current implementation before making claims.
3. Use relevant skills after reading local context.
4. Make focused changes.
5. Run `./scripts/check.sh` when relevant.
6. Update `MEMORY.md` for durable decisions or traps.

## Boundaries

- Do not overwrite user work.
- Do not commit secrets.
- Do not invent missing project facts; record unknowns in `ROADMAP.md` or ask.

