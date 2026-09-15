# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Git repository on branch `main`, with a GitHub remote at `origin` (https://github.com/The-Agent-Corporation/code-kg, public). Push to sync. The committed knowledge base (`lat.md/*.md`, `.code-kg/materialization-manifest.json`) is tracked and meant to be committed alongside code changes; the artifacts in `## Generated/ignored artifacts` below are excluded via `.gitignore`.

## Source of Truth

`docs/ARCHITECTURE.md` is the canonical merged architecture spec (~1100 lines) — the source of truth for product model, manifest schema, drift rules, and the MVP roadmap. Read the relevant section before changing behavior in those areas.

## Commands

This is a pnpm + TypeScript (ESM) project. There is no global install in dev — run the built CLI via `node dist/...`.

```bash
pnpm install
pnpm build              # tsc -> dist/  (required before running the CLI)
pnpm test               # vitest run (all tests)
pnpm test:watch
pnpm typecheck          # tsc --noEmit
pnpm format             # prettier --write 'src/**/*.ts'
pnpm format:check
pnpm test:package       # build + scripts/verify-package.mjs smoke test

# Run a single test file / single test
pnpm vitest run tests/codekg.test.ts
pnpm vitest run tests/search.test.ts --testNamePattern "local embeddings eval"
```

The CLI entrypoint after build is `node dist/src/codekg/cli.js <command>` (this is the `code-kg` binary defined in `package.json` `bin`). See `README.md` for the full command list and `docs/USAGE.md` for the tested happy path.

Opt-in tests gated behind env flags (skipped by default):
- `LAT_TEST_LOCAL_EMBEDDINGS=1` — runs the real local-embedding retrieval eval (downloads a model).

## Architecture

Code-KG produces and maintains `lat.md/`, a **reviewable markdown knowledge graph** of a codebase, so AI agents can read a persistent map instead of re-deriving structure every session. The curated markdown in `lat.md/` is the source of truth; generated graphs, manifests, and the search DB are supporting artifacts.

### Two layers in `src/`

1. **Vendored/adapted lat.md runtime** (`src/` root + `src/cli/`, `src/search/`, `src/extensions/`): the markdown lattice engine — parsing wiki-links, sections, lattice graph, lexical + semantic search, and the original lat.md CLI (`src/cli/index.ts`). This is upstream-derived plumbing that Code-KG builds on; prefer changing the Code-KG layer over editing this unless fixing the runtime itself.
2. **Code-KG layer** (`src/codekg/`): everything new — bootstrap, structural extraction, manifest, drift, reconcile, confidence, suppression, backlinks, agent-guidance install, and the `code-kg` CLI (`src/codekg/cli.ts`) + MCP server (`src/codekg/mcp.ts`).

### Command pattern

Commands are pure functions taking a `CmdContext` (`{ latDir, projectRoot, styler, mode: 'cli' | 'mcp' }`) and returning a `CmdResult` (`{ output, isError? }`) — see `src/context.ts`. The same command functions back both the CLI and the MCP server; `mode` and `styler` (plain vs. colored) are the only environment differences. When adding a command, write it as a context-in/result-out function and wire it into both `cli.ts` and `mcp.ts`.

### Key data model: the materialization manifest

`.code-kg/materialization-manifest.json` records, per generated section, what was generated and how it may be edited. Types live in `src/codekg/types.ts`. The critical distinction:

- `source_anchor_policy: "coverage-only"` — section has `source_node_ids` used only for drift/coverage evidence. **Not** safe to auto-edit.
- `source_anchor_policy: "edit-safe"` — section has `source_spans`; only these sections may receive automated source edits (e.g. `apply-backlinks --write`).

Repeated materialization preserves human-edited and curated sections: when generated content changes for an edited section, the new candidate is written to `.code-kg/cache/merge-proposals/` for manual review rather than overwriting. Respect this merge-safe contract — never blindly overwrite edited sections.

### Generated/ignored artifacts

`.gitignore` excludes `.code-kg/cache/`, `.code-kg/search.sqlite`, `.code-kg/tmp/`, and `lat.md/.cache/`. The committed knowledge base is `lat.md/*.md` and `.code-kg/materialization-manifest.json`. Tree-sitter WASM grammars come from `@repomix/tree-sitter-wasms` / `web-tree-sitter` (structural extraction in `src/codekg/graph.ts`).

### Search

Local-first. Lexical search always works offline; semantic search uses a local embedding provider (`Xenova/bge-small-en-v1.5`, 384-dim) via `@huggingface/transformers`, persisted in libsql/`search.sqlite`. `--backend auto-semantic` picks semantic when a provider is configured and falls back to lexical otherwise. Remote embeddings work via `LAT_LLM_KEY` (OpenAI `sk-...` or Vercel `vck_...`).

## Working in this repo with Code-KG itself

This repo dogfoods Code-KG — `lat.md/` and `.code-kg/` describe this very codebase, and `AGENTS.md` carries managed agent guidance. Per that guidance: prefer `code-kg search "<question>"` / `code-kg context <file>` to orient before broad grep/glob source sweeps, and run `code-kg check` + `code-kg drift` after changing code or knowledge docs. (Requires `pnpm build` first, then `node dist/src/codekg/cli.js <cmd>`.)

<!-- code-kg:agents:start -->
## code-kg

This project uses Code-KG: a reviewable knowledge graph in `lat.md/` plus metadata in `.code-kg/`.
Installed hooks nudge (and on Stop, may block) until you use Code-KG instead of broad grep-first workflows.
Git hooks keep `lat.md/` synced on commit and after merges/checkouts that update the current branch.

### Knowledge graph (orient before searching source)

- Before broad source reads, grep/glob searches, or answering codebase-structure questions, use `code-kg search "<question>"` or MCP `codekg_search` first.
- Prefer `code-kg ask "<question>"` or MCP `codekg_ask` for combined knowledge and fresh source context. Use `--in <directory>` to scope a monorepo query.
- Before changing a symbol or file, inspect `code-kg impact <symbol-or-file>`; use `callers`, `callees`, `skeleton`, and `map` for targeted exploration.
- Source descriptions are inferred, not accepted knowledge. Verify source evidence and stale-section warnings; refreshing the index never approves or rewrites curated knowledge.
- For conceptual queries, prefer `code-kg search "<question>" --backend auto-semantic` or `codekg_search` with `backend: "auto-semantic"` so semantic search is used when configured and lexical search is used as a fallback.
- Use `code-kg section "<section-id>"` or MCP `codekg_section` to read full sections with outgoing and incoming relationships before opening raw source.
- Treat `lat.md/` as the primary map and raw source as the implementation detail to inspect after the relevant knowledge sections are known.
- After modifying code or knowledge docs, run `code-kg check` and use `code-kg drift` to compare source and the knowledge base.
- Do not manually add source backlinks; use `code-kg apply-backlinks --preview` and then `code-kg apply-backlinks --write` only for sections marked edit-safe.

### Coding workflow (multi-step work tracker)

- For multi-step work, use `code-kg work` instead of markdown TODOs: `work ready`, `work interview`/`answer`/`seal`, `work start <id> --worktree`, `work verify`, `work close <id>`.
- Before executing a work item, run `code-kg work start <id> --worktree` (or `work isolate` + `work prime`) so search uses the knowledge graph and edits stay in an isolated worktree.
- Prefer action/orchestration code for why/when and shared services for reusable how; load the `code-structure` skill when extracting shared mechanics.
- Capture before/after proof with `code-kg work evidence pair <id> --before <path> --after <path>` before closing; load the `evidence` and `before-and-after` skills for capture workflows.
- Before `work close`, record a Reticle-style verification: `code-kg work verify <id> --verdict pass --summary "..." --method runtime` (fail blocks close; inconclusive needs `--allow-inconclusive`).
- Clarify ambiguous work with `work interview` / `work answer` / `work accept` / `work seal` so acceptance criteria stay separate from the build brief.
- When you discover new work mid-task, create it with `code-kg work create "..." --discovered-from <id>` and keep dependencies explicit.
- Run `unslop` over commit/PR prose you write for humans before posting. For code anti-patterns, load `anti-slop-code`. For UI routing across design skills, load `ui-skills-route`.

### Mandatory loop

1. Orient with `code-kg search` / `ask` / `context` (not broad grep).
2. Track work with `code-kg work` (interview → seal → start --worktree).
3. Prove with evidence + `work verify --verdict pass`, then `work close`.
4. Keep the graph fresh: commits/merges run `code-kg update` via installed git hooks; after manual edits run `code-kg check` + `code-kg drift`.
<!-- code-kg:agents:end -->
