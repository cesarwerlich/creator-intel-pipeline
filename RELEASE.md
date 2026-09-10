# Release

## Versioning

Document the versioning scheme once the project has releases.

## Release Checklist

- `./scripts/check.sh` passes.
- Security-sensitive changes reviewed.
- Docs updated for user-visible or operator-visible changes.
- Rollback path known.
- Monitoring or smoke test identified.

## Rollback Checklist

- Identify the last known good version.
- Revert or redeploy using the documented deployment system.
- Verify health checks and critical user paths.
- Record the incident or release note.
