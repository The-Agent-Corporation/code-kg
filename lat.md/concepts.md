# Concepts

How Code-KG keeps a reviewable knowledge base in step with the code. These sections are written by hand; the generated files map individual source files.

## Merge-Safe Materialization

`bootstrap` and `update` rewrite only files whose manifest status is `generated`. Files a person edited or curated are kept, and the new generated candidate is saved as a merge proposal to review.

Each generated file in `lat.md/` has an entry in `.code-kg/materialization-manifest.json`, typed by [[src/codekg/types.ts#ManifestSection]]. [[src/codekg/bootstrap.ts#writeBootstrapPlan]] compares the file on disk with the entry's `generated_hash`:

- Unchanged since it was generated: overwritten with the new content.
- Changed by hand: the entry becomes `edited`, the file is left alone, and the new content goes to `.code-kg/cache/merge-proposals/<stable-id>.md`.
- Already `edited`, `curated` or `suppressed`: kept, with a merge proposal when the generated candidate changed.
- No longer produced: a `generated` entry becomes `orphaned`.

Hand-written files such as this one have no manifest entry and are never written; the generated root index lists them. When nothing else changed, the manifest keeps its `generated_at`, so a no-op update leaves it untouched. The implementation map is [[architecture#Architecture#Source File Highlights#src/codekg/bootstrap.ts]].

## Drift and Source Review

`code-kg drift` compares the committed manifest with a fresh structural graph. Changed source under a reviewed section, vanished source nodes and stale accepted relationships are warnings.

- Sections can record `source_hashes`, one content hash per covered file. When a file's current hash differs, [[src/codekg/drift.ts#driftCommand]] reports "Source content changed" and names the sections to review.
- A missing manifest is the only error. Uncovered files and a changed graph are informational, and new relationships between documented files are suggestions.
- `code-kg review-source <stable-id> --write` ([[src/codekg/review-source.ts#reviewSourceCommand]]) is the explicit acknowledgement after reading the source. It records the current hashes and marks the section `curated`, without changing prose or relationship confidence. If an `edit-safe` section's span files changed, it downgrades the section to `coverage-only`; see [[concepts#Concepts#Source Anchor Policies]].
- CI fails a pull request when drift prints any warning. `code-kg update --no-enrich` refreshes the generated knowledge.

## Source Anchor Policies

A section's `source_anchor_policy` says whether Code-KG may edit source files for it. `coverage-only`, the default, uses spans and node ids only as evidence; `edit-safe` lets `apply-backlinks --write` add backlink comments at its spans.

- [[src/codekg/anchors.ts#sourceAnchorPolicy]] reads the policy, and [[src/codekg/anchors.ts#backlinkAnchorsForSection]] returns spans only for `edit-safe` sections.
- [[src/codekg/backlinks.ts#applyBacklinksCommand]] previews by default. With `--write` it inserts one `@lat:` comment line per section and file, indented like the target line, keeping line endings, shebangs and encoding declarations in place.
- A span is trusted only while the file's hash matches the section's recorded hash; otherwise the file is skipped. After writing, sections whose hash matched get the new hash and their spans move down past the inserted lines.
- Paths outside the project root, including through symlinks, and dependency or build folders are refused.

## Relationship Confidence

Every graph edge carries a confidence. `EXTRACTED` edges come from static syntax such as imports. `INFERRED` edges, scored 0.7, come from weaker evidence and stay labelled in every view.

- A test that loads a module by path (a subprocess script, built `dist/` output, a path joined from the test file's location) gets an inferred `tests` edge when no import edge covers the pair; see [[src/codekg/graph.ts#extractProjectGraph]]. Comments and string data such as assertions and fixtures do not count. [[src/codekg/source-scan.ts#scanSource]] tells code from comments and strings.
- `code-kg gaps` lists files covered only by inferred test edges apart from untested files, and `context`, `changed` and the tests map mark such tests "(inferred)".
- [[confidence#Confidence Review]] is the queue for uncertain generated relationships.

## Search Backends

`code-kg search` is lexical by default and works offline. `--backend semantic` uses embeddings, `auto-semantic` uses them when a provider is configured and falls back to lexical otherwise, and `hybrid` runs `ask`.

- Lexical ranking scores each section's id, heading and leading paragraph; see [[src/codekg/search.ts#rankSectionsLexically]].
- Semantic search embeds sections with a local model (`Xenova/bge-small-en-v1.5`, enabled by `code-kg semantic enable-local`) or a remote provider keyed by `LAT_LLM_KEY` (OpenAI `sk-…`, Vercel `vck_…`). The vector index is `lat.md/.cache/vectors.db`.
- With no provider, explicit semantic search returns an error naming the setup command. `auto-semantic` falls back instead, also when semantic search throws, and its `Backend:` line says why; see [[src/codekg/search.ts#codeKgSearchCommand]].
- `tests/retrieval-eval.test.ts` measures ranking changes with recall@5 and mean reciprocal rank over this repository's questions.

## Agent Guidance and Hooks

`code-kg agents install` adds a managed block to `AGENTS.md` and hooks that steer agents to the knowledge base. `code-kg git-hooks install` adds a pre-commit hook that refreshes it.

- The `AGENTS.md` block sits between `code-kg:agents:start` and `code-kg:agents:end` markers. [[src/codekg/agents.ts#agentsCommand]] refuses a file with anything other than one ordered pair.
- Codex hooks run `hook-check` before tool calls, which nudges searches and file reads toward `code-kg search` and `code-kg context` ([[src/codekg/agents.ts#hookCheckCommand]]). `agent-context session|prompt|edit|stop` supplies bounded local context ([[src/codekg/agent-context.ts#agentContextCommand]]). The Claude Code plugin registers the same events.
- Hook commands read their JSON payload from stdin without waiting for the pipe to close. [[src/codekg/stdin.ts#readHookInput]] waits up to 5s for the first byte and 1.5s between chunks, and the CLI prints one stderr line when the payload is missing or truncated.
- The pre-commit hook runs `code-kg update` with enrichment off and stages the refreshed `lat.md/` and manifest, unless they already had unstaged changes ([[src/codekg/git-hooks.ts#installGitHook]]).

## Structural Extraction

The structural graph comes from tree-sitter parses of source files. It has file, module and symbol nodes, typed edges such as `contains`, `imports` and `tests`, directory communities, and a content hash per file.

- [[src/codekg/graph.ts#extractProjectGraph]] extracts symbols from discovered code and test files, resolves local imports, adds inferred test edges, and records `source_hashes`.
- Commands that need a current graph call [[src/codekg/fresh.ts#freshGraph]], which re-extracts under a lock, reuses cached per-file extraction, and writes the graph cache in `.code-kg/cache/`.
- [[architecture#Architecture#Structural Graph]] summarizes the graph for this repository, and [[architecture#Architecture#Communities]] lists its communities.
