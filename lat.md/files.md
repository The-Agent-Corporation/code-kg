# Source Files
<!-- code-kg:id files.overview -->

Each parsed source and test file has a generated card: what the file is for, its symbols and their doc comments, the commands that use it, and its tests and imports.

## scripts/cook-test-rag.ts

Cook replay data for the RAG test case.

- Imports: `src/config.ts`

## scripts/copy-vendor-assets.mjs

Source file `scripts/copy-vendor-assets.mjs` defines no extracted symbols.

## scripts/lat-llm-key-helper.py

Print a chat API key for Code-KG enrich (LAT_LLM_KEY_HELPER). Prefers a live xAI OAuth access token from ~/.pi/agent/auth.json so enrich can use Grok without storing a long-lived key in lat config.json.

- Defines: `main`

## scripts/verify-package.mjs

Source file `scripts/verify-package.mjs` defines `run`, `assertIncludes`, `assertNotIncludes`.

- Defines: `run`, `assertIncludes`, `assertNotIncludes`

## src/cli/check.ts

Source file `src/cli/check.ts` defines `CheckError`, `filePart`, `ambiguousMessage`, and 25 more.

- Used by `lat check`: Validate links and code references
- Used by `lat check md`: Validate wiki links in lat.md markdown files
- Used by `lat check code-refs`: Validate @lat code references and coverage
- Used by `lat check index`: Validate directory index files in lat.md
- Used by `lat check sections`: Validate section leading paragraphs in lat.md
- Used by `MCP lat_check`: Validate all wiki links, code references, and directory indexes in lat.md
- `ambiguousMessage` (function): Format an ambiguous-ref error as structured markdown-like text.
- `FileStats` (type): File counts grouped by extension (e.g.
- `tryResolveSourceRef` (function): Try resolving a wiki link target as a source code reference.
- `immediateEntries` (function): Extract the immediate (first-level) entries from walkEntries results.
- `parseIndexEntries` (function): Parse bullet items from an index file.
- `entryToStem` (function): Convert a filesystem entry name to its wiki link stem.
- `indexSnippet` (function): Generate a bullet-list snippet for the given entry names.
- `MAX_BODY_LENGTH` (const): Max characters for the first paragraph of a section (excluding wiki links).
- Also defines: `CheckError`, `filePart`, `CheckResult`, `countByExt`, `isSourcePath`, `checkMd`, `checkCodeRefs`, `IndexError`, `checkIndex`, `checkSections`, `formatFileStats`, `formatCheckErrors`, `formatCheckIndexErrors`, `formatErrorCount`, `CheckAllOptions`, `checkAllCommand`, `checkMdCommand`, `checkCodeRefsCommand`, `checkIndexCommand`, `checkSectionsCommand`
- Tested by: `tests/cases.test.ts`, `tests/enrich.test.ts`
- Imports: `src/code-refs.ts`, `src/codekg/limits.ts`, `src/context.ts`, `src/init-version.ts`, `src/lattice.ts`, `src/source-parser.ts`, and 1 more
- Imported by: `src/cli/hook.ts`, `src/codekg/check.ts`, `src/mcp/server.ts`, `tests/cases.test.ts`, `tests/enrich.test.ts`

## src/cli/checklist-menu.ts

Source file `src/cli/checklist-menu.ts` defines `ChecklistOption`, `checklistMenu`, `checklistMenu#render`, and 3 more.

- `checklistMenu` (function): Display an interactive multi-select checklist with arrow-key navigation.
- Also defines: `ChecklistOption`, `checklistMenu#render`, `checklistMenu#clearRender`, `checklistMenu#cleanup`, `checklistMenu#onData`
- Imported by: `src/cli/init.ts`

## src/cli/context.ts

Source file `src/cli/context.ts` defines `makeStyler`, `resolveContext`.

- Defines: `makeStyler`, `resolveContext`
- Imports: `src/context.ts`, `src/lattice.ts`
- Imported by: `src/cli/index.ts`, `src/codekg/cli.ts`

## src/cli/expand.ts

Source file `src/cli/expand.ts` defines `WIKI_LINK_RE`, `formatLocation`, `ResolvedRef`, and 2 more.

- Used by `MCP codekg_expand`: Expand refs in text to resolved lat.md section paths with bounded context
- Used by `MCP lat_expand`: Expand refs in text to resolved lat.md section paths with context
- `expandPrompt` (function): Resolve refs in text and return the expanded output.
- Also defines: `WIKI_LINK_RE`, `formatLocation`, `ResolvedRef`, `expandCommand`
- Imports: `src/context.ts`, `src/lattice.ts`
- Imported by: `src/cli/hook.ts`, `src/codekg/mcp.ts`, `src/mcp/server.ts`

## src/cli/gen.ts

Source file `src/cli/gen.ts` defines `readAgentsTemplate`, `readCursorRulesTemplate`, `readPiExtensionTemplate`, and 3 more.

- Used by `lat gen`: Generate a file to stdout (agents.md, claude.md, cursor-rules.md)
- Defines: `readAgentsTemplate`, `readCursorRulesTemplate`, `readPiExtensionTemplate`, `readOpenCodePluginTemplate`, `readSkillTemplate`, `genCmd`
- Imports: `src/cli/templates.ts`
- Imported by: `src/cli/init.ts`

## src/cli/hook.ts

Source file `src/cli/hook.ts` defines `outputClaudePromptSubmit`, `outputClaudeStop`, `outputCursorStop`, and 15 more.

- Used by `lat hook`: Handle agent hook events (called by agent hooks, not directly)
- `DIFF_THRESHOLD` (const): Minimum code change size (lines) before we consider flagging lat.md/ sync.
- `LATMD_RATIO` (const): lat.md/ changes below this ratio of code changes trigger a sync reminder.
- `LATMD_UPPER_THRESHOLD` (const): If lat.md/ changes exceed this many lines, skip the ratio check entirely.
- `analyzeDiff` (function): Run `git diff --numstat` and return { codeLines, latMdLines }.
- Also defines: `outputClaudePromptSubmit`, `outputClaudeStop`, `outputCursorStop`, `readStdin`, `hasWikiLinks`, `makeHookCtx`, `searchAndExpand`, `handleUserPromptSubmit`, `StopStatus`, `getStopStatus`, `formatStopReason`, `handleClaudeStop`, `handleCursorStop`, `hookCmd`
- Imports: `src/cli/check.ts`, `src/cli/expand.ts`, `src/cli/search.ts`, `src/cli/section.ts`, `src/config.ts`, `src/context.ts`, and 2 more

## src/cli/index.ts

Suppress deprecation warnings from transitive dependencies unless --verbose

- Registers 16 commands: `lat locate`, `lat section`, `lat refs`, `lat check`, `lat check md`, `lat check code-refs`, `lat check index`, `lat check sections`, `lat expand`, `lat prompt`, `lat search`, `lat gen`, `lat init`, `lat hook`, `lat mcp`, `lat config`
- Defines: `findPackageJson`, `handleResult`, `version`, `program`, `check`, `runExpand`
- Inferred tests (load it by path, not by import): `tests/cases.test.ts`, `tests/hook.test.ts`, `tests/mcp.test.ts`, `tests/parser.test.ts`
- Imports: `src/cli/context.ts`, `src/context.ts`

## src/cli/init.ts

Source file `src/cli/init.ts` defines `confirm`, `prompt`, `loaderExecArgs`, and 36 more.

- Used by `lat init`: Initialize a lat.md directory
- `loaderExecArgs` (function): Return the loader-related flags from `process.execArgv`, stripping `--eval`/`-e`/`--print`/`-p` and their value arguments (those only appear when the process…
- `resolveLatBin` (function): Reconstruct the command prefix used to invoke this process.
- `latBinString` (function): Return the lat binary string for the given command style.
- `styledMcpCommand` (function): Return the MCP server command descriptor for the given command style.
- `latHookCommand` (function): Derive the hook command prefix for the given command style.
- `isLatHookEntry` (function): True if any command in this entry looks like it was installed by lat.
- `syncLatHooks` (function): Remove all lat-owned hook entries from settings, then add fresh ones.
- `mcpCommand` (function): Derive the MCP server command from the currently running binary.
- `hasCodexMcpServer` (function): Check whether `.codex/config.toml` already contains an `[mcp_servers.lat]` table.
- `addCodexMcpServer` (function): Append an `[mcp_servers.lat]` table to `.codex/config.toml`.
- `writeTemplateFile` (function): Write a template-generated file, using stored hashes to decide whether to overwrite or prompt the user about local modifications.
- `extractMarkerSection` (function): Extract the content between lat markers in a file's text.
- `wrapWithMarkers` (function): Wrap template content with lat markers.
- `appendTemplateSection` (function): Write a template into a marker-fenced section of a file, preserving any user content outside the markers.
- Also defines: `confirm`, `prompt`, `LatCommandStyle`, `HookEntry`, `cursorHooksTemplate`, `ensureGitignored`, `McpConfig`, `hasMcpServer`, `addMcpServer`, `MARKER_BEGIN`, `MARKER_END`, `writeAgentsSkill`, `setupAgentsMd`, `setupClaudeCode`, `setupCursor`, `setupCopilot`, `setupPi`, `setupOpenCode`, `setupCodex`, `setupSemanticSearch`, `NEXT_STEP_PROMPT`, `printNextSteps`, `readLogo`, `initCmd`, `initCmd#ask`
- Imports: `src/cli/checklist-menu.ts`, `src/cli/gen.ts`, `src/cli/select-menu.ts`, `src/cli/templates.ts`, `src/config.ts`, `src/init-version.ts`, and 2 more

## src/cli/locate.ts

Source file `src/cli/locate.ts` defines `locateCommand`.

- Used by `lat locate`: Find sections by id
- Used by `MCP codekg_locate`: Find sections by name, path, or heading before reading source files
- Used by `MCP lat_locate`: Find sections by name (exact, fuzzy, subsequence matching)
- Defines: `locateCommand`
- Imports: `src/context.ts`, `src/format.ts`, `src/lattice.ts`
- Imported by: `src/codekg/mcp.ts`, `src/mcp/server.ts`

## src/cli/refs.ts

Source file `src/cli/refs.ts` defines `Scope`, `RefsFound`, `RefsError`, and 6 more.

- Used by `lat refs`: Find references to a section
- Used by `MCP codekg_refs`: Find sections that reference a given section via wiki links or @lat code comments
- Used by `MCP lat_refs`: Find sections that reference a given section via wiki links or @lat code comments
- `SOURCE_EXTS` (const): Extensions recognized as source code for ref queries.
- `isSourceQuery` (function): Check if a query looks like a source file path (has a recognized extension and the file exists on disk).
- `findSourceRefs` (function): Find references to a source file or symbol across lat.md and code files.
- `findRefs` (function): Find all sections and code locations that reference a given section or source file.
- Also defines: `Scope`, `RefsFound`, `RefsError`, `RefsResult`, `refsCommand`
- Tested by: `tests/cases.test.ts`
- Imports: `src/code-refs.ts`, `src/context.ts`, `src/format.ts`, `src/lattice.ts`
- Imported by: `src/codekg/mcp.ts`, `src/mcp/server.ts`, `tests/cases.test.ts`

## src/cli/search.ts

Source file `src/cli/search.ts` defines `SemanticMatch`, `SearchResult`, `IndexProgress`, and 8 more.

- Used by `lat search`: Semantic search across lat.md sections
- Used by `MCP lat_search`: Semantic search across lat.md sections using embeddings
- `runSearch` (function): Run a semantic search across lat.md sections.
- `runIndex` (function): Index-only mode (no query).
- `SearchPresentation` (type): Wording that differs between the lat and code-kg front ends.
- Also defines: `SemanticMatch`, `SearchResult`, `IndexProgress`, `withDb`, `cliProgress`, `cliProgress#beforeIndex`, `cliProgress#afterIndex`, `searchCommand`
- Imports: `src/context.ts`, `src/format.ts`, `src/lattice.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, and 1 more
- Imported by: `src/cli/hook.ts`, `src/codekg/query.ts`, `src/codekg/semantic.ts`, `src/codekg/update.ts`, `src/mcp/server.ts`

## src/cli/section.ts

Source file `src/cli/section.ts` defines `CodeBackRef`, `SourceRef`, `SectionFound`, and 6 more.

- Used by `lat section`: Show a section with its content, outgoing refs, and incoming refs
- Used by `MCP codekg_section`: Show one section with outgoing and incoming references
- Used by `MCP lat_section`: Show a section with its content, outgoing wiki link targets, and incoming references
- `getSection` (function): Look up a section by id, return its content, outgoing wiki link targets, and incoming references from other sections.
- `formatSectionOutput` (function): Format a successful section result with styling.
- Also defines: `CodeBackRef`, `SourceRef`, `SectionFound`, `SectionResult`, `fullEndLine`, `truncate`, `sectionCommand`
- Tested by: `tests/cases.test.ts`
- Imports: `src/code-refs.ts`, `src/context.ts`, `src/format.ts`, `src/lattice.ts`, `src/source-parser.ts`
- Imported by: `src/cli/hook.ts`, `src/codekg/mcp.ts`, `src/mcp/server.ts`, `tests/cases.test.ts`

## src/cli/select-menu.ts

Source file `src/cli/select-menu.ts` defines `SelectOption`, `selectMenu`, `selectMenu#render`, and 3 more.

- `selectMenu` (function): Display an interactive select menu with arrow-key navigation.
- Also defines: `SelectOption`, `selectMenu#render`, `selectMenu#clearRender`, `selectMenu#cleanup`, `selectMenu#onData`
- Imported by: `src/cli/init.ts`

## src/cli/templates.ts

Source file `src/cli/templates.ts` defines `findTemplatesDir`.

- Defines: `findTemplatesDir`
- Imported by: `src/cli/gen.ts`, `src/cli/init.ts`, `src/codekg/git-hooks.ts`

## src/code-refs.ts

Source file `src/code-refs.ts` defines `EXCLUDE_DIRS`, `EXCLUDE_GLOBS`, `walkFiles`, and 12 more.

- `EXCLUDE_DIRS` (const): Glob patterns used to exclude directories/files from code-ref scanning.
- `walkFiles` (function): Walk project files for code-ref scanning.
- `re` (function): Build a RegExp from a verbose template — whitespace is insignificant.
- `LAT_REF_RE` (const): Line comment (// or #), then @lat: marker, then target
- `tryExec` (function): Run an external command and return stdout, or null if the command is not found or fails.
- `findSubProjects` (function): Detect sub-projects (directories containing their own lat.md/) using rg --files.
- `rgExcludeArgs` (function): Build rg glob exclusion args.
- `tryRipgrep` (function): Try scanning with ripgrep.
- `parseGrepOutput` (function): Parse rg output lines (file:line:content) into CodeRef entries.
- `scanWithTs` (function): TypeScript fallback: read every file and scan for @lat refs.
- `hasRipgrep` (function): Check whether ripgrep (`rg`) is available on PATH.
- Also defines: `EXCLUDE_GLOBS`, `CodeRef`, `ScanResult`, `scanCodeRefs`
- Tested by: `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`, `tests/input-errors.test.ts`, `tests/walk-symlinks.test.ts`
- Imports: `src/walk.ts`
- Imported by: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/codekg/bootstrap.ts`, `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`, and 2 more

## src/codekg/agent-context.ts

Source file `src/codekg/agent-context.ts` defines `agentContextCommand`.

- Used by `code-kg agent-context`: Supply bounded, local-only context to agent lifecycle hooks
- Defines: `agentContextCommand`
- Tested by: `tests/codekg-intelligence.test.ts`
- Imports: `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/query.ts`, `src/codekg/structural.ts`, `src/context.ts`
- Imported by: `tests/codekg-intelligence.test.ts`

## src/codekg/agents.ts

Source file `src/codekg/agents.ts` defines `SECTION_START`, `SECTION_END`, `CODEX_HOOK_COMMAND`, and 55 more.

- Used by `code-kg agents install`: Install managed AGENTS.md guidance and safe Codex hook
- Used by `code-kg agents uninstall`: Remove managed Code-KG agent guidance and hook entries
- Used by `code-kg agents status`: Show Code-KG agent guidance, hook, semantic, and MCP status
- Used by `code-kg hook-check`: Run the safe Code-KG agent hook check
- Used by `code-kg session-check`: Run the safe Code-KG SessionStart bootstrap-offer check
- `malformedAgentsBlock` (function): Install and uninstall splice exactly one START…END block.
- Also defines: `SECTION_START`, `SECTION_END`, `CODEX_HOOK_COMMAND`, `CODEX_HOOK_MATCHER`, `GENERIC_SEARCH_COMMAND`, `HookCommandSelection`, `AgentsOptions`, `HookCheckOptions`, `HookAction`, `HookCommand`, `HookEntry`, `CodexHooksConfig`, `CodexHookDetails`, `shellQuote`, `currentCliPath`, `commandExistsOnPath`, `selectHookCommand`, `managedAgentsSection`, `readText`, `replaceManagedSection`, `removeManagedSection`, `installAgentsMd`, `uninstallAgentsMd`, `isCodeKgHook`, `codeKgHookCommandKind`, `removeCodeKgHookEntries`, `readCodexHooks`, `installCodexHook`, `uninstallCodexHook`, `agentsGuidanceInstalled`, and 27 more
- Tested by: `tests/agents-edge-cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`
- Imports: `src/codekg/discovery.ts`, `src/codekg/git-hooks.ts`, `src/codekg/semantic.ts`, `src/context.ts`
- Imported by: `tests/agents-edge-cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

## src/codekg/anchor.ts

Source file `src/codekg/anchor.ts` defines `AnchorOptions`, `reply`, `quote`, and 8 more.

- Used by `code-kg anchor`: Anchor a curated section to a symbol or file so apply-backlinks follows it as the source moves
- Used by `MCP codekg_anchor`: Add, remove, or list the symbols and files a curated section is anchored to; apply-backlinks inserts backlinks at their current location
- `resolveNode` (function): Accepts a node id, `&lt;file>#&lt;symbol>`, a file path, or a unique symbol name.
- `targetEntry` (function): Generated files are rewritten by `code-kg update`, so only their own curated or edited entry may carry anchors.
- Also defines: `AnchorOptions`, `reply`, `quote`, `resolveSection`, `Target`, `sectionEntry`, `matchAnchor`, `listAnchors`, `anchorCommand`
- Tested by: `tests/anchor.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/codekg/visibility.ts`, and 2 more
- Imported by: `src/codekg/mcp.ts`, `tests/anchor.test.ts`

## src/codekg/anchors.ts

Source file `src/codekg/anchors.ts` defines `sourceAnchorPolicy`, `backlinkAnchorsForSection`, `isSectionEntry`, and 6 more.

- `isSectionEntry` (function): Materialization owns one entry per knowledge file, keyed by its path.
- `manifestOwner` (function): The entry for this exact section, else the entry for the file holding it.
- `sectionNodeIds` (function): Graph nodes a section documents, through coverage evidence or anchors.
- `anchorChanges` (function): Anchors whose node is gone, and anchors whose node's body changed since the section was last reviewed against it.
- `anchorSpan` (function): Where a backlink for an anchored node goes; files take it at the top.
- Also defines: `sourceAnchorPolicy`, `backlinkAnchorsForSection`, `sourceAnchor`, `anchorName`
- Tested by: `tests/anchor.test.ts`, `tests/codekg.test.ts`
- Imports: `src/codekg/types.ts`
- Imported by: `src/codekg/anchor.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/context.ts`, `src/codekg/drift.ts`, and 5 more

## src/codekg/backlinks.ts

Source file `src/codekg/backlinks.ts` defines `ApplyBacklinksOptions`, `BacklinkInsertion`, `BacklinkSkip`, and 24 more.

- Used by `code-kg apply-backlinks`: Preview or insert edit-safe @lat source backlinks
- Used by `MCP codekg_apply_backlinks`: Preview or insert edit-safe @lat source backlinks
- `projectFile` (function): Resolves a manifest-relative path to its real location, refusing anything outside the project.
- `backlinkLine` (function): A shebang only works on line 1.
- `insertCommentLine` (function): Inserts `comment` as a new line before 1-based `line`, matching that line's indentation and line ending.
- `rehashAnchors` (function): An inserted comment changes the hash of an anchored file, and of an anchored symbol whose body contains it.
- Also defines: `ApplyBacklinksOptions`, `BacklinkInsertion`, `BacklinkSkip`, `BacklinkPlan`, `SLASH_COMMENT_EXTENSIONS`, `HASH_COMMENT_EXTENSIONS`, `SKIP_PATH_PARTS`, `manifestPath`, `readManifest`, `commentPrefix`, `skippedPathReason`, `isInside`, `CODING_COOKIE`, `BLANK_OR_COMMENT`, `missingManifest`, `BacklinkTarget`, `anchoredTargets`, `backlinkPlan`, `formatPlan`, `rehashAnchors#hashes`, `writeInsertions`, `writeInsertions#shift`, `applyBacklinksCommand`
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg.test.ts`

## src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` defines `MergeProposal`, `SECTION_HEADINGS`, `DEFAULT_GITIGNORE_LINES`, and 46 more.

- Used by `code-kg init`: Create the initial Code-KG knowledge base
- `curatedRootEntries` (function): Hand-written files and directories at the top of `lat.md/`.
- `specCheck` (function): The test a `@lat` comment sits on or directly above, as `file`: suite › name.
- Also defines: `MergeProposal`, `SECTION_HEADINGS`, `DEFAULT_GITIGNORE_LINES`, `SOURCE_IMPORT_LIMIT`, `hash`, `firstHeadingPath`, `bulletList`, `fileCategoryLine`, `graphCountLine`, `categoryByPath`, `graphFileNodes`, `localImports`, `localFileRelations`, `inlineCodeList`, `briefInlineCodeList`, `renderEntryPointFlow`, `renderDependencyHotspots`, `GENERATED_ROOT_ENTRIES`, `RootEntry`, `leadingSentence`, `rootIndex`, `architectureFile`, `crossCuttingFile`, `confidenceFile`, `SpecTree`, `titleCase`, `fileTitle`, `isSectionSpecTarget`, `specStemForTarget`, `specNode`, and 17 more
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/cards.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, and 4 more
- Imports: `src/code-refs.ts`, `src/codekg/anchors.ts`, `src/codekg/cards.ts`, `src/codekg/discovery.ts`, `src/codekg/graph.ts`, `src/codekg/limits.ts`, and 2 more
- Imported by: `src/codekg/cli.ts`, `src/codekg/update.ts`, `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/cards.test.ts`, `tests/codekg-intelligence.test.ts`, and 6 more

## src/codekg/cache.ts

Source file `src/codekg/cache.ts` defines `readJson`, `writeJsonAtomic`.

- Defines: `readJson`, `writeJsonAtomic`
- Tested by: `tests/codekg-intelligence.test.ts`, `tests/enrich.test.ts`
- Imported by: `src/codekg/agent-context.ts`, `src/codekg/anchor.ts`, `src/codekg/backlinks.ts`, `src/codekg/enrich.ts`, `src/codekg/graph.ts`, `src/codekg/meaning.ts`, and 7 more

## src/codekg/cards.ts

Source file `src/codekg/cards.ts` defines `SYMBOL_DOC_LIMIT`, `SYMBOL_NAME_LIMIT`, `TEST_NAME_LIMIT`, and 34 more.

- `HELPER_COMMAND_LIMIT` (const): An identifier called by more registered commands than this is a shared helper.
- `prose` (function): Markdown-safe single-line prose: no wiki links, HTML comments, or stray whitespace.
- `commentAbove` (function): Comment text, without markers, for a contiguous comment block ending at `end` (0-based).
- `commentParagraph` (function): The first paragraph of comment text, before any JSDoc-style tag.
- `symbolDoc` (function): The doc comment directly above a symbol, skipping decorators and `@lat` backlinks.
- `fileDoc` (function): The comment that opens a file, unless it documents the first symbol instead.
- `closeParen` (function): Index just past the `)` that closes the `(` at `open`, skipping strings and comments.
- `registeredCommands` (function): Commander `.command()` chains and MCP `.tool()` / `.registerTool()` calls.
- `testDeclarations` (function): `it`/`test` calls (with their `describe` suites), Python `test_` functions, Go `Test` funcs.
- `cardPaths` (function): Files that get a card: parsed code and tests, minus fixtures nothing imports.
- `commandsByFile` (function): Commands whose handlers call into each file, keyed by file.
- `uniqueDefinitions` (function): Symbol names that only one file defines, mapped to that file.
- `renderCard#name` (function): The extractor tells repeated names apart as `name~2`, `name~3`, ...
- `filesFile` (function): `lat.md/files.md`: one card per source and test file, built from names, docs, and relations.
- Also defines: `SYMBOL_DOC_LIMIT`, `SYMBOL_NAME_LIMIT`, `TEST_NAME_LIMIT`, `COMMAND_LIMIT`, `RELATION_LIMIT`, `DOC_MAX`, `HASH_COMMENT_EXTENSIONS`, `SCRIPT_EXTENSIONS`, `TEST_ROOTS`, `CALL_KEYWORDS`, `Command`, `TestDeclaration`, `isHashCommented`, `firstSentence`, `isDirective`, `pythonDocstring`, `STRING`, `stringArg`, `calledIdentifiers`, `codeList`, `relatedFiles`, `renderCard`, `filesFile#related`
- Tested by: `tests/cards.test.ts`
- Imports: `src/codekg/limits.ts`, `src/codekg/types.ts`
- Imported by: `src/codekg/bootstrap.ts`, `tests/cards.test.ts`

## src/codekg/changed.ts

Source file `src/codekg/changed.ts` defines `gitChangedFiles`, `changedCommand`.

- Used by `code-kg changed`: Show Code-KG impact for current git working-tree changes
- Used by `MCP codekg_changed`: Map working-tree changes to knowledge sections and tests
- Defines: `gitChangedFiles`, `changedCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/context.ts`, `src/codekg/fresh.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/codekg.test.ts`

## src/codekg/check.ts

Source file `src/codekg/check.ts` defines `hasGeneratedMarkers`, `appendErrors`, `lineCount`, and 4 more.

- Used by `code-kg check`: Validate lat.md and Code-KG metadata
- Used by `MCP codekg_check`: Validate markdown, links, source refs, and directory indexes in lat.md
- Defines: `hasGeneratedMarkers`, `appendErrors`, `lineCount`, `validateSourceSpan`, `validSourceAnchor`, `validateManifestAnchors`, `codeKgCheckCommand`
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, `tests/curated-files.test.ts`
- Imports: `src/cli/check.ts`, `src/codekg/anchors.ts`, `src/codekg/types.ts`, `src/context.ts`, `src/lattice.ts`, `src/walk.ts`
- Imported by: `src/codekg/cli.ts`, `src/codekg/doctor.ts`, `src/codekg/mcp.ts`, `src/codekg/update.ts`, `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, and 4 more

## src/codekg/cli.ts

Source file `src/codekg/cli.ts` defines `PreviewAcceptOptions`, `ExtractOptions`, `DriftOptions`, and 22 more.

- Registers 52 commands: `code-kg bootstrap`, `code-kg materialize`, `code-kg extract`, `code-kg init`, `code-kg doctor`, `code-kg install-global`, `code-kg semantic`, `code-kg semantic status`, `code-kg semantic enable-local`, `code-kg semantic reindex`, `code-kg search`, `code-kg context`, `code-kg gaps`, `code-kg changed`, `code-kg update`, `code-kg enrich`, `code-kg check`, `code-kg drift`, `code-kg reconcile`, `code-kg confidence`, `code-kg confidence list`, `code-kg confidence accept`, `code-kg confidence reject`, `code-kg confidence reconcile`, `code-kg suppress`, `code-kg suppress list`, `code-kg suppress node`, `code-kg suppress relationship`, `code-kg suppress clear`, `code-kg apply-backlinks`, and 22 more
- Defines: `PreviewAcceptOptions`, `ExtractOptions`, `DriftOptions`, `ReconcileOptions`, `ConfidenceReconcileOptions`, `ApplyBacklinksOptions`, `SearchCliOptions`, `InstallGlobalOptions`, `findVersion`, `handleResult`, `parsePositiveInteger`, `parseSearchBackend`, `readStdinIfAvailable`, `runCheck`, `latContext`, `rootOnlyContext`, `runMaterialization`, `runExtract`, `program`, `semantic`, `confidence`, `suppress`, `agents`, `gitHooks`, `workspace`
- Inferred tests (load it by path, not by import): `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/git-hooks.test.ts`, `tests/hook-stdin.test.ts`, `tests/input-errors.test.ts`
- Imports: `src/cli/context.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/graph.ts`, `src/codekg/search.ts`, `src/context.ts`

## src/codekg/confidence.ts

Source file `src/codekg/confidence.ts` defines `ConfidenceAction`, `ConfidenceOptions`, `PromotionCandidate`, and 15 more.

- Used by `code-kg confidence list`: List inferred and ambiguous manifest relationships
- Used by `code-kg confidence accept`: Mark a manifest relationship as accepted
- Used by `code-kg confidence reject`: Mark a manifest relationship as rejected
- Used by `code-kg confidence reconcile`: Detect confidence annotations removed from markdown
- Used by `MCP codekg_confidence`: List, accept, reject, or reconcile manifest confidence review items
- Defines: `ConfidenceAction`, `ConfidenceOptions`, `PromotionCandidate`, `manifestPath`, `readManifest`, `writeManifest`, `missingManifest`, `isReviewable`, `relationshipTarget`, `relationshipSourceFile`, `formatRelationship`, `formatList`, `formatMutation`, `escapeRegExp`, `lineContaining`, `findPromotionCandidates`, `formatReconcile`, `confidenceCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/types.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/codekg.test.ts`

## src/codekg/context.ts

Source file `src/codekg/context.ts` defines `ContextInfo`, `inlineList`, `formatTestLabel`, and 13 more.

- Used by `code-kg context`: Show graph, docs, and test context for a file or symbol
- Used by `MCP codekg_context`: Map a source file or symbol to knowledge sections and test relationships
- Defines: `ContextInfo`, `inlineList`, `formatTestLabel`, `readManifest`, `unique`, `nodeMatchesQuery`, `nodeContainsQuery`, `matchedNodes`, `nodeFiles`, `relationshipLabels`, `manifestSectionIdsForNodes`, `matchingSections`, `buildContextInfo`, `buildContextInfo#label`, `formatContextInfo`, `contextCommand`
- Tested by: `tests/anchor.test.ts`, `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/fresh.ts`, `src/codekg/query.ts`, `src/codekg/types.ts`, `src/context.ts`, `src/lattice.ts`
- Imported by: `src/codekg/changed.ts`, `src/codekg/mcp.ts`, `tests/anchor.test.ts`, `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`

## src/codekg/discovery.ts

Source file `src/codekg/discovery.ts` defines `CODE_EXTENSIONS`, `DOC_EXTENSIONS`, `ASSET_EXTENSIONS`, and 8 more.

- Defines: `CODE_EXTENSIONS`, `DOC_EXTENSIONS`, `ASSET_EXTENSIONS`, `CONFIG_FILES`, `isIgnoredByCodeKg`, `isTestPath`, `categoryFor`, `emptyCounts`, `packageHints`, `entrypoints`, `discoverProject`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/walk.ts`
- Imported by: `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/graph.ts`, `tests/codekg.test.ts`

## src/codekg/doctor.ts

Source file `src/codekg/doctor.ts` defines `AGENTS_MARKER`, `CODEX_HOOK_COMMAND`, `codeKgHookCommandKind`, and 9 more.

- Used by `code-kg doctor`: Check Code-KG setup health
- Defines: `AGENTS_MARKER`, `CODEX_HOOK_COMMAND`, `codeKgHookCommandKind`, `readText`, `readManifest`, `sectionStatusSummary`, `ignoreLineMatchesCache`, `cacheIgnored`, `latCacheIgnored`, `agentsGuidanceInstalled`, `codexHookStatus`, `doctorCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/check.ts`, `src/codekg/git-hooks.ts`, `src/codekg/semantic.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imported by: `tests/codekg.test.ts`

## src/codekg/drift.ts

Source file `src/codekg/drift.ts` defines `DriftSeverity`, `DriftFinding`, `DriftOptions`, and 19 more.

- Used by `code-kg drift`: Report drift between code and knowledge base
- Used by `MCP codekg_drift`: Report drift between source code, lat.md sections, and Code-KG manifest state
- Defines: `DriftSeverity`, `DriftFinding`, `DriftOptions`, `manifestPath`, `readManifest`, `manifestSourceNodeIds`, `manifestGraphHashes`, `findMissingSourceNodes`, `findChangedAnchors`, `findUncoveredFiles`, `relationshipMatchesEdge`, `observedRelationship`, `findStaleRelationships`, `sectionPriority`, `eligibleSectionsForNode`, `graphNodeById`, `isCrossFileRelationship`, `relationshipAlreadyReviewed`, `findSuggestedRelationships`, `formatFindings`, `applySafeManifestUpdates`, `driftCommand`
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/graph.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `src/codekg/update.ts`, `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

## src/codekg/enrich.ts

LLM enrichment for generated lat.md leading paragraphs.

- Used by `code-kg enrich`: Rewrite generated section summaries with an LLM (requires LAT_LLM_KEY)
- Defines: `ChatProvider`, `OPENROUTER`, `OPENAI`, `ANTHROPIC`, `XAI`, `detectChatProvider`, `SYSTEM`, `chatSummary`, `shouldEnrich`, `sectionSnippet`, `enrichCommand`, `enrichCommand#score`
- Tested by: `tests/config-corrupt.test.ts`, `tests/enrich.test.ts`
- Imports: `src/codekg/cache.ts`, `src/codekg/limits.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/config.ts`, `src/context.ts`, and 1 more
- Imported by: `src/codekg/update.ts`, `tests/config-corrupt.test.ts`, `tests/enrich.test.ts`

## src/codekg/errors.ts

Source file `src/codekg/errors.ts` defines `InputError`, `InputError#name`.

- `InputError` (class): A problem with user-supplied input, reported without a stack trace.
- Also defines: `InputError#name`
- Tested by: `tests/input-errors.test.ts`
- Imported by: `src/codekg/query.ts`, `src/codekg/workspace.ts`, `tests/input-errors.test.ts`

## src/codekg/fresh.ts

Source file `src/codekg/fresh.ts` defines `active`, `freshGraph`, `refresh`.

- Defines: `active`, `freshGraph`, `refresh`
- Tested by: `tests/codekg-intelligence.test.ts`
- Imports: `src/codekg/graph.ts`, `src/codekg/types.ts`
- Imported by: `src/codekg/agent-context.ts`, `src/codekg/anchor.ts`, `src/codekg/backlinks.ts`, `src/codekg/changed.ts`, `src/codekg/context.ts`, `src/codekg/meaning.ts`, and 3 more

## src/codekg/gaps.ts

Source file `src/codekg/gaps.ts` defines `readManifest`, `bullet`, `gapsCommand`, and 1 more.

- Used by `code-kg gaps`: Report missing knowledge, anchors, and test coverage
- Used by `MCP codekg_gaps`: Report missing source documentation and test relationships
- Defines: `readManifest`, `bullet`, `gapsCommand`, `gapsCommand#testTargets`
- Tested by: `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/graph.ts`, `src/codekg/types.ts`, `src/context.ts`, `src/lattice.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`

## src/codekg/git-hooks.ts

Source file `src/codekg/git-hooks.ts` defines `MANAGED_MARKER`, `LEGACY_MARKER`, `HOOK_MODE`, and 12 more.

- Used by `code-kg init`: Create the initial Code-KG knowledge base
- Used by `code-kg git-hooks install`: Install the Code-KG pre-commit hook into this repository
- Used by `code-kg git-hooks uninstall`: Remove the Code-KG pre-commit hook from this repository
- Used by `code-kg git-hooks status`: Show whether the Code-KG pre-commit hook is installed
- `MANAGED_MARKER` (const): Robust marker so `status`/`uninstall` only ever touch a hook we installed.
- `resolveHooksDir` (function): Resolve the repo's git hooks directory, honoring `core.hooksPath` and worktrees.
- Also defines: `LEGACY_MARKER`, `HOOK_MODE`, `GitHooksOptions`, `GitHookState`, `GitHookStatus`, `loadHookTemplate`, `isManagedHook`, `readText`, `installGitHook`, `uninstallGitHook`, `gitHookStatus`, `gitHookStatusLine`, `gitHooksCommand`
- Tested by: `tests/git-hooks.test.ts`
- Imports: `src/cli/templates.ts`, `src/context.ts`
- Imported by: `src/codekg/agents.ts`, `src/codekg/doctor.ts`, `tests/git-hooks.test.ts`

## src/codekg/global-install.ts

Source file `src/codekg/global-install.ts` defines `InstallGlobalOptions`, `shellQuote`, `currentCliPath`, and 4 more.

- Used by `code-kg install-global`: Install a code-kg wrapper into a PATH bin directory
- Defines: `InstallGlobalOptions`, `shellQuote`, `currentCliPath`, `defaultBinDir`, `pathContains`, `assertReadable`, `installGlobalCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/context.ts`
- Imported by: `tests/codekg.test.ts`

## src/codekg/graph.ts

Source file `src/codekg/graph.ts` defines `LOCAL_IMPORT_EXTENSIONS`, `GRAPH_CACHE_PATH`, `ImportSpec`, and 35 more.

- `LOADER_SPECIFIER` (const): `from 'p'`, `import('p')`, `require('p')`.
- `URL_SPECIFIER` (const): `new URL('p', import.meta.url)`, resolved from the test file.
- `ANCHORED_JOIN` (const): `join(__dirname, '..', 'dist', 'cli.js')` built only from literals.
- `PROCESS_CALL` (const): A subprocess call name, also as `promisify(execFile)(...)`.
- `processCalls` (function): Argument ranges `[start, end)` of subprocess calls in code, not text.
- `mentionCandidates` (function): Repo paths a mention can mean: built output maps back to its source.
- `loadedPaths` (function): Module paths a test file shows evidence of loading: loader specifiers and paths built from the test file's own location in its code, and any path or loader…
- `inferredTestEdges` (function): Tests that load a module by path (a subprocess script, a built `dist/` file, a dynamic import string) have no static import edge.
- Also defines: `LOCAL_IMPORT_EXTENSIONS`, `GRAPH_CACHE_PATH`, `ImportSpec`, `stableId`, `moduleLabel`, `fileNode`, `moduleNode`, `symbolNode`, `edge`, `validateGraphFragment`, `extractImportSpecs`, `extractPythonImportSpecs`, `pythonImportedNames`, `joinPythonModule`, `candidatePaths`, `resolveLocalImportSpec`, `resolveLocalImports`, `uniqueStrings`, `mergeFragments`, `nodeCommunity`, `analyzeGraph`, `PATH_MENTION`, `QUOTED`, `loadedPaths#isEvidence`, `loadedPaths#relative`, `extractProjectGraph`, `hashProjectGraph`, `writeGraphCache`, `formatGraphReport`, `qualityGateWarnings`
- Tested by: `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`
- Imports: `src/codekg/cache.ts`, `src/codekg/discovery.ts`, `src/codekg/source-scan.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/source-parser.ts`
- Imported by: `src/codekg/bootstrap.ts`, `src/codekg/cli.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, `src/codekg/gaps.ts`, `tests/codekg-intelligence.test.ts`, and 2 more

## src/codekg/limits.ts

Budgets for short display previews and complete source explanations.

- `LEADING_PARAGRAPH_MAX` (const): Max characters for a section's leading paragraph (excluding wiki links).
- `PREVIEW_MAX_TOKENS` (const): Preview generation is separate from the full source-description budget.
- `descriptionPreview` (function): A display excerpt only; the complete description is retained separately.
- `bodyTextLength` (function): Count body text length excluding `...` wiki link markers and content.
- `clampLeadingParagraph` (function): Clamp prose to the leading-paragraph budget used by `code-kg check`.
- Also defines: `sourceSummaryMaxTokens`
- Inferred tests (load it by path, not by import): `tests/limits.test.ts`
- Imported by: `src/cli/check.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cards.ts`, `src/codekg/enrich.ts`, `src/codekg/meaning.ts`

## src/codekg/mcp.ts

Source file `src/codekg/mcp.ts` defines `BudgetOptions`, `estimateTokens`, `applyTokenBudget`, and 3 more.

- Used by `code-kg mcp`: Start the MCP server
- Registers 20 commands: `MCP codekg_locate`, `MCP codekg_section`, `MCP codekg_search`, `MCP codekg_expand`, `MCP codekg_check`, `MCP codekg_refs`, `MCP codekg_confidence`, `MCP codekg_suppress`, `MCP codekg_drift`, `MCP codekg_apply_backlinks`, `MCP codekg_anchor`, `MCP codekg_workspace_ask`, `MCP codekg_ask`, `MCP codekg_trace_calls`, `MCP codekg_repo_map`, `MCP codekg_file_api`, `MCP codekg_find_all`, `MCP codekg_context`, `MCP codekg_changed`, `MCP codekg_gaps`
- Defines: `BudgetOptions`, `estimateTokens`, `applyTokenBudget`, `toMcp`, `createCodeKgMcpServer`, `startCodeKgMcpServer`
- Tested by: `tests/anchor.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/trace-depth.test.ts`
- Imports: `src/cli/expand.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/codekg/anchor.ts`, `src/codekg/backlinks.ts`, and 12 more
- Imported by: `tests/anchor.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/trace-depth.test.ts`

## src/codekg/meaning.ts

Source file `src/codekg/meaning.ts` defines `SourceMeaning`, `MeaningCache`, `cachePath`, and 3 more.

- Used by `code-kg enrich`: Rewrite generated section summaries with an LLM (requires LAT_LLM_KEY)
- Defines: `SourceMeaning`, `MeaningCache`, `cachePath`, `contract`, `currentMeanings`, `enrichSourcesCommand`
- Tested by: `tests/codekg-intelligence.test.ts`
- Imports: `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/limits.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imported by: `src/codekg/query.ts`, `tests/codekg-intelligence.test.ts`

## src/codekg/query.ts

Source file `src/codekg/query.ts` defines `QueryOptions`, `QueryHit`, `QueryResult`, and 15 more.

- Used by `code-kg ask`: Search reviewed knowledge and fresh source with lexical, semantic, and graph ranking
- Used by `code-kg map`: Show a bounded repository map and dependency hotspots
- Used by `code-kg skeleton`: Show a source file API without reading its entire body
- Used by `code-kg grep`: Find all occurrences in indexed source files
- Used by `MCP codekg_ask`: Retrieve reviewed knowledge plus fresh source, ranked by lexical relevance, local semantic search, and dependencies
- Used by `MCP codekg_trace_calls`: Trace callers and references (direction "in", the default) or callees (direction "out"); inferred edges remain labeled. Depth defaults to 1 (direct only, like CLI `callers`/`callees`); pass depth "all" for transitive impact like CLI `impact`.
- Used by `MCP codekg_repo_map`: Read a bounded source map and dependency hotspots
- Used by `MCP codekg_file_api`: Read signatures and symbol locations in a file
- `projectQuery` (function): Agent tool payloads name files by absolute path; graph nodes use project-relative ones.
- `semanticBonus` (function): Knowledge-score bonus per semantic match: 1 for the closest match, falling linearly with similarity to 0 at the noise floor.
- Also defines: `QueryOptions`, `QueryHit`, `QueryResult`, `tokenize`, `withinScope`, `bounded`, `currentSource`, `graphRank`, `ask`, `formatQuery`, `askCommand`, `trace`, `traceCommand`, `mapCommand`, `skeletonCommand`, `grepCommand`
- Tested by: `tests/cards.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, `tests/input-errors.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search-fallback.test.ts`, and 2 more
- Imports: `src/cli/search.ts`, `src/codekg/anchors.ts`, `src/codekg/cache.ts`, `src/codekg/errors.ts`, `src/codekg/fresh.ts`, `src/codekg/meaning.ts`, and 7 more
- Imported by: `src/codekg/agent-context.ts`, `src/codekg/context.ts`, `src/codekg/mcp.ts`, `src/codekg/workspace.ts`, `tests/cards.test.ts`, `tests/codekg-intelligence.test.ts`, and 6 more

## src/codekg/reconcile.ts

Source file `src/codekg/reconcile.ts` defines `ReconcileOptions`, `ReconcileChange`, `hash`, and 4 more.

- Used by `code-kg reconcile`: Reconcile generated section status in the manifest
- Defines: `ReconcileOptions`, `ReconcileChange`, `hash`, `manifestPath`, `readManifest`, `formatOutput`, `reconcileCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/types.ts`, `src/context.ts`
- Imported by: `tests/codekg.test.ts`

## src/codekg/review-source.ts

Source file `src/codekg/review-source.ts` defines `reviewSourceCommand`, `reviewSourceCommand#count`.

- Used by `code-kg review-source`: Explicitly acknowledge source review and preserve a section as curated
- Defines: `reviewSourceCommand`, `reviewSourceCommand#count`
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`
- Imports: `src/codekg/anchors.ts`, `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/structural.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imported by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`

## src/codekg/search.ts

Source file `src/codekg/search.ts` defines `CodeKgSearchBackend`, `ResolvedSearchBackend`, `CodeKgSearchOptions`, and 15 more.

- Used by `code-kg search`: Search lat.md sections with local or semantic retrieval
- Used by `MCP codekg_search`: Search across curated lat.md sections with local lexical search by default, semantic embedding search when requested, or auto-semantic fallback
- `withCodeKgNavHints` (function): Replaces the lat.md runtime's `lat section`/`lat_section` hints.
- `STOP_WORDS` (const): Question words that match nearly every section's prose.
- `IDENTIFIER` (const): A camelCase, PascalCase or snake_case name, or a dotted or slashed path.
- `isIdentifierQuery` (function): True for queries made only of code names or paths, such as `writeJsonAtomic` or `src/codekg/cache.ts`.
- `readSectionBodies` (function): Each section's text below its heading, keyed by section id.
- `rankSectionsLexically` (function): Sections matching `query` lexically, best first.
- Also defines: `CodeKgSearchBackend`, `ResolvedSearchBackend`, `CodeKgSearchOptions`, `SearchBackendSelection`, `formatCodeKgNavHints`, `scoreSection`, `localSearchCommand`, `fallbackLabel`, `selectCodeKgSearchBackend`, `semanticSearchCommand`, `withBackendLabel`, `codeKgSearchCommand`
- Tested by: `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search-fallback.test.ts`
- Imports: `src/config.ts`, `src/context.ts`, `src/format.ts`, `src/lattice.ts`
- Imported by: `src/codekg/cli.ts`, `src/codekg/mcp.ts`, `src/codekg/query.ts`, `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, `tests/retrieval-eval.test.ts`, and 1 more

## src/codekg/semantic.ts

Source file `src/codekg/semantic.ts` defines `SemanticAction`, `SemanticOptions`, `SemanticSummary`, and 9 more.

- Used by `code-kg semantic status`: Show semantic search provider and vector cache status
- Used by `code-kg semantic enable-local`: Use local embeddings for semantic search
- Used by `code-kg semantic reindex`: Rebuild the semantic search vector cache
- Defines: `SemanticAction`, `SemanticOptions`, `SemanticSummary`, `vectorCachePresent`, `semanticSummary`, `providerLabel`, `cacheLabel`, `semanticDoctorStatus`, `formatStatus`, `cacheModel`, `formatEnableLocal`, `semanticCommand`
- Tested by: `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`
- Imports: `src/cli/search.ts`, `src/config.ts`, `src/context.ts`, `src/search/db.ts`, `src/search/provider.ts`
- Imported by: `src/codekg/agents.ts`, `src/codekg/doctor.ts`, `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`

## src/codekg/source-scan.ts

Source file `src/codekg/source-scan.ts` defines `SourceScan`, `HASH_COMMENT_FILE`, `REGEX_AFTER_WORD`, and 7 more.

- `scanSource` (function): Finds comments and string literals well enough to tell code from prose and data.
- `stringAt` (function): The `[start, end)` range of the string literal containing `index`.
- `closingParen` (function): The end of the parenthesized argument list opening at `open`, skipping strings and comments, or -1 when it never closes.
- Also defines: `SourceScan`, `HASH_COMMENT_FILE`, `REGEX_AFTER_WORD`, `stringEnd`, `regexAllowed`, `regexEnd`, `scanSource#blank`
- Tested by: `tests/source-scan.test.ts`
- Imported by: `src/codekg/graph.ts`, `tests/source-scan.test.ts`

## src/codekg/stdin.ts

Source file `src/codekg/stdin.ts` defines `HOOK_INPUT_IDLE_MS`, `HOOK_INPUT_FIRST_BYTE_MS`, `HookInputOptions`, and 7 more.

- `HOOK_INPUT_FIRST_BYTE_MS` (const): Hosts can be slow to start writing; hook timeouts are 10-15s.
- `topLevelCloseTracker` (function): Tracks bracket depth outside JSON strings across chunks, so the payload is parsed only when a top-level value may have closed.
- `readHookInput` (function): Reads a hook payload without depending on the host closing the pipe.
- `hookInputProblem` (function): Why a hook will ignore its stdin payload, or null when it looks usable.
- Also defines: `HOOK_INPUT_IDLE_MS`, `HookInputOptions`, `isCompleteJson`, `readHookInput#finish`, `readHookInput#arm`, `readHookInput#onData`
- Tested by: `tests/hook-stdin.test.ts`
- Imported by: `tests/hook-stdin.test.ts`

## src/codekg/structural.ts

Source file `src/codekg/structural.ts` defines `GRAPH_EXTENSIONS`, `FileExtraction`, `EXTRACTOR_VERSION`, and 7 more.

- `GRAPH_EXTENSIONS` (const): These extensions include the upstream depth and generic tiers.
- `EXTRACTOR_VERSION` (const): Bump when changing the adapter, legacy symbol parser, or vendored extraction.
- Also defines: `FileExtraction`, `ExtractionCache`, `StructuralSnapshot`, `memory`, `stats`, `extractionStats`, `sourceHash`, `extractStructural`
- Tested by: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/enrich.test.ts`
- Imports: `src/codekg/cache.ts`, `src/source-parser.ts`
- Imported by: `src/codekg/agent-context.ts`, `src/codekg/anchor.ts`, `src/codekg/backlinks.ts`, `src/codekg/discovery.ts`, `src/codekg/enrich.ts`, `src/codekg/graph.ts`, and 6 more

## src/codekg/suppress.ts

Source file `src/codekg/suppress.ts` defines `SuppressAction`, `SuppressOptions`, `manifestPath`, and 9 more.

- Used by `code-kg suppress list`: List suppressed graph nodes and relationships
- Used by `code-kg suppress node`: Suppress a graph node candidate
- Used by `code-kg suppress relationship`: Suppress a graph relationship candidate
- Used by `code-kg suppress clear`: Clear a suppression tombstone by id
- Used by `MCP codekg_suppress`: List, add, or clear Code-KG suppression tombstones
- Defines: `SuppressAction`, `SuppressOptions`, `manifestPath`, `readManifest`, `writeManifest`, `ensureSuppressed`, `missingManifest`, `missingId`, `formatList`, `addSuppression`, `clearSuppression`, `suppressCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/codekg/types.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/codekg.test.ts`

## src/codekg/types.ts

Source file `src/codekg/types.ts` defines `FileCategory`, `DiscoveredFile`, `DiscoveryResult`, and 16 more.

- `SourceAnchor` (type): A graph node pinned by `code-kg anchor`; `symbol` is absent for a file.
- Also defines: `FileCategory`, `DiscoveredFile`, `DiscoveryResult`, `SourceSpan`, `Confidence`, `EntityNode`, `RelationshipEdge`, `GraphFragment`, `Community`, `Gap`, `GraphAnalysis`, `ProjectGraph`, `BootstrapFile`, `BootstrapPlan`, `ManifestSection`, `RelationshipStatus`, `ManifestRelationship`, `MaterializationManifest`
- Tested by: `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, `tests/curated-files.test.ts`, `tests/retrieval-eval.test.ts`
- Imported by: `src/codekg/anchor.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cards.ts`, `src/codekg/check.ts`, and 21 more

## src/codekg/update.ts

Source file `src/codekg/update.ts` defines `UpdateOptions`, `updateCommand`.

- Used by `code-kg update`: Refresh generated knowledge, semantic index, check, and drift
- Defines: `UpdateOptions`, `updateCommand`
- Tested by: `tests/codekg.test.ts`
- Imports: `src/cli/search.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/drift.ts`, `src/codekg/enrich.ts`, `src/config.ts`, and 1 more
- Imported by: `tests/codekg.test.ts`

## src/codekg/visibility.ts

Source file `src/codekg/visibility.ts` defines `visibleGraph`.

- Defines: `visibleGraph`
- Imports: `src/codekg/cache.ts`, `src/codekg/types.ts`
- Imported by: `src/codekg/anchor.ts`, `src/codekg/query.ts`

## src/codekg/workspace.ts

Source file `src/codekg/workspace.ts` defines `Workspace`, `workspacePath`, `readWorkspace`, and 3 more.

- Used by `code-kg workspace add`: Manage explicit local multi-repository search roots
- Used by `code-kg workspace list`: Manage explicit local multi-repository search roots
- Used by `code-kg workspace remove`: Manage explicit local multi-repository search roots
- Used by `MCP codekg_workspace_ask`: Search explicitly registered repositories; scope with repository-name/path
- Defines: `Workspace`, `workspacePath`, `readWorkspace`, `workspaceCommand`, `askWorkspace`, `workspaceAskCommand`
- Tested by: `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`
- Imports: `src/codekg/cache.ts`, `src/codekg/errors.ts`, `src/codekg/query.ts`, `src/context.ts`
- Imported by: `src/codekg/mcp.ts`, `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`

## src/config.ts

Source file `src/config.ts` defines `getConfigDir`, `getConfigPath`, `LatConfig`, and 12 more.

- Used by `lat config`: Show configuration file path
- `jsonErrorLocation` (function): Where JSON.parse failed, without the input excerpt its message may quote.
- `getEnvLlmKey` (function): Returns the LLM key from (in priority order): 1.
- `saveLocalEmbeddingConfig` (function): Without `model`, keeps whichever local model the config already names.
- `embeddingConfigError` (function): Why the embedding configuration cannot be resolved, or null if it can.
- Also defines: `getConfigDir`, `getConfigPath`, `LatConfig`, `readConfig`, `writeConfig`, `isChatOnlyKey`, `getEmbeddingKey`, `getLlmKey`, `getLocalEmbeddingModelConfig`, `saveRemoteEmbeddingKey`, `hasEmbeddingConfig`
- Tested by: `tests/config-corrupt.test.ts`, `tests/search.test.ts`
- Imported by: `scripts/cook-test-rag.ts`, `src/cli/hook.ts`, `src/cli/init.ts`, `src/codekg/enrich.ts`, `src/codekg/query.ts`, `src/codekg/search.ts`, and 5 more

## src/context.ts

Source file `src/context.ts` defines `Styler`, `identity`, `plainStyler`, and 2 more.

- Defines: `Styler`, `identity`, `plainStyler`, `CmdContext`, `CmdResult`
- Tested by: `tests/agents-edge-cases.test.ts`, `tests/anchor.test.ts`, `tests/backlinks-safety.test.ts`, `tests/cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, and 8 more
- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/index.ts`, `src/cli/locate.ts`, and 44 more

## src/extensions/wiki-link/from-markdown.ts

mdast-util extension to turn wiki-link micromark tokens into mdast nodes.

- Defines: `enterWikiLink`, `exitWikiLinkTarget`, `exitWikiLinkAlias`, `exitWikiLink`, `wikiLinkFromMarkdown`
- Imports: `src/extensions/wiki-link/types.ts`

## src/extensions/wiki-link/index.ts

Source file `src/extensions/wiki-link/index.ts` defines no extracted symbols.

- Tested by: `tests/parser.test.ts`
- Imported by: `src/parser.ts`, `tests/parser.test.ts`

## src/extensions/wiki-link/syntax.ts

Micromark syntax extension for wiki links: target and target|alias.

- Defines: `ALIAS_DIVIDER`, `OPEN`, `CLOSE`, `tokenize`, `tokenize#start`, `tokenize#consumeOpen`, `tokenize#consumeDataStart`, `tokenize#consumeTarget`, `tokenize#consumeAliasMarker`, `tokenize#consumeAlias`, `tokenize#consumeClose`, `wikiLinkSyntax`
- Imports: `src/extensions/wiki-link/types.ts`

## src/extensions/wiki-link/to-markdown.ts

mdast-util extension to serialize wiki-link nodes back to markdown.

- Defines: `handler`, `wikiLinkToMarkdown`
- Imports: `src/extensions/wiki-link/types.ts`

## src/extensions/wiki-link/types.ts

Source file `src/extensions/wiki-link/types.ts` defines `WikiLink`, `RootContentMap`, `PhrasingContentMap`, and 2 more.

- `WikiLink` (interface): mdast node for a wiki-style link like target or target|alias.
- Also defines: `RootContentMap`, `PhrasingContentMap`, `TokenTypeMap`, `ConstructNameMap`
- Imported by: `src/extensions/wiki-link/from-markdown.ts`, `src/extensions/wiki-link/syntax.ts`, `src/extensions/wiki-link/to-markdown.ts`, `src/lattice.ts`

## src/format.ts

Source file `src/format.ts` defines `formatSectionId`, `formatSectionPreview`, `formatResultList`, and 1 more.

- Defines: `formatSectionId`, `formatSectionPreview`, `formatResultList`, `formatNavHints`
- Tested by: `tests/cases.test.ts`
- Imports: `src/context.ts`, `src/lattice.ts`
- Imported by: `src/cli/locate.ts`, `src/cli/refs.ts`, `src/cli/search.ts`, `src/cli/section.ts`, `src/codekg/search.ts`, `tests/cases.test.ts`

## src/init-version.ts

Source file `src/init-version.ts` defines `INIT_VERSION`, `InitMeta`, `cachePath`, and 5 more.

- `INIT_VERSION` (const): Bump this number whenever `lat init` setup changes in a way that requires users to re-run it (e.g.
- Also defines: `InitMeta`, `cachePath`, `readMeta`, `readInitVersion`, `readFileHash`, `contentHash`, `writeInitMeta`
- Tested by: `tests/init-version.test.ts`
- Imported by: `src/cli/check.ts`, `src/cli/init.ts`, `tests/init-version.test.ts`

## src/lattice.ts

Source file `src/lattice.ts` defines `Section`, `Ref`, `LatFrontmatter`, and 21 more.

- `tailSegments` (function): Returns the trailing segment(s) of a section id.
- `buildFileIndex` (function): Build an index mapping path suffixes to their full vault-relative paths.
- `resolveRef` (function): Resolve a potentially short reference to its canonical full-path form.
- `findRootHeadings` (function): Find root (h1) headings for a file by scanning sectionIds for entries that have exactly the pattern `file#heading` (no further # segments).
- `findSections#sortKey` (function): Sort results: shallower depth first, then fewer path segments
- Also defines: `Section`, `Ref`, `LatFrontmatter`, `parseFrontmatter`, `findLatticeDir`, `findProjectRoot`, `listLatticeFiles`, `headingText`, `inlineText`, `lastLine`, `parseSections`, `loadAllSections`, `flattenSections`, `levenshtein`, `ResolveResult`, `MAX_DISTANCE_RATIO`, `SectionMatch`, `findSections`, `extractRefs`
- Tested by: `tests/cases.test.ts`, `tests/lattice.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search-fallback.test.ts`
- Imports: `src/extensions/wiki-link/types.ts`, `src/parser.ts`, `src/walk.ts`
- Imported by: `src/cli/check.ts`, `src/cli/context.ts`, `src/cli/expand.ts`, `src/cli/hook.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, and 18 more

## src/mcp/server.ts

Source file `src/mcp/server.ts` defines `toMcp`, `startMcpServer`.

- Used by `lat mcp`: Start the MCP server (stdio transport)
- Registers 6 commands: `MCP lat_locate`, `MCP lat_section`, `MCP lat_search`, `MCP lat_expand`, `MCP lat_check`, `MCP lat_refs`
- Defines: `toMcp`, `startMcpServer`
- Imports: `src/cli/check.ts`, `src/cli/expand.ts`, `src/cli/locate.ts`, `src/cli/refs.ts`, `src/cli/search.ts`, `src/cli/section.ts`, and 2 more

## src/parser.ts

Source file `src/parser.ts` defines `processor`, `parse`, `toMarkdown`.

- Defines: `processor`, `parse`, `toMarkdown`
- Tested by: `tests/parser.test.ts`
- Imports: `src/extensions/wiki-link/index.ts`
- Imported by: `src/lattice.ts`, `tests/parser.test.ts`

## src/search/db.ts

Source file `src/search/db.ts` defines `openDb`, `MODEL_META_KEY`, `indexedModel`, and 2 more.

- `indexedModel` (function): The model the index was built with, as passed to ensureSchema.
- `ensureSchema` (function): Creates the vector tables, first dropping ones built with other dimensions or another `model`.
- Also defines: `openDb`, `MODEL_META_KEY`, `closeDb`
- Tested by: `tests/codekg.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`
- Imported by: `src/cli/search.ts`, `src/codekg/semantic.ts`, `tests/codekg.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`

## src/search/embeddings.ts

Source file `src/search/embeddings.ts` defines `MAX_REMOTE_BATCH`, `MAX_LOCAL_BATCH`, `BGE_QUERY_INSTRUCTION`, and 9 more.

- `BGE_QUERY_INSTRUCTION` (const): English bge v1.5 models were trained to embed search queries behind this instruction.
- `EmbedMode` (type): Queries and the passages they search can be embedded differently.
- Also defines: `MAX_REMOTE_BATCH`, `MAX_LOCAL_BATCH`, `FeatureExtractionPipeline`, `localPipelines`, `getLocalPipeline`, `isNumberArray`, `isNumberMatrix`, `normalizeLocalVectors`, `embedLocal`, `embed`
- Tested by: `tests/embeddings.test.ts`
- Imports: `src/search/provider.ts`
- Imported by: `src/search/index.ts`, `src/search/search.ts`, `tests/embeddings.test.ts`

## src/search/index.ts

Source file `src/search/index.ts` defines `hashContent`, `sectionContent`, `IndexStats`, and 1 more.

- Defines: `hashContent`, `sectionContent`, `IndexStats`, `indexSections`
- Tested by: `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`
- Imports: `src/lattice.ts`, `src/search/embeddings.ts`, `src/search/provider.ts`, `src/search/search.ts`
- Imported by: `src/cli/search.ts`, `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`

## src/search/provider.ts

Source file `src/search/provider.ts` defines `RemoteEmbeddingProvider`, `LocalEmbeddingProvider`, `EmbeddingProvider`, and 9 more.

- `LOCAL_EMBEDDING_MODELS` (const): Local models `semantic enable-local --model` knows by name.
- `resolveLocalEmbeddingModel` (function): The model id and dimensions for a known model name or id, or for any other id together with its dimensions.
- `providerModelId` (function): Identifies the vectors a provider makes; see ensureSchema.
- Also defines: `RemoteEmbeddingProvider`, `LocalEmbeddingProvider`, `EmbeddingProvider`, `DEFAULT_LOCAL_EMBEDDING_MODEL`, `DEFAULT_LOCAL_EMBEDDING_DIMENSIONS`, `openai`, `vercel`, `localProvider`, `detectProvider`
- Tested by: `tests/embeddings.test.ts`, `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`
- Imports: `src/config.ts`
- Imported by: `src/cli/init.ts`, `src/cli/search.ts`, `src/codekg/semantic.ts`, `src/search/embeddings.ts`, `src/search/index.ts`, `src/search/search.ts`, and 5 more

## src/search/search.ts

Source file `src/search/search.ts` defines `SearchResult`, `OFF_TOPIC_PROBES`, `NOISE_FLOOR_META_KEY`, and 3 more.

- `OFF_TOPIC_PROBES` (const): Questions no codebase answers; see noiseFloor.
- `noiseFloor` (function): The highest similarity an off-topic probe question reaches in this index.
- Also defines: `SearchResult`, `NOISE_FLOOR_META_KEY`, `nearest`, `searchSections`
- Tested by: `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`
- Imports: `src/search/embeddings.ts`, `src/search/provider.ts`
- Imported by: `src/cli/search.ts`, `src/search/index.ts`, `tests/retrieval-eval.test.ts`, `tests/search.test.ts`, `tests/semantic-score.test.ts`

## src/source-parser.ts

Source file `src/source-parser.ts` defines `SourceSymbol`, `parserReady`, `parserInstance`, and 27 more.

- `parserReady` (const): Lazy singleton for the parser
- `grammarMap` (const): Extension → tree-sitter WASM grammar mapping.
- `SOURCE_EXTENSIONS` (const): All source file extensions that lat can parse (derived from grammarMap).
- `goReceiverType` (function): Extract the receiver type name from a Go method declaration's receiver node.
- `cFuncName` (function): Extract the declarator name from a C function_declarator node.
- `cVarName` (function): Extract the variable name from a C init_declarator or plain declarator.
- `collectCNodes` (function): Walk C AST nodes, collecting symbols.
- `collectCStructFields` (function): Extract struct field/member names from a struct_specifier and emit them as symbols with `parent` set to the struct name.
- `cFieldName` (function): Extract the field name from a C struct field declarator.
- `symbolCache` (const): Per-invocation cache for parsed source symbols, keyed by absolute file path.
- `clearSymbolCache` (function): Clear the symbol cache.
- `resolveSourceSymbol` (function): Check whether a source file path (relative to projectRoot) has a given symbol.
- `sourceSymbolsToSections` (function): Convert source symbols to Section objects for uniform handling.
- Also defines: `SourceSymbol`, `parserInstance`, `languages`, `wasmDir`, `ensureParser`, `getLanguage`, `extractName`, `extractTsSymbols`, `extractClassMethods`, `extractPySymbols`, `extractRustSymbols`, `extractGoSymbols`, `extractCSymbols`, `collectCEnumMembers`, `collectFieldsFromList`, `firstLine`, `parseSourceSymbols`
- Imports: `src/lattice.ts`
- Imported by: `src/cli/check.ts`, `src/cli/hook.ts`, `src/cli/section.ts`, `src/codekg/graph.ts`, `src/codekg/structural.ts`

## src/types/folder-xdg.d.ts

Source file `src/types/folder-xdg.d.ts` defines `XdgDirs`.

- Defines: `XdgDirs`

## src/version.ts

Source file `src/version.ts` defines `getLocalVersion`, `fetchLatestVersion`.

- `getLocalVersion` (function): Walk up from this file to find the nearest package.json version.
- `fetchLatestVersion` (function): Fetch the latest published version of `lat.md` from the npm registry.
- Imported by: `src/cli/init.ts`

## src/walk.ts

Source file `src/walk.ts` defines `walkEntries`, `isRegularFile`.

- `walkEntries` (function): Walk a directory tree respecting .gitignore rules.
- Also defines: `isRegularFile`
- Tested by: `tests/walk-symlinks.test.ts`
- Imported by: `src/cli/check.ts`, `src/code-refs.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/discovery.ts`, `src/lattice.ts`, and 1 more

## templates/opencode-plugin.ts

Source file `templates/opencode-plugin.ts` defines `LAT`, `run`, `tryRun`, and 2 more.

- `LAT` (const): Absolute path to the lat binary, injected by `lat init`.
- Also defines: `run`, `tryRun`, `LatPlugin`, `LatPlugin#execute`

## templates/pi-extension.ts

Source file `templates/pi-extension.ts` defines `PREVIEW_LINES`, `collapsibleResult`, `LAT`, and 4 more.

- `LAT` (const): Absolute path to the lat binary, injected by `lat init`.
- Also defines: `PREVIEW_LINES`, `collapsibleResult`, `run`, `tryRun`, `execute`, `renderCall`

## tests/agents-edge-cases.test.ts

Test file `tests/agents-edge-cases.test.ts` checks `src/codekg/agents.ts`, `src/context.ts`.

- Test: agents install/uninstall edge cases › removes .codex/hooks.json when only Code-KG hooks were in it
- Test: agents install/uninstall edge cases › keeps other top-level hook settings on uninstall
- Test: agents install/uninstall edge cases › warns when hooks fall back to a machine-specific command
- Checks: `src/codekg/agents.ts`, `src/context.ts`
- Imports: `src/codekg/agents.ts`, `src/context.ts`

## tests/anchor.test.ts

Test file `tests/anchor.test.ts` checks `src/codekg/anchor.ts`, `src/codekg/anchors.ts`, and 9 more.

- Test: code-kg anchor › anchors a hand-written section and follows the symbol when the source moves
- Test: code-kg anchor › keeps section anchors through code-kg update
- Test: code-kg anchor › refuses sections of generated files
- Test: code-kg anchor › lets an entry whose heading was renamed be listed and removed by its key
- Test: code-kg anchor › anchors a curated file entry and keeps it when the anchor is removed
- Test: code-kg anchor › stays edit-safe through its anchors when review-source drops stale spans
- Test: code-kg anchor › reports an anchor whose symbol is gone until it is removed
- Test: code-kg anchor › rejects malformed anchors and anchors on a coverage-only section
- Test: code-kg anchor › asks for the file when a symbol name is ambiguous
- Test: code-kg anchor › anchors a file and inserts its backlink at the top
- Test: code-kg anchor › writes one backlink per file for a section anchored to two symbols in it
- Test: code-kg anchor › asks for review only when the anchored symbol changes, and review-source records it
- Test: code-kg anchor › keeps anchor baselines current when backlinks are written into anchored code
- Test: code-kg anchor › skips a backlink that would land inside a literal or cannot be checked
- Test: code-kg anchor › lists anchored sections in code-kg context for the file
- Test: code-kg anchor › is available through MCP
- Test: manifestOwner › prefers a section's own entry over its file's entry
- Checks: `src/codekg/anchor.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/context.ts`, and 5 more
- Imports: `src/codekg/anchor.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/context.ts`, and 5 more

## tests/backlinks-safety.test.ts

Test file `tests/backlinks-safety.test.ts` checks `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, and 6 more.

- Test: apply-backlinks --write safety › preserves CRLF line endings and every other byte
- Test: apply-backlinks --write safety › skips files that changed since the section recorded its spans
- Test: apply-backlinks --write safety › refuses paths outside the project root
- Test: apply-backlinks --write safety › inserts one backlink per file, indented like the target line
- Test: apply-backlinks --write safety › keeps the drift baseline in sync with its own insertion
- Test: apply-backlinks --write safety › moves the spans of sections it skipped so a later run stays aligned
- Test: apply-backlinks --write safety › does not trust stale spans after review-source --write refreshes hashes
- Test: apply-backlinks --write safety › drops only the stale spans when review-source --write refreshes hashes
- Test: apply-backlinks --write safety › keeps an edit-safe section whose spans still match after review-source
- Test: apply-backlinks --write safety › keeps a shebang and an encoding declaration on the first lines
- Test: insertCommentLine › appends past the end of a file without a trailing newline
- Test: insertCommentLine › inserts before the first line
- Checks: `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/drift.ts`, `src/codekg/review-source.ts`, `src/codekg/structural.ts`, and 2 more
- Imports: `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/drift.ts`, `src/codekg/review-source.ts`, `src/codekg/structural.ts`, and 2 more

## tests/cards.test.ts

Test file `tests/cards.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/cards.ts`, and 1 more.

- Test: file cards › describe each file from its comments, commands, tests and imports
- Test: file cards › scopes cards in ask by the file they describe
- Test: testDeclarations › finds tests in several languages with their suites
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/cards.ts`, `src/codekg/query.ts`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/cards.ts`, `src/codekg/query.ts`

## tests/cases.test.ts

Test file `tests/cases.test.ts` checks `src/cli/check.ts`, `src/cli/index.ts`, and 6 more.

- Test: basic-project › parses section tree from nested headings
- Test: basic-project › populates startLine, endLine, and firstParagraph
- Test: basic-project › renders inline code in firstParagraph
- Test: basic-project › renders wiki links in firstParagraph
- Test: basic-project › extracts wiki link references
- Test: basic-project › returns no refs for files without wiki links
- Test: basic-project › formats section preview with firstParagraph
- Test: basic-project › formats section preview without firstParagraph
- Test: basic-project › locate finds sections by exact id
- Test: basic-project › locate matches subsection by trailing segment name
- Test: basic-project › locate fuzzy matches with typos
- Test: basic-project › locate returns empty for non-matching query
- Test: basic-project › locate reports match reasons
- Test: basic-project › locate matches with skipped intermediate sections
- Test: basic-project › locate strips brackets from query
- Test: basic-project › locate strips leading hash from query
- Test: basic-project › refs finds sections referencing a target
- Test: basic-project › check md passes with valid links
- Test: expand › resolves exact ref with "is referring to" context
- Test: expand › resolves fuzzy ref with "might be referring to" context
- and 79 more tests
- Checks: `src/cli/check.ts`, `src/cli/index.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/code-refs.ts`, `src/context.ts`, and 2 more
- Imports: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/code-refs.ts`, `src/context.ts`, `src/format.ts`, and 1 more

## tests/cases/source-ref-c-valid/src/app.h

Source file `tests/cases/source-ref-c-valid/src/app.h` defines `APP_H`, `Greeter`, `Greeter#prefix`, and 34 more.

- `AppCtx` (type): pointer typedef — declarator is pointer_declarator wrapping type_identifier
- Also defines: `APP_H`, `Greeter`, `Greeter#prefix`, `Greeter#count`, `BLUE`, `Color`, `Color#BLUE`, `Color#GREEN`, `Color#RED`, `GREEN`, `RED`, `JSObject`, `JSObject#class_id`, `JSObject#extensible`, `JSObject#is_exotic`, `JSObject#flags`, `ErrorCode`, `JS_TAG_INT`, `JS_TAG_BOOL`, `JSGCObjectTypeEnum`, `JS_GC_OBJ_TYPE_JS_OBJECT`, `JSGCObjectTypeEnum#JS_GC_OBJ_TYPE_JS_OBJECT`, `JS_GC_OBJ_TYPE_FUNCTION_BYTECODE`, `JSGCObjectTypeEnum#JS_GC_OBJ_TYPE_FUNCTION_BYTECODE`, `JSPromiseStateEnum`, `JS_PROMISE_PENDING`, `JSPromiseStateEnum#JS_PROMISE_PENDING`, `JS_PROMISE_FULFILLED`, `JSPromiseStateEnum#JS_PROMISE_FULFILLED`, `JS_PROMISE_REJECTED`, and 6 more
- Imported by: `tests/cases/source-ref-c-valid/src/app.c`

## tests/code-refs-no-match.test.ts

Test file `tests/code-refs-no-match.test.ts` checks `src/code-refs.ts`.

- Checks: `src/code-refs.ts`
- Imports: `src/code-refs.ts`

## tests/codekg-intelligence.test.ts

Test file `tests/codekg-intelligence.test.ts` checks `src/codekg/agent-context.ts`, `src/codekg/agents.ts`, and 13 more.

- Test: fresh structural intelligence › resolves ESM .js imports to TypeScript and traces calls both ways
- Test: fresh structural intelligence › reuses unchanged parsing, invalidates edits and deletions, and preserves symbol identity
- Test: fresh structural intelligence › keeps extraction previews disk read-only and coalesces concurrent refreshes
- Test: fresh structural intelligence › detects body-only drift without rewriting reviewed prose or accepting it
- Test: agent retrieval › rejects source symlinks escaping the repository
- Test: agent retrieval › combines knowledge with live source and respects bounds and scopes
- Test: agent retrieval › respects rejected edges and suppressed file descendants in navigation
- Test: agent retrieval › provides file APIs and bounded symbol-attributed literal and regex search
- Test: agent retrieval › never serves a stale inferred description after a same-symbol edit
- Test: agent retrieval › discards a summary when source changes during model generation and limits failed requests
- Test: agent retrieval › retains detailed descriptions past 1800 characters and exposes a separate brief preview
- Test: agent retrieval › does not treat legacy possibly clipped descriptions as current
- Test: agent retrieval › sends the configured generation budget and invalidates descriptions when it changes
- Test: agent retrieval › does not send a stored remote-provider credential to a custom local model
- Test: agent retrieval › supports fresh retrieval through MCP without changing legacy tools
- Test: agent lifecycle context › federates only registered repositories and scopes them by name
- Test: agent lifecycle context › stays silent outside mapped projects and on invalid input
- Test: agent lifecycle context › deduplicates session context and refreshes after edits without touching knowledge
- Test: agent lifecycle context › installs and removes managed lifecycle hooks without deleting foreign hooks
- Checks: `src/codekg/agent-context.ts`, `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cache.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, and 9 more
- Imports: `src/codekg/agent-context.ts`, `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cache.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, and 9 more

## tests/codekg-messages.test.ts

Test file `tests/codekg-messages.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, and 3 more.

- Test: Code-KG user-facing messages › check suggests code-kg commands rather than lat init
- Test: Code-KG user-facing messages › section output names Code-KG commands and MCP tools
- Test: Code-KG user-facing messages › suggests code-kg bootstrap when lat.md/ is missing
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/cli.ts`, `src/codekg/mcp.ts`, `src/context.ts`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/mcp.ts`, `src/context.ts`

## tests/codekg.test.ts

Test file `tests/codekg.test.ts` checks `src/codekg/agents.ts`, `src/codekg/anchors.ts`, and 23 more.

- Test: code-kg bootstrap › previews the skeleton knowledge base without writing files
- Test: code-kg bootstrap › detects Python project signals, entrypoints, and pytest-style tests
- Test: code-kg bootstrap › writes a lat.md knowledge base and committed manifest that pass checks
- Test: code-kg bootstrap › generates source-grounded file sections that improve bootstrap search
- Test: code-kg bootstrap › materializes existing @lat test spec refs so bootstrap output passes checks
- Test: code-kg bootstrap › does not materialize @lat refs from ignored build output
- Test: code-kg bootstrap › does not materialize @lat refs embedded inside string literals
- Test: code-kg bootstrap › requires a manifest when generated section markers exist
- Test: code-kg bootstrap › rejects edit-safe manifest sections without precise source spans
- Test: code-kg bootstrap › treats explicit edit-safe source spans as backlink anchors
- Test: code-kg bootstrap › previews backlinks for edit-safe source spans without mutating source
- Test: code-kg bootstrap › writes backlinks for edit-safe source spans
- Test: code-kg bootstrap › does not duplicate existing backlinks
- Test: code-kg bootstrap › skips unsupported source files when applying backlinks
- Test: code-kg bootstrap › provides local lexical search without an embedding provider
- Test: code-kg bootstrap › matches words below the leading paragraph and ignores question words
- Test: code-kg bootstrap › uses local lexical search as the default Code-KG search backend
- Test: code-kg bootstrap › falls back to local lexical search for auto-semantic when no embedding provider is configured
- Test: code-kg bootstrap › selects semantic search for auto-semantic when local embeddings are configured
- Test: code-kg bootstrap › routes explicit semantic Code-KG search through the embedding-backed backend
- and 68 more tests
- Checks: `src/codekg/agents.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/changed.ts`, `src/codekg/check.ts`, and 19 more
- Imports: `src/codekg/agents.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/changed.ts`, `src/codekg/check.ts`, and 18 more

## tests/config-corrupt.test.ts

Test file `tests/config-corrupt.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, and 5 more.

- Test: a corrupt lat config file › throws a descriptive error instead of exiting the process
- Test: a corrupt lat config file › leaves auto-semantic search working on the lexical backend
- Test: a corrupt lat config file › names the unreadable config in the check warning
- Test: a corrupt lat config file › reports the problem from semantic and enrich commands
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/enrich.ts`, `src/codekg/search.ts`, `src/codekg/semantic.ts`, `src/config.ts`, and 1 more
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/enrich.ts`, `src/codekg/search.ts`, `src/codekg/semantic.ts`, `src/config.ts`, and 1 more

## tests/curated-files.test.ts

Test file `tests/curated-files.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, and 2 more.

- Test: hand-written knowledge files › are listed in the generated root index and left untouched
- Test: hand-written knowledge files › leave ignored files and directories without an index out of the root index
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/types.ts`, `src/context.ts`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/types.ts`, `src/context.ts`

## tests/embeddings.test.ts

Test file `tests/embeddings.test.ts` checks `src/search/embeddings.ts`, `src/search/provider.ts`.

- Test: local embeddings › prefix English bge queries with the retrieval instruction, and nothing else
- Checks: `src/search/embeddings.ts`, `src/search/provider.ts`
- Imports: `src/search/embeddings.ts`, `src/search/provider.ts`

## tests/enrich.test.ts

Test file `tests/enrich.test.ts` checks `src/cli/check.ts`, `src/codekg/cache.ts`, and 3 more.

- Test: brief knowledge previews › preserves detailed subsequent paragraphs when replacing a valid brief preview
- Test: brief knowledge previews › reports a partial failure even when another preview succeeded
- Checks: `src/cli/check.ts`, `src/codekg/cache.ts`, `src/codekg/enrich.ts`, `src/codekg/structural.ts`, `src/context.ts`
- Imports: `src/cli/check.ts`, `src/codekg/cache.ts`, `src/codekg/enrich.ts`, `src/codekg/structural.ts`, `src/context.ts`

## tests/gaps-inferred.test.ts

Test file `tests/gaps-inferred.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/context.ts`, and 3 more.

- Test: test coverage from path mentions › infers tests edges only from evidence that a module is loaded
- Test: test coverage from path mentions › lists inferred-only coverage separately in gaps
- Test: test coverage from path mentions › labels inferred tests in context and the file cards
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/context.ts`, `src/codekg/gaps.ts`, `src/codekg/graph.ts`, `src/context.ts`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/context.ts`, `src/codekg/gaps.ts`, `src/codekg/graph.ts`, `src/context.ts`

## tests/git-hooks.test.ts

Test file `tests/git-hooks.test.ts` checks `src/codekg/cli.ts`, `src/codekg/git-hooks.ts`.

- Test: git-hooks › installs an executable, Code-KG-managed pre-commit hook
- Test: git-hooks › updates in place when a Code-KG hook is already present
- Test: git-hooks › refuses to clobber a foreign pre-commit hook unless forced
- Test: git-hooks › uninstall removes only a managed hook
- Test: git-hooks › is a no-op (with a clear message) outside a git repository
- Test: installed pre-commit hook › stages the refreshed knowledge base and skips LLM enrichment
- Test: installed pre-commit hook › does not sweep unstaged knowledge-base edits into the commit
- Test: installed pre-commit hook › does not replace a staged manifest edit with the regenerated one
- Test: installed pre-commit hook › stays quiet when the staged knowledge base is already current
- Test: installed pre-commit hook › explains that an unstaged manual update stays unstaged
- Checks: `src/codekg/cli.ts`, `src/codekg/git-hooks.ts`
- Imports: `src/codekg/git-hooks.ts`

## tests/hook-stdin.test.ts

Test file `tests/hook-stdin.test.ts` checks `src/codekg/cli.ts`, `src/codekg/stdin.ts`.

- Test: readHookInput › returns a complete JSON payload without waiting for end of input
- Test: readHookInput › gives up after the idle timeout when the pipe stays open
- Test: readHookInput › returns undefined for an open pipe that never sends data
- Test: readHookInput › returns what arrived when the input ends
- Test: readHookInput › waits longer for the first byte than between chunks
- Test: readHookInput › waits for the closing brace even when a string holds one
- Test: readHookInput › decodes a multibyte character split across chunks
- Test: hook commands with a host that keeps stdin open › hook-check exits after reading a complete payload
- Test: hook commands with a host that keeps stdin open › agent-context exits when no payload ever arrives
- Test: hook commands with a host that keeps stdin open › says on stderr when the payload is truncated JSON
- Checks: `src/codekg/cli.ts`, `src/codekg/stdin.ts`
- Imports: `src/codekg/stdin.ts`

## tests/hook.test.ts

Test file `tests/hook.test.ts` checks `src/cli/index.ts`.

- Test: hook stop › exits silently when check passes and no diff
- Test: hook stop › blocks when lat check fails
- Test: hook stop › blocks when code diff is large but lat.md/ not updated
- Test: hook stop › exits silently when lat.md/ changes are proportional
- Test: hook stop › exits silently when code diff is below threshold
- Test: hook stop › blocks with both messages when check fails and diff needs sync
- Test: hook stop › exits silently on second pass when check passes
- Test: hook stop › prints stderr warning on second pass when check still fails
- Test: hook stop › ignores non-code files in diff
- Test: hook stop › returns a Cursor follow-up message when stop needs more work
- Checks: `src/cli/index.ts`

## tests/init-version.test.ts

Test file `tests/init-version.test.ts` checks `src/init-version.ts`.

- Test: init-version › readInitVersion returns null when no cache exists
- Test: init-version › writeInitMeta creates cache dir and writes version
- Test: init-version › stores and retrieves file hashes
- Test: init-version › merges hashes across multiple writes
- Test: init-version › overwrites existing hash for same path
- Test: init-version › contentHash returns consistent SHA-256
- Test: init-version › readInitVersion handles corrupt JSON gracefully
- Checks: `src/init-version.ts`
- Imports: `src/init-version.ts`

## tests/input-errors.test.ts

Test file `tests/input-errors.test.ts` checks `src/code-refs.ts`, `src/codekg/cli.ts`, and 4 more.

- Test: invalid query input › raises InputError for empty patterns and queries and escaping scopes
- Test: invalid query input › says ripgrep is required only when it is missing
- Test: invalid query input › treats rg exit 1 with stderr output as a failure, not as no matches
- Test: invalid query input › reports a malformed workspace file as invalid input
- Test: invalid query input › prints the message without a stack trace from the CLI
- Checks: `src/code-refs.ts`, `src/codekg/cli.ts`, `src/codekg/errors.ts`, `src/codekg/query.ts`, `src/codekg/workspace.ts`, `src/context.ts`
- Imports: `src/code-refs.ts`, `src/codekg/errors.ts`, `src/codekg/query.ts`, `src/codekg/workspace.ts`, `src/context.ts`

## tests/lattice.test.ts

Test file `tests/lattice.test.ts` checks `src/lattice.ts`.

- Test: findLatticeDir › finds .lat in the given directory
- Test: findLatticeDir › returns null when no .lat exists
- Test: listLatticeFiles › lists .md files sorted alphabetically
- Test: parseSections › handles multiple top-level headings
- Test: parseSections › uses file stem without .md extension
- Checks: `src/lattice.ts`
- Imports: `src/lattice.ts`

## tests/limits.test.ts

Test file `tests/limits.test.ts` checks `src/codekg/limits.ts`.

- Test: description previews › finishes promptly for a long unbroken opening token
- Checks: `src/codekg/limits.ts`

## tests/mcp.test.ts

Test file `tests/mcp.test.ts` checks `src/cli/index.ts`, `tests/rag-replay-server.ts`.

- Test: mcp › lists all tools
- Test: mcp › lat_locate finds a section
- Test: mcp › lat_locate returns message for missing section
- Test: mcp › lat_expand expands refs
- Test: mcp › lat_expand passes through text without refs
- Test: mcp › lat_section shows section content with refs
- Test: mcp › lat_section returns message for missing section
- Test: mcp › lat_check reports errors
- Test: mcp search (rag) › lat_search finds auth section
- Test: mcp search (rag) › lat_search finds performance section
- Test: mcp search (rag) › lat_search returns no results message when key is missing
- Checks: `src/cli/index.ts`, `tests/rag-replay-server.ts`
- Imports: `tests/rag-replay-server.ts`

## tests/parser.test.ts

Test file `tests/parser.test.ts` checks `src/cli/index.ts`, `src/extensions/wiki-link/index.ts`, and 1 more.

- Test: typecheck › passes tsc --noEmit on the entire codebase
- Test: prettier › ensures all source files are formatted
- Test: lat check › passes all checks (wiki links + code refs)
- Test: parse › parses a simple paragraph
- Test: parse › parses headings
- Test: parse › parses a wiki link
- Test: parse › parses a wiki link with alias
- Test: parse › parses a wiki link with section path
- Test: parse › parses multiple wiki links in one paragraph
- Test: parse › does not parse incomplete wiki links
- Test: toMarkdown › round-trips a wiki link
- Test: toMarkdown › round-trips a wiki link with alias
- Test: toMarkdown › round-trips a document with headings and wiki links
- Test: round-trips a comprehensive markdown file with all features
- Checks: `src/cli/index.ts`, `src/extensions/wiki-link/index.ts`, `src/parser.ts`
- Imports: `src/extensions/wiki-link/index.ts`, `src/parser.ts`

## tests/rag-replay-server.ts

Embedding replay server with two modes:

- Defines: `Manifest`, `textHash`, `ReplayServerResult`, `readVector`, `createReplayHandler`, `createCaptureHandler`, `createCaptureHandler#handler`, `createCaptureHandler#flush`, `startReplayServer`, `startReplayServer#flush`, `hasReplayData`
- Tested by: `tests/mcp.test.ts`, `tests/search.test.ts`
- Imports: `src/search/provider.ts`
- Imported by: `tests/mcp.test.ts`, `tests/search.test.ts`

## tests/retrieval-eval.test.ts

Test file `tests/retrieval-eval.test.ts` checks `src/codekg/query.ts`, `src/codekg/search.ts`, and 6 more.

- Test: retrieval eval (lexical) › names curated sections that exist, and an existing answer for every question
- Test: retrieval eval (lexical) › stays at or above the recorded floor
- Test: retrieval eval (lexical) › stays at or above the recorded floor on held-out questions
- Test: retrieval eval (lexical) › stays at or above the recorded floor on identifiers
- Test: retrieval eval (lexical) › keeps ask without semantic search at or above the held-out floor
- Test: retrieval eval (lexical) › keeps ask without semantic search at or above the identifier floor
- Test: stays at or above the recorded floor
- Test: stays at or above the recorded floor on held-out questions
- Checks: `src/codekg/query.ts`, `src/codekg/search.ts`, `src/codekg/types.ts`, `src/lattice.ts`, `src/search/db.ts`, `src/search/index.ts`, and 2 more
- Imports: `src/codekg/query.ts`, `src/codekg/search.ts`, `src/codekg/types.ts`, `src/lattice.ts`, `src/search/db.ts`, `src/search/index.ts`, and 2 more

## tests/search-fallback.test.ts

Test file `tests/search-fallback.test.ts` checks `src/codekg/bootstrap.ts`, `src/codekg/query.ts`, and 3 more.

- Test: auto-semantic search › falls back to lexical results when semantic search throws
- Test: identifier queries › are code names and paths, not prose
- Test: identifier queries › use lexical results in auto-semantic search
- Test: identifier queries › skip the semantic bonus in ask, which other queries still get
- Test: explicit semantic search › returns an error result instead of throwing
- Test: explicit semantic search › points to Code-KG commands when no provider is configured
- Test: explicit semantic search › suggests Code-KG navigation commands with semantic results
- Checks: `src/codekg/bootstrap.ts`, `src/codekg/query.ts`, `src/codekg/search.ts`, `src/context.ts`, `src/lattice.ts`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/query.ts`, `src/codekg/search.ts`, `src/context.ts`, `src/lattice.ts`

## tests/search.test.ts

Test file `tests/search.test.ts` checks `src/config.ts`, `src/search/db.ts`, and 4 more.

- Test: detectProvider › detects OpenAI key
- Test: detectProvider › detects local embedding provider
- Test: detectProvider › rejects invalid local embedding dimensions
- Test: detectProvider › uses persisted local model settings
- Test: detectProvider › detects Vercel key
- Test: detectProvider › rejects Anthropic key with helpful message
- Test: detectProvider › rejects unknown key
- Test: ensureSchema › rebuilds vector tables when embedding dimensions change
- Test: ensureSchema › rebuilds vector tables when the model changes, and adopts an index that predates model tracking
- Test: embedding config › keeps persisted local embeddings independent of chat key helpers
- Test: embedding config › uses persisted local embedding provider when no env key is set
- Test: embedding config › does not fall back to persisted local provider when remote env provider is explicit
- Test: search (rag) › indexes all sections
- Test: search (rag) › finds auth section for login query
- Test: search (rag) › finds performance section for latency query
- Test: search (rag) › incremental index skips unchanged sections
- Test: search (rag) › detects deleted sections when file is removed
- Test: finds auth documentation for login/security query
- Test: finds performance documentation for latency query
- Checks: `src/config.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`, `tests/rag-replay-server.ts`
- Imports: `src/config.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`, `tests/rag-replay-server.ts`

## tests/semantic-score.test.ts

Test file `tests/semantic-score.test.ts` checks `src/codekg/query.ts`, `src/search/db.ts`, and 3 more.

- Test: semantic scores › returns cosine similarity and caches the noise floor until the sections change
- Test: semanticBonus › gives the closest match 1 and falls linearly to 0 at the noise floor
- Test: semanticBonus › gives nothing when no match is closer than the noise floor
- Checks: `src/codekg/query.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`
- Imports: `src/codekg/query.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`

## tests/source-scan.test.ts

Test file `tests/source-scan.test.ts` checks `src/codekg/source-scan.ts`.

- Test: scanSource › blanks line and block comments but not slashes inside strings
- Test: scanSource › skips regex literals so their quotes do not open strings
- Test: scanSource › handles hash comments and triple quotes in scripts
- Test: scanSource › keeps UTF-16 offsets aligned past astral characters
- Test: scanSource › finds the closing paren across lines, strings and comments
- Checks: `src/codekg/source-scan.ts`
- Imports: `src/codekg/source-scan.ts`

## tests/trace-depth.test.ts

Test file `tests/trace-depth.test.ts` checks `src/codekg/mcp.ts`, `src/codekg/query.ts`, and 1 more.

- Test: trace depth › reports when results exist beyond the default MCP depth
- Test: trace depth › gives the CLI flag in the hint and no hint when nothing is cut off
- Checks: `src/codekg/mcp.ts`, `src/codekg/query.ts`, `src/context.ts`
- Imports: `src/codekg/mcp.ts`, `src/codekg/query.ts`, `src/context.ts`

## tests/walk-symlinks.test.ts

Test file `tests/walk-symlinks.test.ts` checks `src/code-refs.ts`, `src/walk.ts`.

- Test: walkEntries › reports only regular files; symlinked directories and dangling links are dropped
- Test: walkEntries › lets the fallback code-ref scanner read every walked entry
- Checks: `src/code-refs.ts`, `src/walk.ts`
- Imports: `src/code-refs.ts`, `src/walk.ts`
