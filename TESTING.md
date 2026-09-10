# Testing

Use the stack-aware check before finishing behavior changes:

```bash
./scripts/check.sh
```

Current verification runs:

- `npm run typecheck`
- `npm test`, currently mapped to `npm run typecheck`

## Dry-Run Checks

Use throwaway files in `/tmp` or ignored local folders for importer checks:

```bash
npm run ingest:telegram -- --dry-run --file /tmp/telegram-fixture.json
npm run ingest:skool-notes -- --dry-run --file /tmp/skool-notes.md
npm run extract:video-links -- --dry-run --file /tmp/items.json
npm run attach:transcript -- --dry-run --item-id example --file /tmp/transcript.vtt
npm run export:weekly-brief -- --dry-run --week 2026-05-25
npx tsx src/scripts/ingest-reddit.ts --dry-run
npx tsx src/scripts/ingest-clipboard.ts --dry-run --name "Manual note test"
```

## Rules

- Test with synthetic or public data unless explicitly approved otherwise.
- Do not commit raw Telegram, Skool, Discord, or private transcript fixtures.
- Do not use real `.env` values in tests.
- Keep importer behavior idempotent as DB-backed writes are added.

## Minimal Test Record

```md
## What Changed

## What Was Tested

## How It Was Verified

## Remaining Risk
```
