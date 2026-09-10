# Roadmap

## Now

- Copy the first sanitized weekly intel brief into `downstream-research-repo`.
- Review and refine the first 8 aggregated findings from the ExampleCommunity Telegram imports.
- Improve finding quality and source scoring before scaling to larger Telegram imports.
- Keep browser automation disabled by default.

## V1 Milestone: First Weekly Intel Brief

Produce a sanitized brief that includes:

- 10 useful findings.
- 5 source-backed workflow patterns.
- 3 suggested creator-persona experiments.
- 1 monetization insight.
- 1 tool/provider comparison insight.
- Evidence pointers without raw private content.

Target export path in the research repo:

```text
downstream-research-repo/research/bundles/YYYY-MM-DD-community-intel/
```

## Next

- Clean up or archive the legacy duplicate `ExampleCommunity General` source after explicit approval.
- Add manual Skool notes parser with source and privacy metadata.
- Add `yt-dlp` or transcript-specific tooling after scaffold validation.
- Add skipped-item reports and deeper source quality scoring.
- Add richer finding extraction and human review controls on top of evidence cards.

## Later

- Schedule public-source ingestion from a VPS.
- Add dashboard/review UI if CLI briefs become too slow.
- Add official Telegram Bot API or TDLib only after a separate access decision.
- Add browser automation only for approved, controlled capture tasks.

## Open Questions

- Which Telegram export format will be the primary input: JSON, HTML, or saved-message Markdown?
- Which Skool communities are worth weekly manual review?
- Which transcript method is acceptable for each video source?
- When should public-source ingestion move from Mac to VPS?

## Not Doing

- No logged-in Telegram, Skool, or Discord scraping in v1.
- No raw private/paid archive in git.
- No committed cookies, browser profiles, local database dumps, or transcripts from private sources.
- No broad crawler until weekly briefs prove which sources are useful.
