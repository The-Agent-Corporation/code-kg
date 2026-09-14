<!-- code-kg:agents:start -->
## code-kg

This project may have a reviewable knowledge base in `lat.md/` and Code-KG metadata in `.code-kg/`.

Rules:
- Before broad source reads, grep/glob searches, or answering codebase-structure questions, use `code-kg search "<question>"` or MCP `codekg_search` first.
- Prefer `code-kg ask "<question>"` or MCP `codekg_ask` for combined knowledge and fresh source context. Use `--in <directory>` to scope a monorepo query.
- Before changing a symbol or file, inspect `code-kg impact <symbol-or-file>`; use `callers`, `callees`, `skeleton`, and `map` for targeted exploration.
- Source descriptions are inferred, not accepted knowledge. Verify source evidence and stale-section warnings; refreshing the index never approves or rewrites curated knowledge.
- For conceptual queries, prefer `code-kg search "<question>" --backend auto-semantic` or `codekg_search` with `backend: "auto-semantic"` so semantic search is used when configured and lexical search is used as a fallback.
- Use `code-kg section "<section-id>"` or MCP `codekg_section` to read full sections with outgoing and incoming relationships before opening raw source.
- Treat `lat.md/` as the primary map and raw source as the implementation detail to inspect after the relevant knowledge sections are known.
- After modifying code or knowledge docs, run `code-kg check` and use `code-kg drift` to compare source and the knowledge base.
- Do not manually add source backlinks; use `code-kg apply-backlinks --preview` and then `code-kg apply-backlinks --write` only for sections marked edit-safe.
- For multi-step work, use `code-kg work` instead of markdown TODOs: `work ready`, `work interview`/`answer`/`seal`, `work start <id> --worktree`, `work verify`, `work close <id>`.
- Before executing a work item, run `code-kg work start <id> --worktree` (or `work isolate` + `work prime`) so search uses the knowledge graph and edits stay in an isolated worktree.
- Prefer action/orchestration code for why/when and shared services for reusable how; load the `code-structure` skill when extracting shared mechanics.
- Capture before/after proof with `code-kg work evidence pair <id> --before <path> --after <path>` before closing; load the `evidence` and `before-and-after` skills for capture workflows.
- Before `work close`, record a Reticle-style verification: `code-kg work verify <id> --verdict pass --summary "..." --method runtime` (fail blocks close; inconclusive needs `--allow-inconclusive`).
- Clarify ambiguous work with `work interview` / `work answer` / `work accept` / `work seal` so acceptance criteria stay separate from the build brief.
- When you discover new work mid-task, create it with `code-kg work create "..." --discovered-from <id>` and keep dependencies explicit.
- Run `unslop` over commit/PR prose you write for humans before posting. For code anti-patterns, load `anti-slop-code`. For UI routing across design skills, load `ui-skills-route`.
<!-- code-kg:agents:end -->
