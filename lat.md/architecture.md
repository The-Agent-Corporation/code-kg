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

- Code files: 103
- Test files: 30
- Documentation files: 78
- Config files: 2
- Asset files: 2
- Unsupported files: 12

## Structural Graph

Code-KG extracted a deterministic structural graph with 1304 nodes, 3233 edges, 4 communities using the multi-language-directory-fallback analysis path.

## Communities

Directory-based communities provide the first subsystem map until graph clustering is available.

- src: 75 files, 854 symbols, cohesion 0.82
- tests: 52 files, 282 symbols, cohesion 0.48
- templates: 2 files, 27 symbols, cohesion 1
- scripts: 4 files, 4 symbols, cohesion 0.86

## High-Degree Nodes

High-degree nodes may deserve review as important entry points, bridges, or utility hotspots.

- tests/codekg.test.ts (file)
- src/codekg/cli.ts (file)
- src/codekg/bootstrap.ts (file)
- src (module)
- src/context.ts (file)
- src/codekg/agents.ts (file)
- tests/retrieval-eval.test.ts (file)
- tests/codekg-intelligence.test.ts (file)
- src/lattice.ts (file)
- src/codekg/graph.ts (file)

## Dependency Hotspots

Dependency hotspots are the source files with the most local importers, the shared modules and integration points; each file card in [[files]] names its importers.

- `src/context.ts`: imported by 50 local files
- `src/codekg/types.ts`: imported by 27 local files
- `src/lattice.ts`: imported by 24 local files
- `src/codekg/cache.ts`: imported by 13 local files
- `src/codekg/bootstrap.ts`: imported by 12 local files
- `src/codekg/query.ts`: imported by 12 local files
- `src/codekg/structural.ts`: imported by 12 local files
- `src/codekg/anchors.ts`: imported by 11 local files
- `src/config.ts`: imported by 11 local files
- `src/search/provider.ts`: imported by 11 local files
- `src/codekg/check.ts`: imported by 10 local files
- `src/codekg/fresh.ts`: imported by 9 local files
- `src/code-refs.ts`: imported by 8 local files
- `src/codekg/graph.ts`: imported by 8 local files
- `src/codekg/search.ts`: imported by 7 local files
