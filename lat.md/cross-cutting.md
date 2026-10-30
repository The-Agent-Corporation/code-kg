# Cross-Cutting Concerns
<!-- code-kg:id cross-cutting.overview -->

Cross-cutting concerns are seeded from deterministic import relationships and should be curated as agents verify behavior.

## Candidate Concerns

Use this section for auth, persistence, configuration, background work, observability, and other flows that cross module boundaries.

- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src/codekg/bootstrap.ts (file)
- src/codekg/agents.ts (file)
- src/context.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/codekg/graph.ts (file)
- src/lattice.ts (file)
- src/cli/init.ts (file)
- tests/cases.test.ts (file)

## Cross-Community Imports

These imports cross the first-pass directory communities and may indicate integration paths worth documenting.

- scripts/cook-test-rag.ts imports src/config.ts
- tests/agents-edge-cases.test.ts imports src/codekg/agents.ts
- tests/agents-edge-cases.test.ts imports src/context.ts
- tests/backlinks-safety.test.ts imports src/codekg/backlinks.ts
- tests/backlinks-safety.test.ts imports src/codekg/bootstrap.ts
- tests/backlinks-safety.test.ts imports src/codekg/drift.ts
- tests/backlinks-safety.test.ts imports src/codekg/review-source.ts
- tests/backlinks-safety.test.ts imports src/codekg/structural.ts
- tests/backlinks-safety.test.ts imports src/codekg/types.ts
- tests/backlinks-safety.test.ts imports src/context.ts
