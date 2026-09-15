# Changelog

## Unreleased

### Added

- Agent roles for orchestrator/worker/full splits: `code-kg agents install --role`,
  `code-kg agents role`, `.code-kg/agent-role.json`, and `CODEKG_AGENT_ROLE` so
  OpenClaw (plan/delegate) and Claude Code (implement) can share one repo without
  planning hooks interrupting coding workers (and vice versa).
- OpenClaw skill pack under `plugins/openclaw-code-kg/` documenting sealed-work
  handoff with `CODEKG_AGENT_ROLE=worker` on launched Claude Code sessions.

- First-run / `agents install` now writes the same managed guidance into both
  `AGENTS.md` and `CLAUDE.md` (knowledge-graph orientation + coding workflow +
  mandatory loop).
- Git hooks install set expands to `pre-commit`, `post-merge`, and
  `post-checkout` so `lat.md/` refreshes on commit and whenever the current
  branch tip moves (pulls/merges onto main included).
- Stop lifecycle hook blocks once when `code-kg check` fails or code changes are
  out of sync with `lat.md/` (GSD-style enforce-once); PreToolUse nudges are
  stronger about search-first + work-tracker usage.
- Reticle-style `code-kg work verify` with pass/fail/inconclusive verdicts; `work close` now requires a passing verification unless `--force` / `--allow-inconclusive`.
- Ouroboros-style interview loop: `work interview`, `work answer`, `work assume`, `work accept`, `work seal` (auto-interview on create; acceptance stays separate from the build brief).
- Caliper-shaped skill eval harness (`evals/skills/*.eval.yaml`, `pnpm test:skill-evals`) for structural packaging + ablation notes.
- Plugin skills `anti-slop-code` (load-bearing code checks) and `ui-skills-route` (UI Skills MCP/CLI router).
- MCP tools for verify/interview/answer/assume/accept/seal.

### Added (earlier)

- Worktree isolation (`code-kg work isolate` / `work start --worktree`), evidence pairs (`work evidence pair`), and agent skills for code-structure / evidence / before-and-after / unslop.
- Agent work tracker (`code-kg work`) with ready/claim/close, dependency links,
  discovered-from provenance, session `prime`, and knowledge-graph priming via
  `work start` so agents search `lat.md` before broad source greps.
- MCP tools `codekg_work_ready`, `codekg_work_start`, `codekg_work_prime`,
  `codekg_work_create`, `codekg_work_claim`, `codekg_work_close`, and
  `codekg_work_show`.
- Managed AGENTS.md guidance and SessionStart context now include work-tracker
  workflow hints.
- Standalone `code-kg` CLI outside the source `lat.md-main` and Graphify repos.
- Bootstrap and materialization for `lat.md/` plus `.code-kg/materialization-manifest.json`.
- Deterministic source graph extraction with symbols, imports, test coverage links, and generated relationship sections.
- Drift, reconcile, confidence review, suppression, and edit-safe backlink commands.
- Local-first semantic search with `code-kg semantic status`, `enable-local`, and `reindex`.
- `code-kg install-global` for installing a stable user-level wrapper.
- Managed agent guidance with `code-kg agents install`, `uninstall`, and `status`.
- Codex hook nudges for Bash search commands and structured Grep, Glob, Read, LS, read_file, and list_directory payloads.
- `code-kg context`, `gaps`, `changed`, and `update` for day-to-day graph-guided work.
- MCP tools for search, section reads, check, drift, confidence, suppressions, and backlinks.
- Package smoke coverage for bootstrap, doctor, semantic setup, global install, hook fallback/global forms, and agent status.

### Verified

- Fresh-repo setup works through the global `code-kg` binary:
  `bootstrap`, `semantic enable-local`, `semantic reindex`, `agents install`,
  `agents status`, hook checks, `doctor`, and `drift`.
- Observability Dashboard integration reports installed guidance, global PATH
  hook, local semantic cache, and no drift findings.
