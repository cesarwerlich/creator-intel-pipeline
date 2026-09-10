# Evals

This file is for evaluation criteria, benchmark notes, and repeatable quality checks.

## What Counts As An Eval

- prompt / output quality checks
- content quality ratings
- UI flow scoring
- benchmark comparisons
- acceptance checks for agent behavior
- any repeatable rubric used to compare options over time

## Recommended Eval Record

```md
## Eval Name

## Date

## Hypothesis

## Inputs / Dataset

## Scoring Rubric

## Results

## Decision

## Next Iteration
```

## Suggested Metrics

- correctness
- completeness
- consistency
- latency
- cost
- safety
- user value
- platform fit

## Rules

- Keep evals versioned when the underlying system changes.
- Prefer a small stable eval set over a large noisy one.
- Record what changed between runs.
- If an eval is used to justify a product decision, keep the evidence in the repo.

## Notes

For repos that never run benchmarks or agent evaluations, this file can stay empty or be removed.
