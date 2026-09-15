# creator-intel-pipeline

Creator intelligence ingestion pipeline for creator research.

This repo collects and normalizes source material from communities and videos, then turns it into reviewed evidence cards, findings, and suggested experiments. It feeds sanitized outputs into the separate `downstream-research-repo` repo.

```text
signal -> evidence card -> finding -> suggested experiment -> research bundle
```

## Repo Boundary

`creator-intel-pipeline` handles:

- local/raw ingestion
- Telegram exports
- Skool manual notes
- Reddit public intake
- YouTube/Vimeo link and transcript enrichment
- Supabase/Postgres schemas
- weekly sanitized exports

`downstream-research-repo` handles:

- research bundles
- decisions
- source registers
- creator persona workflow implications
- sanitized findings only

Raw private or paid community content must not be copied into `downstream-research-repo`.

## Quick Start

```bash
./scripts/bootstrap.sh
./scripts/check.sh
```

If the project needs environment variables:

```bash
cp .env.example .env
```

Do not commit `.env`.

## Supabase Setup

Run the checked-in migration after `DATABASE_URL` points at the project database:

```bash
npx prisma db execute --file supabase-migration.sql --schema prisma/schema.prisma
```

The migration creates the `intel` schema and these tables:

- `sources`
- `items`
- `item_tags`
- `artifacts`
- `evidence_cards`
- `findings`

For `src/db.ts` and Supabase REST queries to see the custom schema, also add `intel` to exposed schemas in:

```text
Supabase Dashboard -> Project Settings -> API -> Exposed schemas
```

Direct Prisma/Postgres access works as soon as the SQL migration succeeds.

## Common Commands

```bash
npm run typecheck
npm run ingest:telegram -- --dry-run --file data/raw/example-telegram-export.json
npm run build:evidence-cards -- --dry-run --source "ExampleCommunity" --limit 500
npm run build:findings -- --dry-run --limit 5000 --max-findings 12
npm run ingest:skool-notes -- --dry-run --file data/raw/example-skool-notes.md
npm run extract:video-links -- --dry-run --file data/processed/example-items.json
npm run attach:transcript -- --dry-run --item-id example --file data/transcripts/example.vtt
npm run export:weekly-brief -- --dry-run --week 2026-05-25
```

Current working path for weekly community intel:

```text
ingest source -> build evidence cards -> build findings -> export weekly brief
```

Existing experimental scripts:

```bash
npx tsx src/scripts/ingest-reddit.ts --dry-run
npx tsx src/scripts/ingest-clipboard.ts --dry-run --name "Manual note"
```

Browser automation exists experimentally in `src/scripts/ingest-playwright.ts`, but it is opt-in and not part of v1.

## Local Storage

Ignored local folders:

```text
data/raw/              private Telegram/Skool/manual exports
data/processed/        normalized intermediate files
data/transcripts/      local transcript files
exports/research-briefs/ sanitized generated briefs
```

Only sanitized schema files, docs, scripts, and fixtures should be committed.

## Weekly Export Shape

The target research bundle shape is:

```text
downstream-research-repo/research/bundles/YYYY-MM-DD-community-intel/
  README.md
  findings.json
  source-register.md
  suggested-experiments.md
```

Exports should include findings, evidence pointers, confidence, source reliability, privacy notes, and suggested creator persona experiments.

## Project Context

Read these first:

- `CONTEXT.md` - purpose, architecture, constraints, and local commands.
- `ROADMAP.md` - current priorities and known open questions.
- `MEMORY.md` - durable project facts and repeated decisions.
- `SECURITY.md` - raw archive and private-source handling.
- `docs/qa-log.md` - living record of intel modeling questions and decisions.
- `AGENTS.md` - instructions for AI coding agents.
