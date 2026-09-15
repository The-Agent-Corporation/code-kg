# Code-KG

Code-KG is the standalone implementation package for the architecture in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Code-KG began as a merge of the lat.md and Graphify projects. The current MVP
runtime vendors/adapts the lat.md TypeScript runtime internally while adding
Code-KG bootstrap, materialization, metadata validation, local lexical search,
and MCP entrypoints.

Code-KG now also incorporates Graft's MIT-licensed structural extraction and
resolution core, while keeping Code-KG's reviewed knowledge, confidence decisions,
edit protection, and local semantic search. The original repositories remain
independent. See [Source Intelligence](docs/INTELLIGENCE.md) for the implemented
behavior, installation requirements, and limits.

```bash
code-kg ask "where is authentication checked?"
code-kg impact src/auth.ts
code-kg callers authenticate
code-kg callees authenticate
code-kg skeleton src/auth.ts
code-kg map --in packages/api
code-kg grep "authenticate" --in src
```

These queries refresh disposable source indexes automatically. They do not
regenerate or approve `lat.md` prose. `ask` combines current source with knowledge
sections; `search` retains its existing knowledge-only default.

The current implementation also includes the first MVP 2 structural graph path:
tree-sitter source-symbol extraction, deterministic local import edges,
directory-based communities, high-degree node detection, bridge-node detection,
and preview quality warnings.

The first MVP 3 slices add report-only drift checks against the materialization
manifest, safe graph-cache artifact writes under `.code-kg/cache/`, manifest
reconciliation for edited generated markdown, and confidence review commands for
manifest relationships. Drift now validates accepted structural relationships,
suggests new cross-file structural relationships only when both endpoints
already have curated or edited section anchors, and respects suppression
tombstones. Repeated materialization updates untouched generated files but
preserves edited or curated sections. When generated content changes for an
edited section, Code-KG leaves the edited markdown in place and writes the new
candidate under `.code-kg/cache/merge-proposals/` for manual review.

Manifest sections distinguish broad coverage evidence from edit-safe source
anchors. `source_node_ids` can support drift and coverage for overview sections,
but source-editing features must use only `source_spans` on sections marked with
`source_anchor_policy: "edit-safe"`.

The agent guidance slice installs a managed section into both `AGENTS.md` and
`CLAUDE.md`, plus safe Codex lifecycle hooks and git
`pre-commit` / `post-merge` / `post-checkout` hooks. The guidance covers the
original Code-KG intent (search/ask/context before broad grep) and the coding
workflow (`work interview` → `seal` → `start --worktree` → evidence → verify →
close). PreToolUse hooks nudge before raw-source search or reads; Stop blocks
once when `code-kg check` fails or `lat.md/` is out of sync with code changes.
Git hooks keep the knowledge graph fresh on every commit and after merges or
branch checkouts that move the tip (including pulls onto main).

Session, prompt, and post-edit hooks provide bounded context or refresh the
structural cache. They make no model requests and never approve knowledge.
Run `code-kg agents install` again to upgrade managed guidance and hooks; foreign
hook entries are preserved. The Claude plugin includes the same lifecycle events.

The Code-KG MCP server exposes the daily agent workflow directly: search,
section reads with approximate token budgets, check, drift, confidence,
suppression, and backlink preview/write tools.

`code-kg doctor` now acts as a readiness report for agent use. It checks the
knowledge base, manifest, cache ignore rule, installed agent guidance, Codex
hook, MCP command, and manifest status summary.

## Current MVP Commands

```bash
pnpm install
pnpm build

node dist/src/codekg/cli.js bootstrap --preview
node dist/src/codekg/cli.js bootstrap --accept
node dist/src/codekg/cli.js doctor
node dist/src/codekg/cli.js extract .
node dist/src/codekg/cli.js extract . --json
node dist/src/codekg/cli.js extract . --write-cache
node dist/src/codekg/cli.js drift
node dist/src/codekg/cli.js reconcile --preview
node dist/src/codekg/cli.js reconcile --write
node dist/src/codekg/cli.js confidence list
node dist/src/codekg/cli.js confidence accept <relationship-id>
node dist/src/codekg/cli.js confidence reject <relationship-id>
node dist/src/codekg/cli.js confidence reconcile
node dist/src/codekg/cli.js confidence reconcile --accept-promotions
node dist/src/codekg/cli.js suppress list
node dist/src/codekg/cli.js suppress node <node-id>
node dist/src/codekg/cli.js suppress relationship <relationship-id>
node dist/src/codekg/cli.js suppress clear <id>
node dist/src/codekg/cli.js apply-backlinks --preview
node dist/src/codekg/cli.js apply-backlinks --write
node dist/src/codekg/cli.js search "entry points"
node dist/src/codekg/cli.js search "conceptual query" --semantic
node dist/src/codekg/cli.js search "conceptual query" --backend semantic --limit 10
node dist/src/codekg/cli.js search "conceptual query" --backend auto-semantic
node dist/src/codekg/cli.js context src/index.ts
node dist/src/codekg/cli.js gaps
node dist/src/codekg/cli.js changed
node dist/src/codekg/cli.js update
node dist/src/codekg/cli.js semantic status
node dist/src/codekg/cli.js semantic enable-local
node dist/src/codekg/cli.js semantic reindex
node dist/src/codekg/cli.js agents install
node dist/src/codekg/cli.js work init
node dist/src/codekg/cli.js work create "Example task" --query "entry points" --accept "ready list unlocks"
node dist/src/codekg/cli.js work ready
node dist/src/codekg/cli.js work interview <id>
node dist/src/codekg/cli.js work answer <id> --question q1 --answer "..."
node dist/src/codekg/cli.js work seal <id>
node dist/src/codekg/cli.js work start <id> --worktree
node dist/src/codekg/cli.js work isolate <id>
node dist/src/codekg/cli.js work evidence pair <id> --before before.png --after after.png
node dist/src/codekg/cli.js work verify <id> --verdict pass --summary "runtime check ok" --method runtime
node dist/src/codekg/cli.js work cleanup <id>
node dist/src/codekg/cli.js work prime
node dist/src/codekg/cli.js work close <id> --reason "done"
node dist/src/codekg/cli.js agents status
node dist/src/codekg/cli.js agents uninstall
node dist/src/codekg/cli.js hook-check
node dist/src/codekg/cli.js check
node dist/src/codekg/cli.js mcp
```

The package exposes `code-kg` as its binary after build or package install.

Skill packaging checks (Caliper-shaped, no LLM spend):

```bash
pnpm test:skill-evals
```

## Daily Workflow

For the normal local workflow, use the global binary:

```bash
code-kg bootstrap --accept
code-kg semantic enable-local
code-kg semantic reindex
code-kg agents install
code-kg agents status
code-kg doctor
code-kg drift
```

After that, use `code-kg ask "<question>"` before
broad source searches, `code-kg context <file-or-symbol>` before opening raw
source files, and `code-kg changed` / `code-kg update` around code changes.
For multi-step agent work, use `code-kg work` (Beads/GSD-style tracking primed
by the knowledge graph) instead of markdown TODOs: `work interview`/`seal`,
`work start <id> --worktree`, `work evidence pair`, `work verify`, `work close <id>`.
Load the `code-structure`, `evidence`, `before-and-after`, `unslop`,
`anti-slop-code`, and `ui-skills-route` skills for the rest of the delivery loop.
See [docs/USAGE.md](docs/USAGE.md) for the tested happy path and common checks.

## Use as a Claude Code Plugin

This repo is also a Claude Code plugin marketplace. The plugin wires the global
`code-kg` binary into Claude Code as an MCP server plus hooks, and ships a
guidance skill.

Prerequisites (once per machine): `code-kg install-global` so `code-kg` is on
`PATH`.

Install:

```bash
/plugin marketplace add The-Agent-Corporation/code-kg
/plugin install code-kg@code-kg
```

What it adds:

- MCP server (`code-kg mcp`) — search, section, check, drift, confidence,
  suppress, and backlink tools in any mapped repo.
- A PreToolUse hook that nudges toward `code-kg search` / `code-kg context`
  before broad grep/glob/read (silent in unmapped repos).
- A SessionStart hook that offers to bootstrap unmapped code repos.
- Bounded session orientation, prompt context, post-edit impact context, and
  a silent stop-time structural refresh in mapped repos.
- A guidance skill explaining the bootstrap and daily workflow.

Map a repo with `code-kg bootstrap --accept` (see Daily Workflow above).

## Semantic Search Providers

Semantic search is local-first. To use the built-in local embedding provider:

```bash
code-kg semantic enable-local
code-kg semantic reindex
code-kg search "conceptual query" --backend auto-semantic
```

The default local model is `Xenova/bge-small-en-v1.5` with 384-dimensional
vectors. The first run downloads the model into the Transformers cache; inference
and vector search then run locally. Override with `LAT_LOCAL_EMBEDDING_MODEL`
and `LAT_LOCAL_EMBEDDING_DIMENSIONS` if you choose a different local embedding
model.

`code-kg semantic enable-local` persists the local provider in the lat config
directory so semantic search, hooks, and MCP tools work without exporting
environment variables each session:

```json
{
  "embedding_provider": "local"
}
```

Remote embeddings are still supported through `LAT_LLM_KEY`:

- OpenAI keys (`sk-...`) use `text-embedding-3-small`
- Vercel AI Gateway keys (`vck_...`) use `openai/text-embedding-3-small`

Persisted local embedding selection takes precedence over chat credentials.
To override it, explicitly set `LAT_EMBEDDING_PROVIDER=openai` or `vercel` with
the corresponding embedding key. Anthropic, OpenRouter, and xAI chat keys are
never selected as embedding credentials, including through saved-key fallback.

This selection controls embeddings only. When chat credentials are configured,
`code-kg update` also attempts paragraph enrichment with the detected chat
provider. Keep chat credentials unset and out of the selected configuration
when maintenance must remain entirely local; source descriptions use the
separate explicit endpoint described in [Source Intelligence](docs/INTELLIGENCE.md).

Use `--backend auto-semantic` when you want the best configured backend without
breaking offline/local workflows. It selects semantic search when an embedding
provider is configured and falls back to local lexical search otherwise. Search
output includes a `Backend:` line so agents can see which path was used.

Run the opt-in local retrieval eval with:

```bash
LAT_TEST_LOCAL_EMBEDDINGS=1 pnpm vitest run tests/search.test.ts --testNamePattern "local embeddings eval"
```
