---
name: code-kg-orchestrator
description: Use when OpenClaw is orchestrating coding work that should be delegated to Claude Code (or similar) workers with Code-KG. Covers role setup, sealed work handoff, and worker env so planning hooks do not interrupt coding sessions.
---

# Code-KG for OpenClaw orchestrators

You are the **orchestrator**. You plan, seal work, and delegate. You do **not**
implement application code. Coding workers (Claude Code sessions you launch)
implement sealed work items.

## One-time repo setup

From the repo root (with user go-ahead):

```bash
code-kg bootstrap --accept
code-kg semantic enable-local
code-kg semantic reindex
code-kg agents install --role orchestrator
```

That writes:

- managed guidance into `AGENTS.md` and `CLAUDE.md` (both roles documented)
- `.code-kg/agent-role.json` defaulting to `orchestrator`
- Codex/Claude-compatible hooks + git sync hooks

## Per-process roles (critical)

OpenClaw and Claude Code often share one checkout. Do **not** rely only on the
default file when both run against the same repo.

| Process | Env |
| --- | --- |
| OpenClaw (you) | `CODEKG_AGENT_ROLE=orchestrator` |
| Claude Code worker you launch | `CODEKG_AGENT_ROLE=worker` |

Hook policy when `CODEKG_AGENT_ROLE=orchestrator`:

- Keeps search/ask/session context for planning
- Skips edit/PostToolUse coding traces
- Does **not** Stop-block on lat.md sync (you are not the coder)
- Stop-nudge/block on open unsealed or unverified work

Hook policy when `CODEKG_AGENT_ROLE=worker`:

- Keeps search-before-grep + edit context + Stop sync/check blocks
- Skips planning PromptSubmit retrieval and bootstrap offers
- Does **not** re-run interview/planning loops

## Delegation loop

1. Orient: `code-kg search "…" --backend auto-semantic` / `code-kg ask "…"`.
2. Create + clarify work: `code-kg work create "…"`, `work interview`, `work answer`, `work seal`.
3. Launch a Claude Code worker with the sealed brief and worker role, for example:

```text
agent_launch(
  prompt: "<sealed acceptance + build brief from code-kg work show <id>>\n\nYou are a Code-KG worker. Implement only this sealed item. Use code-kg search/context before broad grep. Run work start <id> --worktree, then evidence + work verify --verdict pass.",
  workdir: "<repo>",
  harness: "claude-code",
  env: { CODEKG_AGENT_ROLE: "worker" }
)
```

If your harness launcher does not take `env`, export `CODEKG_AGENT_ROLE=worker`
in the worker shell / wrapper before `claude` starts, or run
`code-kg agents role --role worker` only inside an isolated worker worktree.

4. On return: review evidence, `code-kg work verify` if needed, then `work close`.
5. Keep the graph fresh via installed git hooks; after manual KB edits run
   `code-kg check` and `code-kg drift`.

## What not to do

- Do not open large source greps to “just implement it” in the orchestrator.
- Do not leave Claude Code on the default `full`/`orchestrator` role — that lets
  planning PromptSubmit hooks interrupt coding.
- Do not skip sealing work before delegation; workers should receive a sealed id.

## MCP / CLI

Prefer MCP `codekg_search`, `codekg_ask`, `codekg_section`, and work tools when
available. Use the CLI for `bootstrap`, `agents install|role|status`, `update`,
and anything not exposed over MCP.
