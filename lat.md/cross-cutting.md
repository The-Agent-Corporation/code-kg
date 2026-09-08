# Cross-Cutting Concerns
<!-- code-kg:id cross-cutting.overview -->

Cross-cutting concerns are seeded from deterministic import relationships and should be curated as agents verify behavior.

## Candidate Concerns

Use this section for auth, persistence, configuration, background work, observability, and other flows that cross module boundaries.

- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src/codekg/agents.ts (file)
- src/codekg/bootstrap.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/lattice.ts (file)
- src/cli/init.ts (file)
- src/context.ts (file)
- tests/cases.test.ts (file)
- src/codekg/types.ts (file)

## Cross-Community Imports

These imports cross the first-pass directory communities and may indicate integration paths worth documenting.

- scripts/cook-test-rag.ts imports src/config.ts
- tests/cases.test.ts imports src/cli/check.ts
- tests/cases.test.ts imports src/cli/refs.ts
- tests/cases.test.ts imports src/cli/section.ts
- tests/cases.test.ts imports src/code-refs.ts
- tests/cases.test.ts imports src/context.ts
- tests/cases.test.ts imports src/format.ts
- tests/cases.test.ts imports src/lattice.ts
- tests/codekg-intelligence.test.ts imports src/codekg/agent-context.ts
- tests/codekg-intelligence.test.ts imports src/codekg/agents.ts
