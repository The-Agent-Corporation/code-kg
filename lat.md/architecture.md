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

- Code files: 98
- Test files: 10
- Documentation files: 78
- Config files: 2
- Asset files: 2
- Unsupported files: 12

## Structural Graph

Code-KG extracted a deterministic structural graph with 1034 nodes, 2405 edges, 4 communities using the multi-language-directory-fallback analysis path.

## Communities

Directory-based communities provide the first subsystem map until graph clustering is available.

- src: 70 files, 716 symbols, cohesion 0.9
- tests: 32 files, 175 symbols, cohesion 0.57
- templates: 2 files, 27 symbols, cohesion 1
- scripts: 4 files, 4 symbols, cohesion 0.86

## High-Degree Nodes

High-degree nodes may deserve review as important entry points, bridges, or utility hotspots.

- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src (module)
- src/codekg/agents.ts (file)
- src/codekg/bootstrap.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/lattice.ts (file)
- src/cli/init.ts (file)
- src/context.ts (file)
- tests/cases.test.ts (file)

## Dependency Hotspots

Dependency hotspots list source files with incoming local imports so agents can find shared modules and integration points quickly.

### src/context.ts

Source file `src/context.ts` is imported by local files including `src/cli/check.ts`, `src/cli/context.ts`, and 36 more.

- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/index.ts`, `src/cli/locate.ts`, and 32 more

### src/codekg/types.ts

Source file `src/codekg/types.ts` is imported by local files including `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, and 19 more.

- Imported by: `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/confidence.ts`, `src/codekg/context.ts`, and 15 more

### src/lattice.ts

Source file `src/lattice.ts` is imported by local files including `src/cli/check.ts`, `src/cli/context.ts`, and 19 more.

- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, and 15 more

### src/codekg/cache.ts

Source file `src/codekg/cache.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/enrich.ts`, and 8 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/enrich.ts`, `src/codekg/graph.ts`, `src/codekg/meaning.ts`, `src/codekg/query.ts`, `src/codekg/review-source.ts`, and 4 more

### src/config.ts

Source file `src/config.ts` is imported by local files including `scripts/cook-test-rag.ts`, `src/cli/hook.ts`, and 8 more.

- Imported by: `scripts/cook-test-rag.ts`, `src/cli/hook.ts`, `src/cli/init.ts`, `src/codekg/enrich.ts`, `src/codekg/query.ts`, `src/codekg/search.ts`, and 4 more

### src/codekg/structural.ts

Source file `src/codekg/structural.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/discovery.ts`, and 6 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/discovery.ts`, `src/codekg/enrich.ts`, `src/codekg/graph.ts`, `src/codekg/meaning.ts`, `src/codekg/query.ts`, and 2 more

### src/search/provider.ts

Source file `src/search/provider.ts` is imported by local files including `src/cli/init.ts`, `src/cli/search.ts`, and 6 more.

- Imported by: `src/cli/init.ts`, `src/cli/search.ts`, `src/codekg/semantic.ts`, `src/search/embeddings.ts`, `src/search/index.ts`, `src/search/search.ts`, and 2 more

### src/codekg/fresh.ts

Source file `src/codekg/fresh.ts` is imported by local files including `src/codekg/agent-context.ts`, `src/codekg/changed.ts`, and 5 more.

- Imported by: `src/codekg/agent-context.ts`, `src/codekg/changed.ts`, `src/codekg/context.ts`, `src/codekg/meaning.ts`, `src/codekg/query.ts`, `src/codekg/review-source.ts`, and 1 more

### src/codekg/graph.ts

Source file `src/codekg/graph.ts` is imported by local files including `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, and 5 more.

- Imported by: `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, `src/codekg/gaps.ts`, `tests/codekg-intelligence.test.ts`, and 1 more

### src/format.ts

Source file `src/format.ts` is imported by local files including `src/cli/locate.ts`, `src/cli/refs.ts`, and 4 more.

- Imported by: `src/cli/locate.ts`, `src/cli/refs.ts`, `src/cli/search.ts`, `src/cli/section.ts`, `src/codekg/search.ts`, `tests/cases.test.ts`

### src/cli/search.ts

Source file `src/cli/search.ts` is imported by local files including `src/cli/hook.ts`, `src/codekg/query.ts`, and 3 more.

- Imported by: `src/cli/hook.ts`, `src/codekg/query.ts`, `src/codekg/semantic.ts`, `src/codekg/update.ts`, `src/mcp/server.ts`

### src/code-refs.ts

Source file `src/code-refs.ts` is imported by local files including `src/cli/check.ts`, `src/cli/refs.ts`, and 3 more.

- Imported by: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/codekg/bootstrap.ts`, `tests/cases.test.ts`

### src/codekg/check.ts

Source file `src/codekg/check.ts` is imported by local files including `src/codekg/cli.ts`, `src/codekg/doctor.ts`, and 3 more.

- Imported by: `src/codekg/cli.ts`, `src/codekg/doctor.ts`, `src/codekg/mcp.ts`, `src/codekg/update.ts`, `tests/codekg.test.ts`

### src/source-parser.ts

Source file `src/source-parser.ts` is imported by local files including `src/cli/check.ts`, `src/cli/hook.ts`, and 3 more.

- Imported by: `src/cli/check.ts`, `src/cli/hook.ts`, `src/cli/section.ts`, `src/codekg/graph.ts`, `src/codekg/structural.ts`

### src/walk.ts

Source file `src/walk.ts` is imported by local files including `src/cli/check.ts`, `src/code-refs.ts`, and 3 more.

- Imported by: `src/cli/check.ts`, `src/code-refs.ts`, `src/codekg/check.ts`, `src/codekg/discovery.ts`, `src/lattice.ts`

## Source File Highlights

These generated highlights come from deterministic file, symbol, and import extraction so agents can search source-shaped concepts before opening raw files.

### src/codekg/cli.ts

Source file `src/codekg/cli.ts` contains source symbols. Key symbols: `PreviewAcceptOptions`, `ExtractOptions`, and 22 more.

- Symbols: `PreviewAcceptOptions (type)`, `ExtractOptions (type)`, `DriftOptions (type)`, `ReconcileOptions (type)`, `ConfidenceReconcileOptions (type)`, `ApplyBacklinksOptions (type)`, `SearchCliOptions (type)`, `InstallGlobalOptions (type)`, and 16 more
- Imports: `src/cli/context.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/graph.ts`, `src/codekg/search.ts`, `src/context.ts`
- Imported by: none detected

### src/codekg/agents.ts

Source file `src/codekg/agents.ts` contains source symbols. Key symbols: `SECTION_START`, `SECTION_END`, and 54 more.

- Symbols: `SECTION_START (const)`, `SECTION_END (const)`, `CODEX_HOOK_COMMAND (const)`, `CODEX_HOOK_MATCHER (const)`, `GENERIC_SEARCH_COMMAND (const)`, `HookCommandSelection (type)`, `AgentsOptions (type)`, `HookCheckOptions (type)`, and 48 more
- Imports: `src/codekg/discovery.ts`, `src/codekg/git-hooks.ts`, `src/codekg/semantic.ts`, `src/context.ts`
- Imported by: `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` contains source symbols. Key symbols: `MergeProposal`, `SECTION_HEADINGS`, and 51 more.

- Symbols: `MergeProposal (type)`, `SECTION_HEADINGS (const)`, `DEFAULT_GITIGNORE_LINES (const)`, `SOURCE_FILE_HIGHLIGHT_LIMIT (const)`, `TEST_FILE_HIGHLIGHT_LIMIT (const)`, `SOURCE_SYMBOL_LIMIT (const)`, `SOURCE_IMPORT_LIMIT (const)`, `hash (function)`, and 45 more
- Imports: `src/code-refs.ts`, `src/codekg/discovery.ts`, `src/codekg/graph.ts`, `src/codekg/limits.ts`, `src/codekg/types.ts`
- Imported by: `src/codekg/cli.ts`, `src/codekg/update.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

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

### src/context.ts

Source file `src/context.ts` contains source symbols. Key symbols: `Styler`, `identity`, and 3 more.

- Symbols: `Styler (type)`, `identity (const)`, `plainStyler (const)`, `CmdContext (type)`, `CmdResult (type)`
- Imports: none detected
- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/index.ts`, `src/cli/locate.ts`, and 32 more

### src/codekg/types.ts

Source file `src/codekg/types.ts` contains source symbols. Key symbols: `FileCategory`, `DiscoveredFile`, and 16 more.

- Symbols: `FileCategory (type)`, `DiscoveredFile (type)`, `DiscoveryResult (type)`, `SourceSpan (type)`, `Confidence (type)`, `EntityNode (type)`, `RelationshipEdge (type)`, `GraphFragment (type)`, and 10 more
- Imports: none detected
- Imported by: `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/confidence.ts`, `src/codekg/context.ts`, and 15 more

### scripts/cook-test-rag.ts

Source file `scripts/cook-test-rag.ts` contains source symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: `src/config.ts`
- Imported by: none detected

### scripts/copy-vendor-assets.mjs

Source file `scripts/copy-vendor-assets.mjs` contains source symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: none detected
- Imported by: none detected

### scripts/lat-llm-key-helper.py

Source file `scripts/lat-llm-key-helper.py` contains source symbols. Key symbols: `main`.

- Symbols: `main (function)`
- Imports: none detected
- Imported by: none detected

### scripts/verify-package.mjs

Source file `scripts/verify-package.mjs` contains source symbols. Key symbols: `run`, `assertIncludes`, and 1 more.

- Symbols: `run (function)`, `assertIncludes (function)`, `assertNotIncludes (function)`
- Imports: none detected
- Imported by: none detected

### src/cli/check.ts

Source file `src/cli/check.ts` contains source symbols. Key symbols: `CheckError`, `filePart`, and 25 more.

- Symbols: `CheckError (type)`, `filePart (function)`, `ambiguousMessage (function)`, `FileStats (type)`, `CheckResult (type)`, `countByExt (function)`, `isSourcePath (function)`, `tryResolveSourceRef (function)`, and 19 more
- Imports: `src/code-refs.ts`, `src/codekg/limits.ts`, `src/context.ts`, `src/init-version.ts`, `src/lattice.ts`, `src/source-parser.ts`, and 1 more
- Imported by: `src/cli/hook.ts`, `src/codekg/check.ts`, `src/mcp/server.ts`, `tests/cases.test.ts`

### src/cli/checklist-menu.ts

Source file `src/cli/checklist-menu.ts` contains source symbols. Key symbols: `ChecklistOption`, `checklistMenu`, and 4 more.

- Symbols: `ChecklistOption (interface)`, `checklistMenu (function)`, `checklistMenu#render (function)`, `checklistMenu#clearRender (function)`, `checklistMenu#cleanup (function)`, `checklistMenu#onData (function)`
- Imports: none detected
- Imported by: `src/cli/init.ts`

### src/cli/context.ts

Source file `src/cli/context.ts` contains source symbols. Key symbols: `makeStyler`, `resolveContext`.

- Symbols: `makeStyler (function)`, `resolveContext (function)`
- Imports: `src/context.ts`, `src/lattice.ts`
- Imported by: `src/cli/index.ts`, `src/codekg/cli.ts`

### src/cli/expand.ts

Source file `src/cli/expand.ts` contains source symbols. Key symbols: `WIKI_LINK_RE`, `formatLocation`, and 3 more.

- Symbols: `WIKI_LINK_RE (const)`, `formatLocation (function)`, `ResolvedRef (type)`, `expandPrompt (function)`, `expandCommand (function)`
- Imports: `src/context.ts`, `src/lattice.ts`
- Imported by: `src/cli/hook.ts`, `src/codekg/mcp.ts`, `src/mcp/server.ts`
