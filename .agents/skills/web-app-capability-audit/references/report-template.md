# Web App Capability Audit Report Template

## Summary

- Application:
- URL:
- Audited account/role:
- Date:
- Goal:
- Verdict:

## Scope

In scope:

- TBD

Out of scope:

- Production secrets, credentials, customer records, destructive actions.

## Capability Matrix

| Capability | UI Evidence | API Evidence | Classification | Integration Notes |
| --- | --- | --- | --- | --- |
| TBD | Page/path/title | Endpoint/doc link | api_supported/ui_only/api_only/partial/blocked/unknown | TBD |

## UI Inventory

| Area | Pages/Actions Seen | Constraints | Evidence |
| --- | --- | --- | --- |
| TBD | TBD | TBD | TBD |

## API Inventory

| Surface | Auth | Operations | Limits | Evidence |
| --- | --- | --- | --- | --- |
| REST/GraphQL/Webhook/Export | TBD | TBD | TBD | TBD |

## Blockers And Risks

- Auth/scopes:
- Rate limits:
- Plan/tier:
- Terms/compliance:
- Missing API surface:
- Manual steps:

## Integration Recommendations

1. Best first integration:
2. Possible with caveats:
3. Avoid or defer:

## Agent JSON Shape

Use this shape for `capability-map.json`:

```json
{
  "application": "Example App",
  "audited_role": "admin",
  "goal": "Understand integration feasibility",
  "capabilities": [
    {
      "name": "Create project",
      "classification": "api_supported",
      "ui_evidence": ["Settings > Projects > New Project"],
      "api_evidence": ["POST /projects"],
      "constraints": ["Requires projects:write scope"],
      "integration_feasibility": "high",
      "notes": "Stable ID returned by API."
    }
  ],
  "blockers": [
    {
      "area": "Billing",
      "reason": "UI-only and requires owner role",
      "impact": "Cannot automate billing updates safely."
    }
  ],
  "recommended_integrations": [
    {
      "name": "Project sync",
      "feasibility": "high",
      "why": "CRUD API and webhook events are documented."
    }
  ]
}
```
