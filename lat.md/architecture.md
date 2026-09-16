# Architecture
<!-- code-kg:id architecture.overview -->

This section summarizes the repository shape discovered during the first Code-KG bootstrap.

## Project Signals

Detected project signals help orient agents before broad source reads.

- code-kg (Node/TypeScript)

## Entry Points

Entry points are candidate files to inspect first when source verification is needed.

- dist/src/codekg/cli.js
- index.js

## Entry Point Flow

No parsed entrypoint files were available for first-hop dependency flow during bootstrap.

- No entrypoint flow was detected.


## File Inventory

The initial inventory groups files by broad category so later extraction can focus on high-value paths.

- Code files: 111
- Test files: 20
- Documentation files: 87
- Config files: 3
- Asset files: 2
- Unsupported files: 20

## Structural Graph

Code-KG extracted a deterministic structural graph with 1336 nodes, 3237 edges, 7 communities using the multi-language-directory-fallback analysis path.

## Communities

Directory-based communities provide the first subsystem map until graph clustering is available.

- src: 74 files, 916 symbols, cohesion 0.89
- tests: 41 files, 203 symbols, cohesion 0.51
- plugins: 5 files, 42 symbols, cohesion 0.98
- templates: 2 files, 27 symbols, cohesion 1
- scripts: 5 files, 8 symbols, cohesion 0.91
- integration: 3 files, 2 symbols, cohesion 0.64
- root: 1 files, 0 symbols, cohesion 1

## High-Degree Nodes

High-degree nodes may deserve review as important entry points, bridges, or utility hotspots.

- src/codekg/work.ts (file)
- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src/codekg/agents.ts (file)
- src (module)
- src/codekg/bootstrap.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/context.ts (file)
- src/lattice.ts (file)
- src/cli/init.ts (file)

## Dependency Hotspots

Dependency hotspots list source files with incoming local imports so agents can find shared modules and integration points quickly.

### src/context.ts

Source file `src/context.ts` is imported by local files including `src/cli/check.ts`, `src/cli/context.ts`, and 41 more.

- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/index.ts`, `src/cli/locate.ts`, and 37 more

### src/codekg/types.ts

Source file `src/codekg/types.ts` is imported by local files including `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, and 20 more.

- Imported by: `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/confidence.ts`, `src/codekg/context.ts`, and 16 more

### src/lattice.ts

Source file `src/lattice.ts` is imported by local files including `src/cli/check.ts`, `src/cli/context.ts`, and 19 more.

- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, and 15 more

### src/codekg/cache.ts

Source file `src/codekg/cache.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/enrich.ts`, and 10 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/enrich.ts`, `src/codekg/fresh-cache.ts`, `src/codekg/graph.ts`, `src/codekg/meaning.ts`, `src/codekg/query.ts`, and 6 more

### src/codekg/structural.ts

Source file `src/codekg/structural.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/discovery.ts`, and 10 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/discovery.ts`, `src/codekg/enrich.ts`, `src/codekg/fresh-cache.ts`, `src/codekg/fresh.ts`, `src/codekg/graph.ts`, and 6 more

### src/codekg/fresh.ts

Source file `src/codekg/fresh.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/changed.ts`, and 8 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/changed.ts`, `src/codekg/context.ts`, `src/codekg/meaning.ts`, `src/codekg/query.ts`, `src/codekg/review-source.ts`, and 4 more

### src/codekg/graph.ts

Source file `src/codekg/graph.ts` is imported by local files including `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, and 8 more.

- Imported by: `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, `src/codekg/gaps.ts`, `tests/bootstrap-cache.test.ts`, and 4 more

### src/config.ts

Source file `src/config.ts` is imported by local files including `scripts/cook-test-rag.ts`, `src/cli/hook.ts`, and 8 more.

- Imported by: `scripts/cook-test-rag.ts`, `src/cli/hook.ts`, `src/cli/init.ts`, `src/codekg/enrich.ts`, `src/codekg/query.ts`, `src/codekg/search.ts`, and 4 more

### src/search/provider.ts

Source file `src/search/provider.ts` is imported by local files including `src/cli/init.ts`, `src/cli/search.ts`, and 6 more.

- Imported by: `src/cli/init.ts`, `src/cli/search.ts`, `src/codekg/semantic.ts`, `src/search/embeddings.ts`, `src/search/index.ts`, `src/search/search.ts`, and 2 more

### src/code-refs.ts

Source file `src/code-refs.ts` is imported by local files including `src/cli/check.ts`, `src/cli/refs.ts`, and 4 more.

- Imported by: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/codekg/bootstrap.ts`, `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`

### src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` is imported by local files including `src/codekg/cli.ts`, `src/codekg/update.ts`, and 4 more.

- Imported by: `src/codekg/cli.ts`, `src/codekg/update.ts`, `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/codekg/check.ts

Source file `src/codekg/check.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/cli.ts`, and 4 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/cli.ts`, `src/codekg/doctor.ts`, `src/codekg/mcp.ts`, `src/codekg/update.ts`, `tests/codekg.test.ts`

### src/codekg/work.ts

Source file `src/codekg/work.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/cli.ts`, and 4 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/cli.ts`, `src/codekg/mcp.ts`, `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-work-shared.test.ts`, `tests/codekg-work.test.ts`

### src/format.ts

Source file `src/format.ts` is imported by local files including `src/cli/locate.ts`, `src/cli/refs.ts`, and 4 more.

- Imported by: `src/cli/locate.ts`, `src/cli/refs.ts`, `src/cli/search.ts`, `src/cli/section.ts`, `src/codekg/search.ts`, `tests/cases.test.ts`

### src/source-parser.ts

Source file `src/source-parser.ts` is imported by local files including `src/cli/check.ts`, `src/cli/hook.ts`, and 4 more.

- Imported by: `src/cli/check.ts`, `src/cli/hook.ts`, `src/cli/section.ts`, `src/codekg/agent-context.ts`, `src/codekg/graph.ts`, `src/codekg/structural.ts`

## Source File Highlights

These generated highlights come from deterministic file, symbol, and import extraction so agents can search source-shaped concepts before opening raw files.

### src/codekg/work.ts

Source file `src/codekg/work.ts` contains source symbols. Key symbols: `WorkStatus`, `WorkType`, and 117 more.

- Symbols: `WorkStatus (type)`, `WorkType (type)`, `WorkDepKind (type)`, `WorkDep (type)`, `WorkEvidenceKind (type)`, `WorkEvidence (type)`, `WorkVerdict (type)`, `WorkCheckResult (type)`, and 111 more
- Imports: `src/codekg/query.ts`, `src/codekg/worktree.ts`, `src/context.ts`
- Imported by: `src/codekg/agent-context.ts`, `src/codekg/cli.ts`, `src/codekg/mcp.ts`, `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-work-shared.test.ts`, `tests/codekg-work.test.ts`

### src/codekg/cli.ts

Source file `src/codekg/cli.ts` contains source symbols. Key symbols: `PreviewAcceptOptions`, `ExtractOptions`, and 28 more.

- Symbols: `PreviewAcceptOptions (type)`, `ExtractOptions (type)`, `DriftOptions (type)`, `ReconcileOptions (type)`, `ConfidenceReconcileOptions (type)`, `ApplyBacklinksOptions (type)`, `SearchCliOptions (type)`, `InstallGlobalOptions (type)`, and 22 more
- Imports: `src/cli/context.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/graph.ts`, `src/codekg/search.ts`, `src/codekg/work.ts`, and 1 more
- Imported by: none detected

### src/codekg/agents.ts

Source file `src/codekg/agents.ts` contains source symbols. Key symbols: `SECTION_START`, `SECTION_END`, and 58 more.

- Symbols: `SECTION_START (const)`, `SECTION_END (const)`, `CODEX_HOOK_COMMAND (const)`, `CODEX_HOOK_MATCHER (const)`, `GENERIC_SEARCH_COMMAND (const)`, `HookCommandSelection (type)`, `AgentsOptions (type)`, `HookCheckOptions (type)`, and 52 more
- Imports: `src/codekg/agent-role.ts`, `src/codekg/discovery.ts`, `src/codekg/git-hooks.ts`, `src/codekg/semantic.ts`, `src/context.ts`
- Imported by: `tests/agent-roles.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` contains source symbols. Key symbols: `MergeProposal`, `SECTION_HEADINGS`, and 51 more.

- Symbols: `MergeProposal (type)`, `SECTION_HEADINGS (const)`, `DEFAULT_GITIGNORE_LINES (const)`, `SOURCE_FILE_HIGHLIGHT_LIMIT (const)`, `TEST_FILE_HIGHLIGHT_LIMIT (const)`, `SOURCE_SYMBOL_LIMIT (const)`, `SOURCE_IMPORT_LIMIT (const)`, `hash (function)`, and 45 more
- Imports: `src/code-refs.ts`, `src/codekg/discovery.ts`, `src/codekg/graph.ts`, `src/codekg/limits.ts`, `src/codekg/types.ts`
- Imported by: `src/codekg/cli.ts`, `src/codekg/update.ts`, `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/context.ts

Source file `src/context.ts` contains source symbols. Key symbols: `Styler`, `identity`, and 3 more.

- Symbols: `Styler (type)`, `identity (const)`, `plainStyler (const)`, `CmdContext (type)`, `CmdResult (type)`
- Imports: none detected
- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/index.ts`, `src/cli/locate.ts`, and 37 more

### src/lattice.ts

Source file `src/lattice.ts` contains source symbols. Key symbols: `Section`, `Ref`, and 22 more.

- Symbols: `Section (type)`, `Ref (type)`, `LatFrontmatter (type)`, `parseFrontmatter (function)`, `findLatticeDir (function)`, `findProjectRoot (function)`, `listLatticeFiles (function)`, `headingText (function)`, and 16 more
- Imports: `src/extensions/wiki-link/types.ts`, `src/parser.ts`, `src/walk.ts`
- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, and 15 more

### src/cli/init.ts

Source file `src/cli/init.ts` contains source symbols. Key symbols: `confirm`, `prompt`, and 37 more.

- Symbols: `confirm (function)`, `prompt (function)`, `loaderExecArgs (function)`, `resolveLatBin (function)`, `LatCommandStyle (type)`, `latBinString (function)`, `styledMcpCommand (function)`, `latHookCommand (function)`, and 31 more
- Imports: `src/cli/checklist-menu.ts`, `src/cli/gen.ts`, `src/cli/select-menu.ts`, `src/cli/templates.ts`, `src/config.ts`, `src/init-version.ts`, and 2 more
- Imported by: none detected

### src/codekg/graph.ts

Source file `src/codekg/graph.ts` contains source symbols. Key symbols: `LOCAL_IMPORT_EXTENSIONS`, `GRAPH_CACHE_PATH`, and 24 more.

- Symbols: `LOCAL_IMPORT_EXTENSIONS (const)`, `GRAPH_CACHE_PATH (const)`, `ImportSpec (type)`, `stableId (function)`, `moduleLabel (function)`, `fileNode (function)`, `moduleNode (function)`, `symbolNode (function)`, and 18 more
- Imports: `src/codekg/cache.ts`, `src/codekg/discovery.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/source-parser.ts`
- Imported by: `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, `src/codekg/gaps.ts`, `tests/bootstrap-cache.test.ts`, and 4 more

### integration/graph-hash-witness.mjs

Source file `integration/graph-hash-witness.mjs` contains source symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: none detected
- Imported by: none detected

### integration/verify-installed-worker-mcp.mjs

Source file `integration/verify-installed-worker-mcp.mjs` contains source symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: none detected
- Imported by: none detected

### integration/verify-roscoe-git-guards.mjs

Source file `integration/verify-roscoe-git-guards.mjs` contains source symbols. Key symbols: `git`, `commit`.

- Symbols: `git (function)`, `commit (function)`
- Imports: none detected
- Imported by: none detected

### plugins/openclaw-code-kg/bridge.mjs

Source file `plugins/openclaw-code-kg/bridge.mjs` contains source symbols. Key symbols: `nativeTool`, `hostHookBudgets`, and 28 more.

- Symbols: `nativeTool (function)`, `hostHookBudgets (function)`, `object (function)`, `textResult (function)`, `validateConfig (function)`, `translateTool (function)`, `parseHookOutput (function)`, `runProcess (function)`, and 22 more
- Imports: `plugins/openclaw-code-kg/definitions.mjs`
- Imported by: `plugins/openclaw-code-kg/index.mjs`, `plugins/openclaw-code-kg/tests/bridge.test.mjs`

### plugins/openclaw-code-kg/definitions.mjs

Source file `plugins/openclaw-code-kg/definitions.mjs` contains source symbols. Key symbols: `toolMetadata`.

- Symbols: `toolMetadata (function)`
- Imports: none detected
- Imported by: `plugins/openclaw-code-kg/bridge.mjs`, `plugins/openclaw-code-kg/index.mjs`

### plugins/openclaw-code-kg/index.mjs

Source file `plugins/openclaw-code-kg/index.mjs` contains source symbols. Key symbols: `getBridge`.

- Symbols: `getBridge (function)`
- Imports: `plugins/openclaw-code-kg/bridge.mjs`, `plugins/openclaw-code-kg/definitions.mjs`
- Imported by: none detected

### plugins/openclaw-code-kg/runner.mjs

Source file `plugins/openclaw-code-kg/runner.mjs` contains source symbols. Key symbols: `dispatch`, `dispatch#load`, and 4 more.

- Symbols: `dispatch (function)`, `dispatch#load (function)`, `dispatch#start (method)`, `dispatch#close (method)`, `dispatch#send (method)`, `dispatch#call (function)`
- Imports: none detected
- Imported by: none detected
