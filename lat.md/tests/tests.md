# Tests
<!-- code-kg:id tests.tests -->

This section records the test layout discovered during bootstrap and indexes generated test specifications.

## Test Paths

These paths looked test-related during local discovery.

- plugins/openclaw-code-kg/tests/bridge.test.mjs
- tests/agent-context-refresh-failure.test.ts
- tests/agent-roles.test.ts
- tests/bootstrap-cache.test.ts
- tests/cases.test.ts
- tests/code-refs-no-match.test.ts
- tests/codekg-intelligence.test.ts
- tests/codekg-work-shared.test.ts
- tests/codekg-work.test.ts
- tests/codekg.test.ts
- tests/fresh-cache.test.ts
- tests/fresh-lifecycle.test.ts
- tests/git-hooks-composition.test.ts
- tests/git-hooks.test.ts
- tests/hook.test.ts
- tests/init-version.test.ts
- tests/lattice.test.ts
- tests/mcp.test.ts
- tests/parser.test.ts
- tests/search.test.ts

## Source Test Highlights

These generated highlights come from deterministic file, symbol, and import extraction so agents can search source-shaped concepts before opening raw files.

### plugins/openclaw-code-kg/tests/bridge.test.mjs

Test file `plugins/openclaw-code-kg/tests/bridge.test.mjs` contains tests and validation symbols. Key symbols: `hookContext`, `api`, and 2 more.

- Symbols: `hookContext (function)`, `api (function)`, `api#error (method)`, `mock (function)`
- Imports: `plugins/openclaw-code-kg/bridge.mjs`
- Imported by: none detected

### tests/agent-context-refresh-failure.test.ts

Test file `tests/agent-context-refresh-failure.test.ts` contains tests and validation symbols. Key symbols: `roots`.

- Symbols: `roots (const)`
- Imports: `src/codekg/agent-context.ts`, `src/codekg/cache.ts`, `src/codekg/fresh.ts`, `src/codekg/work.ts`, `src/context.ts`
- Imported by: none detected

### tests/agent-roles.test.ts

Test file `tests/agent-roles.test.ts` contains tests and validation symbols. Key symbols: `ctx`, `mappedRepo`.

- Symbols: `ctx (function)`, `mappedRepo (function)`
- Imports: `src/codekg/agent-context.ts`, `src/codekg/agent-role.ts`, `src/codekg/agents.ts`, `src/context.ts`
- Imported by: none detected

### tests/bootstrap-cache.test.ts

Test file `tests/bootstrap-cache.test.ts` contains tests and validation symbols. Key symbols: `roots`, `fixture`.

- Symbols: `roots (const)`, `fixture (function)`
- Imports: `src/codekg/bootstrap.ts`, `src/codekg/graph.ts`, `src/codekg/structural.ts`
- Imported by: none detected

### tests/cases.test.ts

Test file `tests/cases.test.ts` contains tests and validation symbols. Key symbols: `stripAnsi`, `casesDir`, and 9 more.

- Symbols: `stripAnsi (const)`, `casesDir (const)`, `caseDir (function)`, `latDir (function)`, `testCtx (function)`, `runExpand (function)`, `ref (function)`, `ref~2 (function)`, and 3 more
- Imports: `src/cli/check.ts`, `src/cli/refs.ts`, `src/cli/section.ts`, `src/code-refs.ts`, `src/context.ts`, `src/format.ts`, and 1 more
- Imported by: none detected

### tests/code-refs-no-match.test.ts

Test file `tests/code-refs-no-match.test.ts` contains tests and validation symbols. Key symbols: `roots`, `fixture`.

- Symbols: `roots (const)`, `fixture (function)`
- Imports: `src/code-refs.ts`
- Imported by: none detected

### tests/codekg-intelligence.test.ts

Test file `tests/codekg-intelligence.test.ts` contains tests and validation symbols. Key symbols: `roots`, `ctx`, and 2 more.

- Symbols: `roots (const)`, `ctx (function)`, `fixture (function)`, `manifestPath (const)`
- Imports: `src/codekg/agent-context.ts`, `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/cache.ts`, `src/codekg/drift.ts`, `src/codekg/fresh.ts`, and 9 more
- Imported by: none detected

### tests/codekg-work-shared.test.ts

Test file `tests/codekg-work-shared.test.ts` contains tests and validation symbols. Key symbols: `exec`, `roots`, and 6 more.

- Symbols: `exec (const)`, `roots (const)`, `cli (const)`, `ctx (const)`, `run (const)`, `fixture (function)`, `sealed (function)`, `authority (function)`
- Imports: `src/codekg/mcp.ts`, `src/codekg/work.ts`, `src/context.ts`
- Imported by: none detected

### tests/codekg-work.test.ts

Test file `tests/codekg-work.test.ts` contains tests and validation symbols. Key symbols: `execFileAsync`, `initGitRepo`, and 5 more.

- Symbols: `execFileAsync (const)`, `initGitRepo (function)`, `roots (const)`, `makeProject (function)`, `ctx (function)`, `sealFixture (function)`, `firstText (function)`
- Imports: `src/codekg/agents.ts`, `src/codekg/bootstrap.ts`, `src/codekg/mcp.ts`, `src/codekg/work.ts`, `src/context.ts`
- Imported by: none detected

### tests/codekg.test.ts

Test file `tests/codekg.test.ts` contains tests and validation symbols. Key symbols: `roots`, `execFile`, and 10 more.

- Symbols: `roots (const)`, `execFile (const)`, `makeProject (function)`, `ctx (function)`, `readManifest (function)`, `writeManifest (function)`, `addInferredRelationship (function)`, `addImportRelationship (function)`, and 4 more
- Imports: `src/codekg/agents.ts`, `src/codekg/anchors.ts`, `src/codekg/backlinks.ts`, `src/codekg/bootstrap.ts`, `src/codekg/changed.ts`, `src/codekg/check.ts`, and 16 more
- Imported by: none detected

### tests/fresh-cache.test.ts

Test file `tests/fresh-cache.test.ts` contains tests and validation symbols. Key symbols: `roots`, `fixture`.

- Symbols: `roots (const)`, `fixture (function)`
- Imports: `src/codekg/fresh-cache.ts`, `src/codekg/fresh.ts`, `src/codekg/graph.ts`, `src/codekg/structural.ts`
- Imported by: none detected

### tests/fresh-lifecycle.test.ts

Test file `tests/fresh-lifecycle.test.ts` contains tests and validation symbols. Key symbols: `roots`.

- Symbols: `roots (const)`
- Imports: `src/codekg/fresh.ts`, `src/codekg/graph.ts`
- Imported by: none detected

### tests/git-hooks-composition.test.ts

Test file `tests/git-hooks-composition.test.ts` contains tests and validation symbols. Key symbols: `git`, `commit`, and 1 more.

- Symbols: `git (function)`, `commit (function)`, `install (function)`
- Imports: `src/codekg/git-hooks.ts`
- Imported by: none detected

### tests/git-hooks.test.ts

Test file `tests/git-hooks.test.ts` contains tests and validation symbols. Key symbols: `gitInit`.

- Symbols: `gitInit (function)`
- Imports: `src/codekg/git-hooks.ts`
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

### tests/lattice.test.ts

Test file `tests/lattice.test.ts` contains tests and validation symbols. Key symbols: `basicDir`, `basicLat`.

- Symbols: `basicDir (const)`, `basicLat (const)`
- Imports: `src/lattice.ts`
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

### tests/search.test.ts

Test file `tests/search.test.ts` contains tests and validation symbols. Key symbols: `capturing`, `replayDir`, and 1 more.

- Symbols: `capturing (const)`, `replayDir (const)`, `canRun (const)`
- Imports: `src/config.ts`, `src/search/db.ts`, `src/search/index.ts`, `src/search/provider.ts`, `src/search/search.ts`, `tests/rag-replay-server.ts`
- Imported by: none detected

## Test Coverage Links

Test coverage links map inferred test relationships from test imports to source files so agents can find validation paths.

### src/context.ts

Source file `src/context.ts` is covered by test imports from `tests/agent-context-refresh-failure.test.ts`, `tests/agent-roles.test.ts`, and 5 more.

- Tests: `tests/agent-context-refresh-failure.test.ts`, `tests/agent-roles.test.ts`, `tests/cases.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work-shared.test.ts`, `tests/codekg-work.test.ts`, and 1 more

### src/codekg/graph.ts

Source file `src/codekg/graph.ts` is covered by test imports from `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, and 3 more.

- Tests: `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`, `tests/fresh-cache.test.ts`, `tests/fresh-lifecycle.test.ts`

### src/codekg/agents.ts

Source file `src/codekg/agents.ts` is covered by test imports from `tests/agent-roles.test.ts`, `tests/codekg-intelligence.test.ts`, and 2 more.

- Tests: `tests/agent-roles.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/codekg/bootstrap.ts

Source file `src/codekg/bootstrap.ts` is covered by test imports from `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, and 2 more.

- Tests: `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/codekg/fresh.ts

Source file `src/codekg/fresh.ts` is covered by test imports from `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-intelligence.test.ts`, and 2 more.

- Tests: `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/fresh-cache.test.ts`, `tests/fresh-lifecycle.test.ts`

### src/codekg/mcp.ts

Source file `src/codekg/mcp.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/codekg-work-shared.test.ts`, and 2 more.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/codekg-work-shared.test.ts`, `tests/codekg-work.test.ts`, `tests/codekg.test.ts`

### src/codekg/agent-context.ts

Source file `src/codekg/agent-context.ts` is covered by test imports from `tests/agent-context-refresh-failure.test.ts`, `tests/agent-roles.test.ts`, and 1 more.

- Tests: `tests/agent-context-refresh-failure.test.ts`, `tests/agent-roles.test.ts`, `tests/codekg-intelligence.test.ts`

### src/codekg/structural.ts

Source file `src/codekg/structural.ts` is covered by test imports from `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, and 1 more.

- Tests: `tests/bootstrap-cache.test.ts`, `tests/codekg-intelligence.test.ts`, `tests/fresh-cache.test.ts`

### src/codekg/work.ts

Source file `src/codekg/work.ts` is covered by test imports from `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-work-shared.test.ts`, and 1 more.

- Tests: `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-work-shared.test.ts`, `tests/codekg-work.test.ts`

### src/code-refs.ts

Source file `src/code-refs.ts` is covered by test imports from `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`.

- Tests: `tests/cases.test.ts`, `tests/code-refs-no-match.test.ts`

### src/codekg/cache.ts

Source file `src/codekg/cache.ts` is covered by test imports from `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-intelligence.test.ts`.

- Tests: `tests/agent-context-refresh-failure.test.ts`, `tests/codekg-intelligence.test.ts`

### src/codekg/drift.ts

Source file `src/codekg/drift.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/codekg/git-hooks.ts

Source file `src/codekg/git-hooks.ts` is covered by test imports from `tests/git-hooks-composition.test.ts`, `tests/git-hooks.test.ts`.

- Tests: `tests/git-hooks-composition.test.ts`, `tests/git-hooks.test.ts`

### src/codekg/types.ts

Source file `src/codekg/types.ts` is covered by test imports from `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`.

- Tests: `tests/codekg-intelligence.test.ts`, `tests/codekg.test.ts`

### src/lattice.ts

Source file `src/lattice.ts` is covered by test imports from `tests/cases.test.ts`, `tests/lattice.test.ts`.

- Tests: `tests/cases.test.ts`, `tests/lattice.test.ts`

### tests/rag-replay-server.ts

Source file `tests/rag-replay-server.ts` is covered by test imports from `tests/mcp.test.ts`, `tests/search.test.ts`.

- Tests: `tests/mcp.test.ts`, `tests/search.test.ts`

### plugins/openclaw-code-kg/bridge.mjs

Source file `plugins/openclaw-code-kg/bridge.mjs` is covered by test imports from `plugins/openclaw-code-kg/tests/bridge.test.mjs`.

- Tests: `plugins/openclaw-code-kg/tests/bridge.test.mjs`

### src/cli/check.ts

Source file `src/cli/check.ts` is covered by test imports from `tests/cases.test.ts`.

- Tests: `tests/cases.test.ts`

### src/cli/refs.ts

Source file `src/cli/refs.ts` is covered by test imports from `tests/cases.test.ts`.

- Tests: `tests/cases.test.ts`

### src/cli/section.ts

Source file `src/cli/section.ts` is covered by test imports from `tests/cases.test.ts`.

- Tests: `tests/cases.test.ts`

### src/codekg/agent-role.ts

Source file `src/codekg/agent-role.ts` is covered by test imports from `tests/agent-roles.test.ts`.

- Tests: `tests/agent-roles.test.ts`

### src/codekg/anchors.ts

Source file `src/codekg/anchors.ts` is covered by test imports from `tests/codekg.test.ts`.

- Tests: `tests/codekg.test.ts`

### src/codekg/backlinks.ts

Source file `src/codekg/backlinks.ts` is covered by test imports from `tests/codekg.test.ts`.

- Tests: `tests/codekg.test.ts`

### src/codekg/changed.ts

Source file `src/codekg/changed.ts` is covered by test imports from `tests/codekg.test.ts`.

- Tests: `tests/codekg.test.ts`

### src/codekg/check.ts

Source file `src/codekg/check.ts` is covered by test imports from `tests/codekg.test.ts`.

- Tests: `tests/codekg.test.ts`

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
