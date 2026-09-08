---
description: Use when working in a repo that has (or should have) a Code-KG knowledge graph (a `lat.md/` directory), when the user asks how to use code-kg, or when you need to orient in a codebase before broad source reads. Explains bootstrapping a repo and the daily query/validate workflow.
---

# Using Code-KG

Code-KG maintains `lat.md/`, a reviewable markdown knowledge graph of a
codebase, so you can read a persistent map instead of re-deriving structure by
grepping. The CLI is the global `code-kg` binary; the MCP server exposes the
daily query/validate tools.

## Prerequisite

If `code-kg` is not found, locate the user's Code-KG source checkout, install its
dependencies, run `pnpm build`, then `node dist/src/codekg/cli.js install-global`
there. Do not assume this private package is published to npm.

## Onboard a repo (no `lat.md/` yet)

Run these from the repo root, with the user's go-ahead:

```bash
code-kg bootstrap --accept      # extract structure, write lat.md/ + .code-kg/
code-kg semantic enable-local   # persist the local embedding provider
code-kg semantic reindex        # build the local semantic index
code-kg doctor                  # readiness report
```

## Daily workflow (repo already mapped)

- Prefer `code-kg ask "<question>"` or MCP `codekg_ask` for reviewed knowledge
  plus fresh source context. Use `--in <directory>` to constrain the scope.
- Before changes, inspect `code-kg impact <symbol-or-file>`; use `callers`,
  `callees`, `map`, and `skeleton` for targeted navigation. Inferred edges and
  source descriptions remain inferred; verify evidence before accepting them.
- Source refreshes do not update reviewed prose. Surface drift and review it;
  `review-source <stable-id> --write` is an explicit acknowledgement, not an
  automatic repair operation.

- **Before broad source search**, query the graph first — MCP `codekg_search`
  with `backend: "auto-semantic"`, or `code-kg search "<question>" --backend
  auto-semantic`.
- **Before opening raw source**, run `code-kg context <file-or-symbol>` (or MCP
  `codekg_section "<section-id>"`) to read the relevant sections, their
  relationships, and tests.
- **After changing code or knowledge docs**, run `code-kg check` and
  `code-kg drift` to compare source against the knowledge base. Use
  `code-kg changed` / `code-kg update` around edits, and `code-kg gaps` to find
  undocumented or untested files.

## MCP tools vs. CLI

- **MCP tools** (available in any mapped repo): `codekg_search`,
  `codekg_section`, `codekg_locate`, `codekg_expand`, `codekg_check`,
  `codekg_drift`, `codekg_confidence`, `codekg_suppress`, `codekg_refs`,
  `codekg_apply_backlinks`. Prefer these for queries and validation.
- **Source MCP tools**: `codekg_ask`, `codekg_trace_calls`, `codekg_repo_map`,
  `codekg_file_api`, `codekg_find_all`, `codekg_context`, `codekg_changed`,
  `codekg_gaps`, and `codekg_workspace_ask`.
- **CLI via Bash** for everything not exposed over MCP: `bootstrap`, `doctor`,
  `semantic`, `context`, `gaps`, `changed`, `update`.

## Edit-safe contract

Never hand-edit source backlinks or overwrite curated/edited knowledge sections.
Use `code-kg apply-backlinks --preview` then `--write`, and only for sections
marked edit-safe. When regenerated content conflicts with an edited section,
Code-KG writes a candidate under `.code-kg/cache/merge-proposals/` for manual
review — surface that to the user rather than forcing the change.
