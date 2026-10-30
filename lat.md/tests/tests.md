# Tests
<!-- code-kg:id tests.tests -->

This section records the test layout discovered during bootstrap and indexes generated test specifications.

## Test Paths

These paths looked test-related during local discovery.

- tests/agents-edge-cases.test.ts
- tests/backlinks-safety.test.ts
- tests/cases.test.ts
- tests/code-refs-no-match.test.ts
- tests/codekg-intelligence.test.ts
- tests/codekg-messages.test.ts
- tests/codekg.test.ts
- tests/config-corrupt.test.ts
- tests/enrich.test.ts
- tests/gaps-inferred.test.ts
- tests/git-hooks.test.ts
- tests/hook-stdin.test.ts
- tests/hook.test.ts
- tests/init-version.test.ts
- tests/input-errors.test.ts
- tests/lattice.test.ts
- tests/limits.test.ts
- tests/mcp.test.ts
- tests/parser.test.ts
- tests/search-fallback.test.ts

## Source Test Highlights

These generated highlights come from deterministic file, symbol, and import extraction so agents can search source-shaped concepts before opening raw files.

### tests/agents-edge-cases.test.ts

Test file `tests/agents-edge-cases.test.ts` contains tests and validation symbols. Key symbols: `roots`, `project`.

- Symbols: `roots (const)`, `project (function)`
- Imports: `src/codekg/agents.ts`, `src/context.ts`
- Imported by: none detected

### tests/backlinks-safety.test.ts

Test file `tests/backlinks-safety.test.ts` contains tests and validation symbols. Key symbols: `roots`, `BACKLINK`, and 5 more.

- Symbols: `roots (const)`, `BACKLINK (const)`, `ctx (function)`, `project (function)`, `manifestPath (const)`, `readManifest (function)`, `markEditSafe (function)`
- Imports: `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/drift.ts`, `src/codekg/review-source.ts`, `src/codekg/structural.ts`, and 2 more
- Imported by: none detected

### tests/cases.test.ts

Test file `tests/cases.test.ts` contains tests and validation symbols. Key symbols: `stripAnsi`, `casesDir`, and 9 more.

- Symbols: `stripAnsi (const)`, `casesDir (const)`, `caseDir (function)`, `latDir (function)`, `testCtx (function)`, `runExpand (function)`, `ref (function)`, `ref~2 (function)`, and 3 more
- Imports: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/code-refs.ts`, `src/context.ts`, `src/format.ts`, and 1 more
- Imported by: none detected

### tests/code-refs-no-match.test.ts

Test file `tests/code-refs-no-match.test.ts` contains tests and validation symbols. Key symbols: `roots`, `ripgrepInstalled`, and 1 more.

- Symbols: `roots (const)`, `ripgrepInstalled (const)`, `fixture (function)`
- Imports: `src/code-refs.ts`
- Imported by: none detected

### tests/codekg-intelligence.test.ts

Test file `tests/codekg-intelligence.test.ts` contains tests and validation symbols. Key symbols: `roots`, `ctx`, and 2 more.

- Symbols: `roots (const)`, `ctx (function)`, `fixture (function)`, `manifestPath (const)`
- Imports: `src/codekg/agent-context.ts`, `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cache.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, and 9 more
- Imported by: none detected

### tests/codekg-messages.test.ts

Test file `tests/codekg-messages.test.ts` contains tests and validation symbols. Key symbols: `roots`, `cliPath`, and 1 more.

- Symbols: `roots (const)`, `cliPath (const)`, `tempDir (function)`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/mcp.ts`, `src/context.ts`
- Imported by: none detected

### tests/codekg.test.ts

Test file `tests/codekg.test.ts` contains tests and validation symbols. Key symbols: `roots`, `execFile`, and 10 more.

- Symbols: `roots (const)`, `execFile (const)`, `makeProject (function)`, `ctx (function)`, `readManifest (function)`, `writeManifest (function)`, `addInferredRelationship (function)`, `addImportRelationship (function)`, and 4 more
- Imports: `src/codekg/agents.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/changed.ts`, `src/codekg/check.ts`, and 16 more
- Imported by: none detected

### tests/config-corrupt.test.ts

Test file `tests/config-corrupt.test.ts` contains tests and validation symbols. Key symbols: `roots`, `CORRUPT`, and 1 more.

- Symbols: `roots (const)`, `CORRUPT (const)`, `project (function)`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/check.ts`, `src/codekg/enrich.ts`, `src/codekg/search.ts`, `src/codekg/semantic.ts`, `src/config.ts`, and 1 more
- Imported by: none detected

### tests/enrich.test.ts

Test file `tests/enrich.test.ts` contains tests and validation symbols. Key symbols: `roots`, `original`, and 2 more.

- Symbols: `roots (const)`, `original (const)`, `fixture (function)`, `completion (function)`
- Imports: `src/cli/check.ts`, `src/codekg/cache.ts`, `src/codekg/enrich.ts`, `src/codekg/structural.ts`, `src/context.ts`
- Imported by: none detected

### tests/gaps-inferred.test.ts

Test file `tests/gaps-inferred.test.ts` contains tests and validation symbols. Key symbols: `roots`, `SOURCES`, and 3 more.

- Symbols: `roots (const)`, `SOURCES (const)`, `TESTS (const)`, `project (function)`, `section (function)`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/context.ts`, `src/codekg/gaps.ts`, `src/codekg/graph.ts`, `src/context.ts`
- Imported by: none detected

### tests/git-hooks.test.ts

Test file `tests/git-hooks.test.ts` contains tests and validation symbols. Key symbols: `gitInit`, `git`, and 1 more.

- Symbols: `gitInit (function)`, `git (function)`, `commit (function)`
- Imports: `src/codekg/git-hooks.ts`
- Imported by: none detected

### tests/hook-stdin.test.ts

Test file `tests/hook-stdin.test.ts` contains tests and validation symbols. Key symbols: `roots`, `cliPath`, and 1 more.

- Symbols: `roots (const)`, `cliPath (const)`, `runWithOpenStdin (function)`
- Imports: `src/codekg/stdin.ts`
- Imported by: none detected

### tests/hook.test.ts

Test file `tests/hook.test.ts` contains tests and validation symbols. Key symbols: `casesDir`, `cliPath`, and 6 more.

- Symbols: `casesDir (const)`, `cliPath (const)`, `numstat (function)`, `makeFakeGitDir (function)`, `runHook (function)`, `runStopHook (function)`, `clean (const)`, `broken (const)`
- Imports: none detected
- Imported by: none detected

### tests/init-version.test.ts

Test file `tests/init-version.test.ts` contains tests and validation symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: `src/init-version.ts`
- Imported by: none detected

### tests/input-errors.test.ts

Test file `tests/input-errors.test.ts` contains tests and validation symbols. Key symbols: `roots`, `ripgrepInstalled`, and 2 more.

- Symbols: `roots (const)`, `ripgrepInstalled (const)`, `cliPath (const)`, `project (function)`
- Imports: `src/code-refs.ts`, `src/codekg/errors.ts`, `src/codekg/query.ts`, `src/codekg/workspace.ts`, `src/context.ts`
- Imported by: none detected

### tests/lattice.test.ts

Test file `tests/lattice.test.ts` contains tests and validation symbols. Key symbols: `basicDir`, `basicLat`.

- Symbols: `basicDir (const)`, `basicLat (const)`
- Imports: `src/lattice.ts`
- Imported by: none detected

### tests/limits.test.ts

Test file `tests/limits.test.ts` contains tests and validation symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: none detected
- Imported by: none detected

### tests/mcp.test.ts

Test file `tests/mcp.test.ts` contains tests and validation symbols. Key symbols: `casesDir`, `cliPath`, and 2 more.

- Symbols: `casesDir (const)`, `cliPath (const)`, `replayDir (const)`, `canRunSearch (const)`
- Imports: `tests/rag-replay-server.ts`
- Imported by: none detected

### tests/parser.test.ts

Test file `tests/parser.test.ts` contains tests and validation symbols. Key symbols: none detected.

- Symbols: none detected
- Imports: `src/extensions/wiki-link/index.ts`, `src/parser.ts`
- Imported by: none detected

### tests/search-fallback.test.ts

Test file `tests/search-fallback.test.ts` contains tests and validation symbols. Key symbols: `semantic`, `roots`, and 1 more.

- Symbols: `semantic (const)`, `roots (const)`, `project (function)`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/search.ts`, `src/context.ts`, `src/lattice.ts`
- Imported by: none detected

### tests/search.test.ts

Test file `tests/search.test.ts` contains tests and validation symbols. Key symbols: `capturing`, `replayDir`, and 1 more.

- Symbols: `capturing (const)`, `replayDir (const)`, `canRun (const)`
- Imports: `src/config.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`, `tests/rag-replay-server.ts`
- Imported by: none detected

### tests/source-scan.test.ts

Test file `tests/source-scan.test.ts` contains tests and validation symbols. Key symbols: `texts`.

- Symbols: `texts (const)`
- Imports: `src/codekg/source-scan.ts`
- Imported by: none detected

### tests/trace-depth.test.ts

Test file `tests/trace-depth.test.ts` contains tests and validation symbols. Key symbols: `roots`, `chain`, and 1 more.

- Symbols: `roots (const)`, `chain (function)`, `callTrace (function)`
- Imports: `src/codekg/mcp.ts`, `src/codekg/query.ts`, `src/context.ts`
- Imported by: none detected

### tests/walk-symlinks.test.ts

Test file `tests/walk-symlinks.test.ts` contains tests and validation symbols. Key symbols: `root`.

- Symbols: `root (const)`
- Imports: `src/code-refs.ts`, `src/walk.ts`
- Imported by: none detected

## Test Coverage Links

Test coverage links map inferred test relationships from test imports to source files so agents can find validation paths.

### src/context.ts

Source file `src/context.ts` is covered by test imports from `tests/agents-edge-cases.test.ts`, `tests/backlinks-safety.test.ts`, and 10 more.

- Tests: `tests/agents-edge-cases.test.ts`, `tests/backlinks-safety.test.ts`, `tests/cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, and 6 more

### src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, and 5 more.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, `tests/gaps-inferred.test.ts`, and 1 more

### src/code-refs.ts

Source file `src/code-refs.ts` is covered by test imports from `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`, and 2 more.

- Tests: `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`, `tests/input-errors.test.ts`, `tests/walk-symlinks.test.ts`

### src/codekg/check.ts

Source file `src/codekg/check.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-messages.test.ts`, and 2 more.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`

### src/codekg/mcp.ts

Source file `src/codekg/mcp.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, and 2 more.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/codekg-messages.test.ts`, `tests/codekg.test.ts`, `tests/trace-depth.test.ts`

### src/codekg/agents.ts

Source file `src/codekg/agents.ts` is covered by test imports from `tests/agents-edge-cases.test.ts`, `tests/codekg-intelligence.test.ts`, and 1 more.

- Tests: `tests/agents-edge-cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/codekg/drift.ts

Source file `src/codekg/drift.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, and 1 more.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/codekg/graph.ts

Source file `src/codekg/graph.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, and 1 more.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`

### src/codekg/query.ts

Source file `src/codekg/query.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`, and 1 more.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`, `tests/trace-depth.test.ts`

### src/codekg/search.ts

Source file `src/codekg/search.ts` is covered by test imports from `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, and 1 more.

- Tests: `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`, `tests/search-fallback.test.ts`

### src/codekg/structural.ts

Source file `src/codekg/structural.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, and 1 more.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/enrich.test.ts`

### src/codekg/types.ts

Source file `src/codekg/types.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, and 1 more.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/lattice.ts

Source file `src/lattice.ts` is covered by test imports from `tests/cases.test.ts`, `tests/lattice.test.ts`, and 1 more.

- Tests: `tests/cases.test.ts`, `tests/lattice.test.ts`, `tests/search-fallback.test.ts`

### src/cli/check.ts

Source file `src/cli/check.ts` is covered by test imports from `tests/cases.test.ts`, `tests/enrich.test.ts`.

- Tests: `tests/cases.test.ts`, `tests/enrich.test.ts`

### src/codekg/backlinks.ts

Source file `src/codekg/backlinks.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg.test.ts`.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg.test.ts`

### src/codekg/cache.ts

Source file `src/codekg/cache.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/enrich.test.ts`.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/enrich.test.ts`

### src/codekg/context.ts

Source file `src/codekg/context.ts` is covered by test imports from `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`.

- Tests: `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`

### src/codekg/enrich.ts

Source file `src/codekg/enrich.ts` is covered by test imports from `tests/config-corrupt.test.ts`, `tests/enrich.test.ts`.

- Tests: `tests/config-corrupt.test.ts`, `tests/enrich.test.ts`

### src/codekg/gaps.ts

Source file `src/codekg/gaps.ts` is covered by test imports from `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`.

- Tests: `tests/codekg.test.ts`, `tests/gaps-inferred.test.ts`

### src/codekg/review-source.ts

Source file `src/codekg/review-source.ts` is covered by test imports from `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`.

- Tests: `tests/backlinks-safety.test.ts`, `tests/codekg-intelligence.test.ts`

### src/codekg/semantic.ts

Source file `src/codekg/semantic.ts` is covered by test imports from `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`.

- Tests: `tests/codekg.test.ts`, `tests/config-corrupt.test.ts`

### src/codekg/workspace.ts

Source file `src/codekg/workspace.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/input-errors.test.ts`

### src/config.ts

Source file `src/config.ts` is covered by test imports from `tests/config-corrupt.test.ts`, `tests/search.test.ts`.

- Tests: `tests/config-corrupt.test.ts`, `tests/search.test.ts`

### tests/rag-replay-server.ts

Source file `tests/rag-replay-server.ts` is covered by test imports from `tests/mcp.test.ts`, `tests/search.test.ts`.

- Tests: `tests/mcp.test.ts`, `tests/search.test.ts`

### src/cli/refs.ts

Source file `src/cli/refs.ts` is covered by test imports from `tests/cases.test.ts`.

- Tests: `tests/cases.test.ts`

## Generated Test Specs

These files preserve existing `@lat` backlinks found in test code.

- [[check-code-refs]] - Generated test specs.
- [[check-index]] - Generated test specs.
- [[check-md]] - Generated test specs.
- [[check-sections]] - Generated test specs.
- [[expand]] - Generated test specs.
- [[hook]] - Generated test specs.
- [[locate]] - Generated test specs.
- [[mcp]] - Generated test specs.
- [[ref-extraction]] - Generated test specs.
- [[ref-resolution]] - Generated test specs.
- [[refs-e2e]] - Generated test specs.
- [[search]] - Generated test specs.
- [[section]] - Generated test specs.
- [[section-parsing]] - Generated test specs.
- [[section-preview]] - Generated test specs.
- [[ts-fallback]] - Generated test specs.
