# Full Claude Code installation handoff

These commands were checked against the installed Claude Code CLI on 2026-09-15. They are a handoff, not a claim of live activation.

## Inventory and exact installation

`claude plugin list --json` returned `[]` before installation. Both manifests passed `claude plugin validate`; marketplace has only an optional-description warning.

From the reviewed, built, durable source (not a temporary child worktree):

```sh
claude plugin validate plugins/code-kg
claude plugin validate .
claude plugin marketplace add "$reviewed_source" --scope user
claude plugin install code-kg@code-kg --scope user
claude plugin list --json
claude plugin details code-kg@code-kg
```

User scope makes the full plugin available in every Claude session using this Claude configuration home. Do not additionally load `--plugin-dir` or manually duplicate its hooks/MCP server in settings. Inspect user, project, local, and explicitly supplied settings for duplicate Code-KG command hooks or manually defined MCP servers before installation. Do not print credential fields from these files.

The plugin intentionally resolves `code-kg` on PATH; install the qualified CLI at a durable shared location visible to both Claude and OpenClaw. Verify its identity from each launcher environment. Marketplace caches can copy the plugin: verify installed manifest/hook/MCP bytes and inventory, not just the original source files. No runtime implementation ships in the plugin itself, so the shared executable must be the qualified version.

## Role consistency

Use `code-kg --dir <checkout> agents install --role worker` for Roscoe main and each preserved worker checkout. This merges guidance and writes `.code-kg/agent-role.json`, so ad hoc Claude launched there also resolves `worker`. Set `CODEKG_AGENT_ROLE=worker` explicitly in worker launchers. OpenClaw bridge must explicitly set `CODEKG_AGENT_ROLE=orchestrator`, which takes precedence over the checkout default. Worker admission/identity bindings supplied by the workflow integration remain separately required; role selection alone is not authentication.

Install composed Git guards before/after ordinary agents installation through the exported `installComposedGitHooks(root, { finalPreCommit: '.githooks/pre-commit' })`. Ordinary reinstall recognizes the dispatcher and updates only Code-KG sidecars. Do not force-replace Roscoe’s tracked guard. The composition stores dispatchers under the common Git directory, shared by worktrees, and executes the final guard from the current checkout.

## Preserved sessions

Use each existing worktree and UUID with `claude --resume <uuid>`; do not use `--fork-session`, `--bare`, or replacement `--session-id`. The current CLI explicitly documents `--resume` preserving identity while `--fork-session` creates a new one. Avoid background resume of an already active session: the CLI documents that it can start a copy. Check inactive status first. Installation/restart alone is not a resumed model execution witness.

## Full feature inventory

- Seven skills: code-kg, code-structure, evidence, before-and-after, unslop, anti-slop-code, ui-skills-route.
- One full MCP server `code-kg`, command `code-kg mcp`, cwd `${CLAUDE_PROJECT_DIR}`; do not substitute retrieval-only tools.
- PreToolUse: `code-kg hook-check`, matcher Bash/Grep/Glob/Read/LS.
- SessionStart: `code-kg session-check` and `code-kg agent-context session`.
- UserPromptSubmit: `code-kg agent-context prompt`.
- PostToolUse: `code-kg agent-context edit`, matcher Write/Edit/MultiEdit.
- Stop: `code-kg agent-context stop`.
- Five event groups, six distinct commands total, exactly one installed copy of each.

Live acceptance still requires the effective worker role, hooks firing, full MCP inventory, a genuine Stop response, the preserved UUID, and a successful supported credential/egress path. `claude plugin validate` checks the manifest, not those runtime behaviors. The historical API 407 is not resolved merely by installing the plugin.
