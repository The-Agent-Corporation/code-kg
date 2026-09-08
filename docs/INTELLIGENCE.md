# Source Intelligence

Code-KG combines a fresh structural index with durable, reviewable `lat.md`
knowledge. This implementation adopts Graft's MIT-licensed tree-sitter extraction,
receiver bindings, and edge resolution, not its CLI, telemetry, cloud services,
or generated-summary storage. Attribution is in `THIRD_PARTY_NOTICES.md`.

## What Changed

| Capability | Implemented behavior |
| --- | --- |
| Structural extraction | Symbols, signatures, containment, local imports, calls, references, inheritance, and implementation edges where the language extractor can establish them |
| Incremental parsing | Content hashes reuse unchanged per-file extraction; edge resolution runs again across the current repository, including after deletion |
| Source freshness | File hashes detect body-only edits, even when symbol names and spans do not change |
| Retrieval | `ask` combines knowledge sections, optional existing semantic search, lexical source ranking, and dependency-based ranking |
| Navigation | Repository map, file APIs, callers, callees, transitive impact, literal and regex source search |
| Local source descriptions | Explicit OpenAI-compatible model invocation; hash-bound, inferred cache entries, never automatic promotion into prose |
| Agent context | Session orientation, prompt retrieval, post-edit impact, and silent stop refresh, in addition to existing pre-search nudges |
| Multiple repositories | Explicit registration and federated retrieval; each repository retains its own knowledge, index, and review decisions |

Code-KG's existing confidence acceptance/rejection, suppression tombstones,
edit-safe source anchors, backlink previews, merge proposals, and local embeddings
remain in place. Rejected/suppressed structural relationships do not participate
in the new ranking or traversal. Suppressing a file also hides its descendants
from the new source navigation commands. Suppression is a curation control, not
an access-control or secret-redaction mechanism.

## Install and Upgrade

From the Code-KG source checkout:

```bash
pnpm install
pnpm build
node dist/src/codekg/cli.js install-global
```

The native parser dependencies are explicitly allowlisted for builds in this
repository's `package.json`. Kotlin may require a local C/C++ toolchain and Python
when a prebuilt binary is unavailable. With pnpm, installing a packed package into
another project also requires approving these native dependency builds in that
consumer; dependency-level allowlists are not inherited. `pnpm test:package`
tests a clean consumer with the same explicit allowlist, including Kotlin and
WASM-backed Rust extraction. No grammar download occurs at query time.

In an already mapped target repository, refresh the managed integration:

```bash
code-kg agents install
code-kg ask "how does this application start?"
code-kg check
code-kg drift
```

Reload an existing MCP connection after rebuilding to expose the new tools.
Structural CLI queries also work before bootstrap, but lifecycle hooks stay silent
until a materialization manifest exists. Fresh queries write only disposable cache
artifacts under `.code-kg/cache/`; keep that directory out of version control.

## Query Workflow

```bash
code-kg ask "how do sessions expire?" --in src/auth --max-tokens 1800
code-kg ask "how do sessions expire?" --no-semantic --no-source
code-kg search "session expiration" --backend hybrid
code-kg map --in packages/api
code-kg skeleton src/auth/session.ts
code-kg callers validateSession
code-kg callees validateSession --depth 2
code-kg impact src/auth/session.ts --depth all
code-kg grep "validateSession" --in src
code-kg grep "session.*expire" --regex --ignore-case
```

`ask` retrieves evidence; it does not generate an answer with a chat model.
Semantic retrieval uses the existing configured embedding provider. With local
embeddings enabled, inference stays local after the initial model download.
`--no-semantic` guarantees that query retrieval makes no embedding request.
Source descriptions, when available and current, help lexical retrieval too.

Output budgets are approximate character-based budgets, not tokenizer guarantees.
Text output defaults to 3,000 estimated tokens and reports truncation. `--json`
on `ask` and call tracing returns structured results without text truncation.
Regex search uses ripgrep's bounded regex engine and requires `rg` on PATH;
literal search does not. Both operate only on discovered/indexed source files.

Call tracing also follows relevant import/reference/type relationships. A file
query starts with the file and its symbols. Ambiguous names yield multiple labeled
seeds; use an exact node ID or scope to disambiguate. Dynamic dispatch and external
dependencies can remain unresolved. Absence of an edge is not proof of no impact.

## Source Descriptions

Use an already running local OpenAI-compatible server, for example one bound to
loopback, and its actual loaded model identifier:

```bash
code-kg enrich --source --base-url http://127.0.0.1:1234/v1 \
  --model YOUR_LOADED_MODEL --limit 20
```

Alternatively set `CODEKG_LLM_BASE_URL` and `CODEKG_SUMMARY_MODEL`. An optional
`CODEKG_LLM_KEY` authenticates that endpoint. Stored `LAT_LLM_KEY` credentials are
not forwarded to arbitrary custom servers. Choosing a remote endpoint explicitly
sends the selected source excerpts there; local operation requires a local endpoint.

Descriptions carry `status: inferred`, model configuration, and a source hash in
`.code-kg/cache/meaning-v1.json`. They are not accepted architectural knowledge.
Requests receive at most the first 24,000 source characters, explicitly labeled
partial when truncated. The default limit is 20 attempted file requests per run;
successful calls are checkpointed for reuse. Changing the selected model regenerates
descriptions as the request budget allows. Existing current descriptions may remain
from the prior model until refreshed.

Hash mismatches exclude stale descriptions from retrieval immediately. A source
edit during generation discards the response. Snippets are read from current disk
content and checked against the retrieval snapshot, not copied from cached LLM
output. These rules address the stale-summary failure observed in the comparison.

The existing paragraph enrichment command remains separate. It now only rewrites
untouched generated manifest-owned files, skips curated/edited/authored prose, and
checks for concurrent file changes before writing.

## Review and Freshness

New bootstrap manifests record source content hashes for the architecture section.
`drift` reports subsequent body-only changes without changing those baselines.
Older manifests without hashes report that no content baseline is available.
Rematerialization updates only eligible generated files; edited/curated sections
retain their review baselines and receive merge proposals as before.

After actually reviewing a section against source:

```bash
code-kg review-source architecture
code-kg review-source architecture --write
```

The default is preview. `--write` records the covered current source hashes and
marks the section curated. It does not modify prose or promote relationship
confidence. Other section stable IDs require source coverage in their manifest
nodes, spans, or prior hashes. Missing coverage or extraction errors block review
acknowledgement. Normal retrieval, hooks, and cache refresh never perform it.

## Agent Integration

New MCP tools are `codekg_ask`, `codekg_trace_calls`, `codekg_repo_map`,
`codekg_file_api`, `codekg_find_all`, `codekg_context`, `codekg_changed`,
`codekg_gaps`, and `codekg_workspace_ask`. Existing review tools remain available.

`agents install` merges managed Codex hook entries and AGENTS guidance, preserving
foreign entries. The Claude plugin provides the equivalent events. Hook behavior:

| Event | Action |
| --- | --- |
| SessionStart | Bounded repository map; Claude also retains its unmapped-repo bootstrap offer |
| UserPromptSubmit | Up to three local lexical/graph context pointers; no model request |
| PostToolUse | Up to three edited file impact reports, depth two, for supported edit payloads |
| Stop | Refresh the structural cache silently |
| PreToolUse | Existing non-blocking Code-KG guidance before broad raw-source exploration |

Session IDs deduplicate repeated identical context by digest. Prompt text is not
stored in hook state. Hook failures are non-blocking and emit no partial claims;
explicit CLI/MCP queries still expose errors. Shell-based edits not represented by
an edit payload are picked up by stop-time or next-query refresh. Hook delivery
depends on the host implementing these events; file installation is not proof a
particular running agent host has fired them.

## Multiple Repositories

From the folder that will own the workspace configuration:

```bash
code-kg workspace add ../api ../web
code-kg workspace list
code-kg ask "where is authentication enforced?" --workspace
code-kg ask "session cookies" --workspace --in web/src
code-kg workspace remove web
```

Only explicitly registered roots are searched. `.code-kg/workspace.json` records
portable relative paths and repository names derived from folder names. Results
include the repository name and use rank fusion rather than comparing independently
normalized repository scores. A missing repository produces a warning if others
succeed. No cross-repository call edges are invented; tracing remains per-repository.
Workspace owners without their own `lat.md` can run MCP for workspace search.

## Coverage and Limits

Depth-tier extraction covers TypeScript/JavaScript (including JSX/TSX), Python, Go,
Java, Kotlin, Swift, PHP, and R. Generic WASM extraction covers Rust, C, C++, Ruby,
C#, Scala, Elixir, Solidity, OCaml, Zig, Dart, Clojure, Nix, and Lua. Generic tier
support is signature-focused and has less receiver/type resolution; some languages
produce symbols without calls. Source backlink parsing retains the original
Code-KG language support and is not extended merely by adding graph languages.

Graph refresh hashes current files and reuses AST results; it is not a filesystem
watcher and is not constant-time on a large repository. A per-root lock serializes
cache writes; a busy query fails clearly rather than serving a stale graph.
Existing `.gitignore` and Code-KG exclusions still govern discovery. Symlinked
source that resolves outside its registered repository is rejected.

Not adopted in this implementation: LSP servers/compiler-grade resolution,
Graft's hosted PR/app features, graph viewer, or graph-derived community clustering.
Code-KG's directory communities remain a clearly labeled fallback. This is a
local agent-intelligence upgrade, not a claim of complete Graft feature parity.
