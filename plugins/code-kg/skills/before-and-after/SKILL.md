---
name: before-and-after
description: Use when a PR needs visual before/after proof, screenshot comparison, or a markdown comparison table for UI changes. Prefer Code-KG work evidence pair attachment first; optionally call @vercel/before-and-after when installed.
---

# Before / after snapshots

## Code-KG first

Attach the pair to the active work item so proof survives the session:

```bash
code-kg work evidence pair <id> \
  --before .artifacts/before.png \
  --after .artifacts/after.png \
  --label "hero-mobile"
```

Assume the current checkout is **after**. Capture **before** while reproducing the bug or from production/preview before changing code.

## Optional visual CLI

If `@vercel/before-and-after` is installed (or via `npx`), you can generate an uploadable markdown table. Code-KG does not vendor that package (PolyForm Shield); use it as an optional external tool only.

```bash
# Prefer the scoped package name
npx @vercel/before-and-after "<before-url-or-file>" "<after-url-or-file>" --markdown
```

Useful flags:

- `--mobile` / `--tablet` / `--size WxH`
- `--full` only when the user asks for full-page capture
- CSS selectors when comparing a component, not the whole page

## Rules

- Do not invent the before URL — ask if missing.
- Do not switch branches or stash to invent a before state unless the user asks.
- For protected preview URLs (401/403), ask for a bypass token or manual screenshots.
- Paste the resulting markdown into the PR body after running the unslop skill on surrounding prose.
- Keep original files linked on the work item even if upload hosts are used.

## PR snippet shape

```markdown
## Before / after

| Before | After |
| --- | --- |
| ![before](...) | ![after](...) |

Evidence also attached to `code-kg work evidence list <id>`.
```
