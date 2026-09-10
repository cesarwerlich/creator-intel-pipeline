# Contributing

## Local Setup

```bash
./scripts/bootstrap.sh
```

## Before Opening A PR

```bash
./scripts/check.sh
```

## Pull Request Expectations

- Explain the problem and the change.
- Include tests or explain why tests do not apply.
- Call out risk, migration steps, and rollback notes.
- Update docs when behavior, setup, or operations change.

## Commit Style

Use short, imperative commits with an area prefix when useful:

```text
docs: clarify local setup
fix: handle empty input
test: cover retry failure
```
