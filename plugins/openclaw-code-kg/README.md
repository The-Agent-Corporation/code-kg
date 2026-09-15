# OpenClaw + Code-KG

This plugin pack teaches an **OpenClaw orchestrator** how to use Code-KG while
delegating implementation to **Claude Code** (or other) coding workers.

## Install

1. Ensure the `code-kg` CLI is on `PATH` (`code-kg install-global` or your package manager).
2. In the target repo:

```bash
code-kg bootstrap --accept
code-kg agents install --role orchestrator
```

3. Enable this skill pack in OpenClaw (link or copy `plugins/openclaw-code-kg`):

```bash
# example — adjust to your OpenClaw install style
openclaw plugins install --link /path/to/code-kg/plugins/openclaw-code-kg
```

Or copy `skills/code-kg-orchestrator` into the OpenClaw workspace `skills/` directory.

4. Set the orchestrator process env:

```bash
export CODEKG_AGENT_ROLE=orchestrator
```

5. When launching Claude Code workers, set:

```bash
export CODEKG_AGENT_ROLE=worker
```

in the worker process (see the skill for `agent_launch` examples).

## Why roles exist

Without roles, the same Stop / PromptSubmit hooks fire for both OpenClaw and
Claude Code. Planning retrieval interrupts coding workers; coding sync blocks
interrupt the orchestrator that never edits source. Roles split those policies
while sharing one knowledge graph.
