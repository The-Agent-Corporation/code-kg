---
name: code-structure
description: Use when multiple workflows duplicate operational logic, when deciding what belongs in orchestration vs shared services, or when refactoring repeated mechanics across domain flows. Also use when starting Code-KG work items that touch shared infrastructure.
---

# Code structure (actions vs services)

Keep product orchestration separate from reusable operational mechanics.

## Two layers

| Layer | Owns | Does not own |
| --- | --- | --- |
| **Actions / orchestration** | why/when, auth, policy, state transitions, user-facing errors | provider/SDK details, duplicated ops |
| **Services / shared mechanics** | how to do a reusable operation reliably, explicit I/O | domain policy, direct product state mutation |

Rule of thumb:

- "What this product flow means" → action
- "How to do this operation once, correctly" → service

## Capability blocks

Prefer composable service functions over god methods:

```ts
createSandbox(...)
prepareRepo(...)
installDependencies(...)
runBuild(...)
```

Each function should:

- take explicit inputs
- return structured results
- make failure visible
- avoid hidden global state / DB writes unless that is the service's job

## Migration checklist

1. Implement the flow in an action first.
2. Mark repeated non-domain chunks across callers.
3. Extract only the repeated operational chunks.
4. Swap one caller → verify → migrate the rest.
5. Keep auth/policy/error classification in actions.
6. Run typecheck/tests/`code-kg check` + `code-kg drift`.

## Anti-patterns

- God service that hides control flow
- Leaky service that mutates domain tables freely
- Inconsistent service APIs (different error shapes per function)
- Extracting logic used by only one caller

## Code-KG hook

When starting work:

```bash
code-kg work start <id> --worktree
code-kg ask "where is the shared X logic?"
code-kg impact <symbol-or-file>
```

After structural moves, update or create `lat.md` sections for the service boundary and run `code-kg check`.
