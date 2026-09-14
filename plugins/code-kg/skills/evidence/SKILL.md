---
name: evidence
description: Use whenever a change needs verifiable proof that it works instead of prose claims. Covers UI recordings/screenshots, before/after pairs, measured API numbers, and attaching evidence to Code-KG work items and PRs.
---

# Evidence-driven testing

Claims are cheap. Attach proof to the work item before closing it.

## Default loop

1. Write the behaviors to verify as testable statements.
2. Capture the **before** state while reproducing the issue (cheapest moment).
3. Implement the fix in an isolated worktree (`code-kg work start <id> --worktree`).
4. Capture the **after** state the same way.
5. Attach the pair to the work item and summarize caveats.

```bash
code-kg work evidence pair <id> \
  --before .artifacts/login-before.png \
  --after .artifacts/login-after.png \
  --label "login-error-banner" \
  --notes "Shows the missing banner before and the restored banner after"
code-kg work evidence list <id>
```

## What counts as evidence

| Change type | Acceptable proof |
| --- | --- |
| UI / UX | Screenshot or recording of the live flow; before/after pair |
| API / perf | Probe script output with measured numbers before/after |
| Bug fix | Failure reproduction capture + fixed capture |
| Agent behavior | Transcript excerpt of the tool call/response |
| Non-UI logic | Test output + concrete input/output pairs |

## Guardrails

- Evidence complements `typecheck` / tests / `code-kg check`; it does not replace them.
- Never record secrets, tokens, or customer data.
- State the exact commit/branch tested (`git rev-parse HEAD`).
- If a check cannot run, mark it untested with a reason — do not skip silently.
- Confirm the process serving a port is yours before trusting it.

## Headless / no GUI

- Save captures under `.artifacts/<task>/` (gitignored).
- Prefer scripted screenshots or Playwright one-offs without adding permanent deps.
- Keep an `assertions.md` listing each check and `passed` / `failed` / `untested`.

## Optional visual table

If `@vercel/before-and-after` is available, you may generate a PR markdown table from the attached files. Do not vendor that CLI into Code-KG; call it only when installed:

```bash
npx @vercel/before-and-after before.png after.png --markdown
```

## Close protocol

Do not `code-kg work close <id>` until:

1. Repo checks pass
2. Evidence is attached (`work evidence list <id>` shows before/after or equivalent)
3. `code-kg check` and `code-kg drift` are clean or explicitly acknowledged
