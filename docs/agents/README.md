# Shared Agent Playbooks

This folder is for tool-neutral personas, checklists, and playbooks that any supported agent can read.

## Suggested Contents

- review playbooks
- test or eval rubrics
- onboarding notes
- architecture prompts
- safety and escalation notes

## Rules

- Keep these files tool-neutral.
- Put Claude-specific subagents in `.agents/` only if the repo actually needs them.
- Keep any tool wrapper files thin and pointed back to `AGENTS.md`.

