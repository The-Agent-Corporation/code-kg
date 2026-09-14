---
name: anti-slop-code
description: Use when reviewing or writing implementation code to remove agent code-slop — unused abstractions, ceremonial wrappers, assertion-free tests, hallucinated imports, and drive-by refactors. Complements unslop (prose) with load-bearing code checks.
---

# Anti-slop code

Substance defects in code, not authorship. Prefer mechanical checks over taste.

## Load-bearing deletion test

Before flagging ceremony, delete the candidate and name what broke:

1. Comment / docstring that only restates the next line
2. Wrapper that forwards args to a single call site
3. try/catch that swallows impossible errors
4. Test that never asserts behavior
5. Interface / type with one implementation and no planned second

If nothing broke, remove or simplify it. If something broke, leave it.

## Hard rules

- Do not add files, helpers, or folders the task does not need
- Do not invent Clean Architecture trees unless the repo already uses them
- Prefer editing an existing file over creating a new one
- Do not drive-by rename/move/refactor unrelated code
- Do not add dependencies for one-call problems already solved in-tree
- Match local naming and error-handling patterns before inventing new ones

## Review output

Report findings as:

- severity (impact) and confidence (certainty) separately
- artifact of the deletion/inversion test
- concrete fix, not “looks like AI”

Never claim a diff was machine-written.

## With Code-KG work

- After implementation, run these checks before `work verify`
- Keep acceptance criteria observable; do not accept “code looks clean” alone
---

Related: `unslop` for human-facing prose; `code-structure` for actions vs services.
