# Cross-Cutting Concerns
<!-- code-kg:id cross-cutting.overview -->

Cross-cutting concerns are seeded from deterministic import relationships and should be curated as agents verify behavior.

## Candidate Concerns

Use this section for auth, persistence, configuration, background work, observability, and other flows that cross module boundaries.

- src/codekg/work.ts (file)
- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src/codekg/agents.ts (file)
- src/codekg/bootstrap.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/context.ts (file)
- src/lattice.ts (file)
- src/cli/init.ts (file)
- src/codekg/graph.ts (file)

## Cross-Community Imports

These imports cross the first-pass directory communities and may indicate integration paths worth documenting.

- scripts/cook-test-rag.ts imports src/config.ts
- tests/agent-context-refresh-failure.test.ts imports src/codekg/cache.ts
- tests/agent-context-refresh-failure.test.ts imports src/codekg/fresh.ts
- tests/agent-context-refresh-failure.test.ts imports src/codekg/agent-context.ts
- tests/agent-context-refresh-failure.test.ts imports src/codekg/work.ts
- tests/agent-context-refresh-failure.test.ts imports src/context.ts
- tests/agent-roles.test.ts imports src/codekg/agent-context.ts
- tests/agent-roles.test.ts imports src/codekg/agent-role.ts
- tests/agent-roles.test.ts imports src/codekg/agents.ts
- tests/agent-roles.test.ts imports src/context.ts
