---
name: web-app-capability-audit
description: Audits an authorized web application to map what the UI, docs, and APIs can and cannot do. Use when logging into a user-authorized SaaS/web app, reading its pages/docs/settings, comparing UI capabilities with public/private API docs, or producing an agent-consumable integration feasibility report.
---

# Web App Capability Audit

## Overview

Map a web application's real capabilities from three evidence streams: authenticated UI, in-app/help documentation, and available APIs. Produce a durable report that tells future agents what can be automated, what needs browser/UI interaction, what is blocked, and what requires human or vendor approval.

## Preconditions

- The user must confirm they are authorized to access the application and its data.
- Never bypass access controls, paywalls, CAPTCHAs, MFA, rate limits, robots policy, or terms of service.
- Do not collect secrets, personal data, tokens, cookies, or customer records unless the user explicitly asks and it is necessary.
- Prefer test/sandbox accounts and fake data.

## Workflow

### 1. Define Scope

Capture:

- Application name and URL.
- User role/account type being audited.
- Business goal: what integration or automation the user wants to build.
- Areas in scope: dashboard, settings, docs, admin, billing, API, webhooks, exports, etc.
- Areas out of scope: production data, destructive actions, payments, private user content.

If scope is unclear, ask before browsing.

### 2. Authenticate Safely

Use the available browser/computer-use tooling when needed. Let the user enter credentials/MFA directly. Do not ask them to paste passwords, session cookies, or API keys into chat.

After login, record only non-sensitive facts:

- Account/role visible in UI.
- Plan/tier if relevant.
- Enabled modules/features.
- Important permission boundaries.

### 3. Inventory The UI

Walk the app systematically:

- Navigation, pages, subpages, modals, settings, admin sections.
- CRUD actions: create, read, update, delete, bulk actions, imports/exports.
- Search/filter/reporting features.
- Integrations, webhooks, API settings, audit logs.
- Permission, team, billing, and data-retention controls.

For each capability, capture evidence: page path/title, UI text summary, screenshots if useful, and any observed constraints.

### 4. Inventory Docs And APIs

Find official sources first:

- In-app help/docs.
- Public docs site.
- OpenAPI/GraphQL schema, SDK docs, API reference.
- Webhook/event docs.
- Export/import docs.
- Rate limits, auth scopes, pagination, idempotency, sandbox rules.

Do not rely on blogs/forums as primary evidence unless official docs are absent; label them as secondary.

### 5. Compare UI Vs API

Classify every relevant capability:

- `api_supported` - API can perform it directly.
- `ui_only` - visible in UI, no documented API found.
- `api_only` - API supports it, not visible in audited UI.
- `partial` - API exists but lacks fields/actions/filters needed.
- `blocked` - plan, permission, compliance, ToS, or technical barrier.
- `unknown` - not enough evidence yet.

Call out integration risk: auth scope missing, destructive endpoint, no webhook, no bulk export, no stable ID, no sandbox, strict rate limits, manual MFA, captcha, or unclear terms.

### 6. Produce Agent-Consumable Output

Create or update a report using [references/report-template.md](references/report-template.md). Prefer placing project-specific output under:

```text
docs/app-audits/<app-slug>-capability-audit.md
docs/app-audits/<app-slug>-capability-map.json
```

The Markdown report is for humans. The JSON map is for agents and should be concise, structured, and source-linked.

## Done Criteria

- UI, docs, and API evidence are separated.
- Every major capability has a feasibility classification.
- Unknowns and blockers are explicit.
- Sensitive data is excluded or redacted.
- Next integration recommendations are ranked by feasibility and risk.
