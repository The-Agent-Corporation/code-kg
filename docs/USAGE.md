# Code-KG Usage

This is the practical local workflow for using Code-KG in a repo. It assumes
`code-kg` is already on `PATH`.

## Fresh Repo Setup

From the repository root:

```bash
code-kg bootstrap --accept
code-kg semantic enable-local
code-kg semantic reindex
code-kg agents install
code-kg agents status
```

Expected status should show:

```text
- lat.md/: found
- AGENTS.md guidance: installed
- CLAUDE.md guidance: installed
- Codex hook: installed
- git hooks: installed (pre-commit, post-merge, post-checkout)
- semantic search: local
- MCP command: code-kg mcp
```

`code-kg agents install` writes the same managed guidance block into both
`AGENTS.md` and `CLAUDE.md`, installs Codex lifecycle hooks (including a Stop
hook that blocks once when `code-kg check` fails or `lat.md/` is out of sync),
and installs git `pre-commit`, `post-merge`, and `post-checkout` hooks so the
knowledge graph refreshes on commits and whenever the current branch tip moves.

### OpenClaw orchestrator + Claude Code workers

When OpenClaw plans and Claude Code implements, install once then set roles
**per process** so hooks stay appropriate:

```bash
code-kg agents install --role orchestrator
export CODEKG_AGENT_ROLE=orchestrator          # OpenClaw
CODEKG_AGENT_ROLE=worker claude                # coding worker
```

| Role | Host | Hook policy |
| --- | --- | --- |
| `orchestrator` | OpenClaw | planning search/ask/session; skip edit traces; Stop cares about open work, not lat.md sync |
| `worker` | Claude Code | search-before-grep + edit context; Stop blocks once on check/sync; skip planning PromptSubmit |
| `full` | solo | all hooks (default) |

See `code-kg agents status`, `code-kg agents role`, and
`plugins/openclaw-code-kg/` (`code-kg-orchestrator` skill).

## Daily Agent Workflow

Use semantic search before broad source search:

```bash
code-kg search "how is memory coverage tested" --backend auto-semantic
```

Open the relevant knowledge section before raw source:

```bash
code-kg context apps/api/memory.py
code-kg section "lat.md/tests/tests#Tests#Test Coverage Links#apps/api/memory.py"
```

After code or knowledge changes:

```bash
code-kg changed
code-kg update
code-kg check
code-kg drift
```

## Multi-step Work Tracking

For longer agent sessions, use the Beads/GSD-style work tracker instead of
markdown TODOs. Items live in `.code-kg/work/` and `work start` primes each task
from the knowledge graph before coding. Prefer isolated worktrees and attach
before/after evidence before closing.

```bash
code-kg work create "Harden drift apply-safe" --query "drift reconcile" --priority 1 --accept "drift apply-safe stays green"
code-kg work ready
code-kg work interview <id>
code-kg work answer <id> --question q1 --answer "..."
code-kg work seal <id>
code-kg work start <id> --worktree   # claim + isolate + knowledge prime
code-kg work evidence pair <id> --before before.png --after after.png
code-kg work verify <id> --verdict pass --summary "runtime check ok" --method runtime
code-kg work create "Follow-up" --discovered-from <id>
code-kg work close <id> --reason "shipped"
code-kg work cleanup <id>
code-kg work prime                   # session orientation for the next agent turn
```

Project skills that reinforce this loop:

- `code-structure` — actions vs shared services
- `evidence` / `before-and-after` — proof before close
- `unslop` — human-readable PR/commit prose
- `anti-slop-code` — load-bearing code checks (complements unslop)
- `ui-skills-route` — route UI work through the UI Skills registry

`work close` requires a latest `work verify --verdict pass` (or `--allow-inconclusive` / `--force`).
Structural skill packaging checks: `pnpm test:skill-evals`.

SessionStart hooks include a compact ready/in-progress summary when work exists.
MCP tools mirror the same flow: `codekg_work_ready`, `codekg_work_start`,
`codekg_work_prime`, `codekg_work_verify`, `codekg_work_interview`,
`codekg_work_seal`, and related create/claim/close/show tools.

## Hook Behavior

`code-kg agents install` adds the same managed guidance to `AGENTS.md` and
`CLAUDE.md`, installs Codex lifecycle hooks, and installs git
`pre-commit` / `post-merge` / `post-checkout` hooks.

- **PreToolUse** (`hook-check`): non-blocking nudge before broad raw-source
  search or reads. Prefer `code-kg search` / `context` first.
- **SessionStart / UserPromptSubmit / PostToolUse** (`agent-context`): inject
  bounded Code-KG context; never approve knowledge.
- **Stop** (`agent-context stop`): role-aware. Workers/full block once when
  `code-kg check` fails or code changed without a matching `lat.md/` update.
  Orchestrators skip sync blocks and instead Stop-nudge/block on open unsealed
  or unverified work so planning sessions are not interrupted by coding sync
  rules (and workers are not interrupted by planning PromptSubmit).
- **Git hooks**: `pre-commit` runs `code-kg update` and stages KB files (blocks
  on check failure). `post-merge` / `post-checkout` refresh `lat.md/` after the
  branch tip moves so a pull onto main cannot leave the graph stale.

Examples:

```bash
printf '%s' '{"tool_name":"Grep","tool_input":{"pattern":"memory coverage","path":"apps"}}' \
  | code-kg hook-check
```

The hook suggests:

```text
code-kg search "memory coverage" --backend auto-semantic
```

Reads of `lat.md/` and `.code-kg/` stay silent so agents can inspect the
knowledge base without loops.

For raw source reads, the hook suggests:

```text
code-kg context "apps/api/memory.py"
```

## Health Checks

Use these when something feels off:

```bash
code-kg agents status
code-kg semantic status
code-kg gaps
code-kg changed
code-kg doctor
code-kg drift
```

`agents status` is the fastest way to verify the installed hook matcher, hook
command, semantic readiness, and MCP command.

`gaps` reports missing documentation anchors and source files without detected
test coverage. `changed` maps current git working-tree changes back to relevant
sections and tests.

## Local Semantic Search

The default local embedding provider is `Xenova/bge-small-en-v1.5` with 384
dimensions. The first semantic index run may download model files into the
Transformers cache. After that, search and indexing are local.

To force a rebuild:

```bash
code-kg semantic reindex
```

To search with semantic fallback:

```bash
code-kg search "entry points" --backend auto-semantic
```
