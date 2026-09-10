# Memory

Durable facts for future humans and agents. Keep this short, concrete, and useful.

## Stable Facts

- This repo is the intel ingestion and export pipeline for the creator research program.
- `downstream-research-repo` is the sanitized research memory; this repo owns collectors, raw local archive pointers, transcript enrichment, evidence cards, findings, and exports.
- The v1 product is a weekly intel brief, not a crawler.
- Storage direction is Supabase/Postgres using the `intel` schema.

## Repeated Decisions

- Use semi-manual intake first for Telegram and Skool.
- Keep raw private/paid community content in ignored local storage only.
- Export summaries, evidence pointers, findings, and suggested experiments to the research repo.
- Treat browser automation as fragile and opt-in, not a default v1 path.

## Known Traps

- `src/db.ts` depends on `@supabase/supabase-js`; keep package dependencies aligned with imports.
- YouTube and Vimeo transcripts may be unavailable, unofficial, auto-generated, or authorization-gated.
- Telegram export formats vary; importers must be tolerant and idempotent.
- Private source text must not leak into research exports.
- Supabase service role keys must stay local-only.

## Preferences

- Optimize for useful findings over high collection volume.
- Hash author identifiers by default.
- Record transcript method and source reliability whenever video content is enriched.
- Keep scripts dry-run friendly.
- Keep a living Q&A log in `docs/qa-log.md` for ingestion/modeling decisions that future agents should not rediscover.

## Session Notes

```text
2026-05-25 - Community intel pipeline setup
- What changed: Planned repo hardening for Telegram, Skool, Reddit, YouTube, and Vimeo intel ingestion.
- Decision: Use this existing repo instead of creating a new one.
- Next useful step: Produce the first sanitized weekly intel brief from Telegram links, Skool notes, and Reddit baseline data.

2026-05-26 - Telegram export modeling
- What changed: Confirmed Telegram topic exports are separate source files and added a living intel Q&A log.
- Decision: Import each Telegram topic export as a separate source; keep media metadata but not media binaries.
- Next useful step: Import `examplecommunity-snapchat` after validating the richer importer on a small batch.

2026-05-26 - Evidence card review queue
- What changed: Added source health reporting and generated the first 122 Supabase evidence cards from stable ExampleCommunity Telegram sources.
- Decision: Evidence generation should skip unstable legacy Telegram source URLs by default.
- Next useful step: Review candidate evidence cards, promote the best ones into findings, then produce the first weekly brief.

2026-05-27 - First weekly brief generated
- What changed: Expanded stable Telegram imports to 5,000 items per source, generated 1,516 evidence cards total, promoted 8 aggregated findings, and exported the first sanitized weekly brief bundle.
- Decision: The findings layer is aggregated from repeated evidence-card themes instead of treating single cards as research-ready claims.
- Next useful step: Copy the sanitized brief into `downstream-research-repo`, then improve source scoring and add the next private/manual source such as Skool notes.
```
