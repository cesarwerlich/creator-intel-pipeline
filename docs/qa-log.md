---
title: Intel Q&A Log (living)
status: living
version: 0.1
last_updated: 2026-05-26
owner: Cesar (questions); Codex (answers)
---

# Intel Q&A Log

A persistent record of implementation and product questions for `creator-intel-pipeline`, paired with working answers and doc/code follow-ups.

## How to use this log

- Add new questions at the end of the current dated session.
- Give every question an ID (`IQ-001`, `IQ-002`, ...).
- Use this for decisions that explain why the pipeline stores or ignores specific data.
- Keep raw private content out of this file.

## Status values

- `answered-here` - full answer is captured in this log.
- `implemented` - answer led to a code/docs change that has been implemented.
- `needs-doc-update` - answer is decided but still needs documentation.
- `deferred` - needs more evidence or a separate decision.

---

## Session 2026-05-26 - Telegram export modeling

### IQ-001 - Did we export only `#General`, or are other Telegram groups/topics included?

**Status**: `implemented`

**Question**: "Did we export only #General, it seems and the other groups are not there? Like Snapchat or Instagram?"

**Answer**: The `examplecommunity-#general` export is one exported Telegram topic/source. It has top-level metadata:

```text
name: ExampleCommunity Group
type: public_supergroup
messages: 114,068
```

The `examplecommunity-snapchat` export is a separate topic/source:

```text
name: Snapchat
type: public_supergroup
messages: 17,887
```

So we should not treat the first export as the whole community. Each exported Telegram topic should become its own `Source` row in Supabase, using a source name such as `ExampleCommunity General` or `ExampleCommunity Snapchat`.

**Implementation impact**: Keep importing exported folders separately. Preserve Telegram export top-level metadata and topic/service events in item metadata.

### IQ-002 - Are files/images relevant enough to import?

**Status**: `implemented`

**Question**: "Files might not be relevant, why do you think so?"

**Answer**: Binary files/images are not worth importing in v1. They add storage, privacy, review, and copyright risk before we know they change decisions.

Media metadata is worth importing because it helps answer workflow and market-signal questions:

- Are people sharing screenshots, videos, voice notes, stickers, or documents?
- Which topics are media-heavy versus text/link-heavy?
- Are videos/tutorials appearing as files or external links?
- Are screenshots used as proof, troubleshooting, or revenue claims?

**Implementation impact**: Do not download or store media binaries. Store only metadata such as `media_type`, `mime_type`, `file_name`, `file_size`, `duration_seconds`, `width`, `height`, and whether Telegram included the file.

### IQ-003 - Which Telegram JSON fields are relevant for import?

**Status**: `implemented`

**Question**: "Can you check the JSON schema from the export if there are more relevant fields to import?"

**Answer**: Relevant fields found in the export:

- `type`, `action`, `title`, `new_title`: service and topic lifecycle events.
- `text`, `text_entities`, `inline_bot_buttons`: text and hidden links.
- `reply_to_message_id`: conversation context.
- `edited`, `edited_unixtime`: revision signal.
- `reactions`: engagement signal.
- `forwarded_from`, `forwarded_from_id`: repost/source context.
- `poll`: market signal.
- `author`: admin-style attribution.
- media metadata fields, but not media binaries.

**Implementation impact**: Telegram importer now parses service events, media-only messages, entity/button links, and stores the extra fields under `items.metadata`.

### IQ-004 - What would senior engineering, PM, and DevOps evaluate next?

**Status**: `implemented`

**Question**: "If we are to hire now a senior software engineer, a product manager and DevOps, what would they evaluate of the project, how would they question each other's role, and how will we attack that plan?"

**Answer**: They would converge on the same next milestone: make the first weekly brief real, but each role would pressure the system differently.

Senior software engineer:

- Check whether ingestion is idempotent, observable, and recoverable.
- Challenge the PM: "Which data is actually decision-changing, and what can we ignore?"
- Challenge DevOps: "Can we run imports safely without exposing secrets or polluting Supabase?"
- Required next improvements: stable source identity, importer dedupe, source stats, fixture tests, and a reusable source adapter pattern only after Telegram and Skool prove the shape.

Product manager:

- Check whether imported data becomes findings and experiments, not just rows.
- Challenge engineering: "Does this help choose the next creator persona test?"
- Challenge DevOps: "Can non-engineers run the weekly flow without breaking private-data rules?"
- Required next improvements: review queue, evidence-card rubric, first weekly brief, and source usefulness scoring.

DevOps / platform:

- Check secrets, raw data boundaries, Supabase permissions, repeatability, and operational blast radius.
- Challenge engineering: "What happens when an import dies halfway through 114k messages?"
- Challenge PM: "Which sources are worth scheduling versus keeping manual?"
- Required next improvements: import logs, source health reports, chunked/resumable imports, and no VPS/browser automation until public-source jobs are boring.

**Attack plan**:

1. Stabilize source identity so local folder names do not create duplicate sources.
2. Import each Telegram topic as a separate source.
3. Add stats and health checks before importing full archives.
4. Build evidence cards from high-signal imported rows.
5. Generate the first weekly brief and copy only sanitized outputs to `downstream-research-repo`.

**Implementation impact**: Source identity no longer uses local file path. The path remains only as raw-export artifact metadata.

### IQ-005 - Should Cesar answer any questions before we continue?

**Status**: `answered-here`

**Answer**: Not for the immediate engineering pass. The current plan can proceed with reasonable defaults:

- Separate Telegram topics as separate sources.
- Skip binary media, keep media metadata.
- Treat raw exports as private local-only.
- Prioritize first weekly brief over broader automation.

The next useful human judgment will be after we surface candidate evidence cards, because that is where product taste matters.

### IQ-006 - What would the first hired senior SWE, PM, DevOps, and CTO change?

**Status**: `implemented`

**Question**: "If we are to hire now a senior software engineer, a product manager and DevOps, what would they evaluate, how would they question each other, and how will we attack that plan?"

**Answer**: The first operating improvement is not more scraping. It is a tighter loop from imported source rows to reviewable evidence cards.

Senior software engineering would push for idempotent imports, stable source identity, duplicate detection, test fixtures, and a clear path from raw exports to normalized items. The engineer would challenge the PM to define what "useful intel" means, and challenge DevOps to make reruns observable and safe.

Product would push for reviewable evidence cards, source usefulness scoring, and a weekly brief shape that directly feeds creator-persona experiments. The PM would challenge engineering to stop at the smallest evidence model that creates decisions, and challenge DevOps to keep the workflow runnable by a non-engineer.

DevOps would push for source health checks, secret hygiene, ignored raw archives, resumable batches, and a hard boundary between local private imports and later VPS-safe public enrichment. DevOps would challenge engineering on failure recovery and challenge product on which sources deserve automation.

The CTO lens would keep the system semi-manual until the evidence quality proves itself. Browser automation, Telegram client automation, and paid-community scraping remain opt-in future risks, not v1 dependencies.

**Implementation impact**: Added source health reporting and a bounded evidence-card generator. The generator uses stable Telegram sources by default and skips the legacy local-path source unless explicitly requested.

### IQ-007 - What is the first useful finding layer between evidence cards and research bundles?

**Status**: `implemented`

**Question**: "What should we do next after importing 5,000-message Telegram slices and generating evidence cards?"

**Answer**: Add an aggregated findings layer instead of exporting single evidence cards directly. Evidence cards are still too noisy and too low-level to become research memory one by one.

The first useful bridge is:

- detect repeated patterns across evidence cards
- promote only repeated themes into findings
- attach a small number of representative source pointers
- export only sanitized findings plus suggested actions

This keeps the weekly brief useful without pretending the pipeline is already fully curated.

**Implementation impact**: Added `build-findings` and upgraded `export-weekly-brief` so the repo can now generate a real sanitized weekly brief from reviewed findings.
