# Security

## Reporting

Document security-sensitive findings in this repo only after removing secrets, cookies, private content, and account identifiers. If a finding involves a live external account, handle it through a private channel first.

## Secret Handling

- Never commit `.env`, tokens, private keys, certificates, cookies, browser profiles, session exports, or generated credentials.
- Store local examples in `.env.example` with fake values only.
- Use least-privilege credentials for development, CI, and production.
- Treat Supabase service role keys as local-only unless a separate deployment decision approves otherwise.

## Raw Archive Policy

Raw content from Telegram, Skool, Discord, paid communities, private chats, or manual exports is allowed only in ignored local storage:

```text
data/raw/
data/processed/
data/transcripts/
```

Rules:

- Do not commit raw private/paid content.
- Do not copy raw private/paid content into `downstream-research-repo`.
- Summarize private material into evidence cards and findings.
- Use source pointers and local raw archive pointers instead of full text in exports.
- Hash author names or handles by default.
- Review retained raw archives periodically and delete material that no longer has research value.

## Transcript Handling

- Record transcript method: `official_api`, `public_metadata`, `yt_dlp_subtitles`, `manual`, or `unavailable`.
- Treat auto-generated transcripts as lower reliability.
- Do not commit private transcript files.
- Do not assume Vimeo transcripts are available unless owner/API access permits it.

## Data Classification

| Data Type | Present? | Handling Notes |
| --- | --- | --- |
| Public | yes | Reddit posts, public video metadata, public docs; still treat as untrusted input. |
| Internal | yes | Findings, notes, suggested experiments, local exports. |
| Personal data | possible | Author names must be hashed; private message content stays local-only. |
| Payment/regulated data | no | Do not ingest payment details, billing data, or customer financial records. |

## Security Baseline

- Validate all external input at system boundaries.
- Treat logs, API responses, files, and browser content as untrusted data.
- Avoid logging secrets or personal data.
- Keep dependencies patched and remove unused packages.
- Require human review before auth, permission, encryption, CORS, data-retention, or deployment changes.
