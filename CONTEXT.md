# Context

## What This Project Is

`creator-intel-pipeline` is the creator intelligence ingestion pipeline for the creator research program.

It turns messy community and video signals into reviewed evidence cards, findings, and suggested experiments. The core v1 flow is:

```text
signal -> evidence card -> finding -> suggested experiment -> research bundle
```

## Who It Serves

- Cesar and collaborators doing creator research.
- The `downstream-research-repo` repo, which receives sanitized findings and experiment ideas.
- Future coding agents that need a safe place to work on ingestion, transcript enrichment, and export tooling.

## Success Criteria

- The project can be bootstrapped from a fresh checkout.
- The main verification command is documented and works.
- Private/raw source material stays local and ignored.
- Weekly exports can be copied into `downstream-research-repo/research/bundles/YYYY-MM-DD-community-intel/`.
- The first useful brief can produce 10 findings, 5 workflow patterns, 3 creator-persona experiments, 1 monetization insight, and 1 tool/provider insight.

## Non-Goals

- This is not the research memory repo.
- This is not a production automation service.
- This is not a scraper-first system.
- Do not automate logged-in Telegram, Skool, Discord, or paid-community access without a new decision.
- Do not store private community archives, cookies, browser profiles, or secrets in git.

## Architecture

The repo has four layers:

- Sources: Telegram, Skool, Reddit, YouTube, Vimeo, Discord, and manual notes.
- Items/artifacts: normalized messages, posts, links, transcripts, metadata, and raw archive pointers.
- Evidence cards/findings: reviewed evidence with reliability, privacy level, category, and suggested action.
- Exports: sanitized weekly briefs for the research repo.

Storage direction is Supabase/Postgres using the `intel` schema. Raw local archives live under ignored `data/` folders and are referenced by pointer only.

Supabase note: direct Prisma/Postgres access works after `supabase-migration.sql` runs. Supabase REST/PostgREST access also requires adding `intel` to the project's exposed schemas in the Supabase Dashboard API settings.

## Mac vs VPS Operating Model

Mac local:

- Telegram exports and saved-message files.
- Skool manual notes.
- Paid/private source archives.
- Browser-assisted capture only after explicit approval.
- Raw local archive and private transcript files.

VPS later:

- Public Reddit pulls.
- Public video metadata/transcript attempts.
- Scheduled non-sensitive enrichment.
- Weekly brief generation from sanitized inputs.

## Local Commands

```bash
./scripts/bootstrap.sh
./scripts/check.sh
npm run ingest:telegram -- --dry-run --file fixtures/telegram-export.json
npm run ingest:skool-notes -- --dry-run --file fixtures/skool-notes.md
npm run extract:video-links -- --dry-run --file fixtures/items.json
npm run attach:transcript -- --dry-run --item-id example --file fixtures/transcript.vtt
npm run export:weekly-brief -- --dry-run --week 2026-05-25
```

## Constraints

- Security: never commit `.env`, tokens, cookies, browser profiles, or service role keys.
- Compliance/data: private and paid-community content stays local-only and is summarized before export.
- Performance: v1 optimizes for useful findings, not high-volume crawling.
- Cost: use dry-runs and manual import paths before adding paid services or scheduled infrastructure.
- Operational: browser automation is fragile and disabled by default.

## External Systems

| System | Purpose | Owner | Notes |
| --- | --- | --- | --- |
| Supabase/Postgres | Normalized intel store | Cesar | Uses `intel` schema; service role key is local-only. |
| Telegram | Private/community source signal | Cesar | V1 uses local export/import or saved-message files. |
| Skool | Paid/community source signal | Cesar | V1 uses manual notes, not scraping. |
| Reddit | Public trend and failure-case radar | Public | Existing public JSON ingestion path. |
| YouTube | Linked video enrichment | Public/auth-dependent | Transcript method must be recorded. |
| Vimeo | Linked video enrichment | Public/auth-dependent | Transcript access may require owner/API permission. |
