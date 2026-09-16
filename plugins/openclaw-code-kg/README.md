# OpenClaw + Code-KG

This package connects the complete Code-KG workflow to the OpenClaw supervisor.
The Claude plugin remains `plugins/code-kg`: its original skills, MCP server,
session/prompt/pre-tool/edit/Stop hooks and worker role are retained separately.

## Runtime contract

- The bridge is explicitly scoped to trusted `roscoe-supervisor` agent identity
  and configured session prefixes. The repository comes from host configuration,
  never a tool argument or the supervisor workspace cwd.
- Every hook subprocess has `CODEKG_AGENT_ROLE=orchestrator`. Configure Claude
  workers with `CODEKG_AGENT_ROLE=worker`; these are complementary roles sharing
  the same graph and canonical Code-KG work store.
- Session bootstrap runs once per trusted session UUID per backend generation;
  prompt retrieval runs per prompt. Search-first admission is scoped to the
  actual run and resets when a new native turn identity is proven.
- Native shell/patch/spawn and OpenClaw dynamic shell/file tools map into the
  existing Code-KG hook vocabulary. A code-mode JavaScript wrapper is not treated
  as shell; each separately emitted nested tool invocation is checked.
- OpenClaw's pre-tool hook has no `additionalContext` result. Therefore a Code-KG
  raw-read/search nudge becomes a denial until successful `codekg_cli` or
  `codekg_mcp` graph retrieval in that run. Actual failed retrieval grants no
  credit. Once oriented, further raw reads are allowed unless Code-KG denies.
  This is an intentional host-specific strengthening, not stock nudge behavior.
- Administrative/recovery tools and explicit absolute reads outside the bound
  repository are not misclassified as Roscoe source reads.
- Code-KG Stop `{decision:"block"}` becomes `revise` with a one-pass retry budget;
  `stopHookActive` is passed back on the second pass. Remaining soft context is
  queued for the next prompt. User cancellation never invokes Stop enforcement.
- Hook subprocesses have their own timeout shorter than the host hook timeout;
  failed prechecks deny execution. Prompt/edit/Stop errors remain visible and
  prevent a successful qualification claim. Stop errors request an explicit
  failed-enforcement report. OpenClaw's bounded revision limit means this is not
  an unbounded completion gate.
- `codekg_bridge_status` exposes process counters plus this session's bounded
  hook receipts (stage, trusted run/turn IDs and tool names, no prompts/arguments).
  Counts prove observed events only, not execution on every possible host path.

## Full command surface

`codekg_cli {argv:[...]}` runs the installed CLI's unchanged parser through its
`runCodeKgCli` trusted-binding entry, without a shell. It binds `--dir` from host
config and rejects caller overrides. All CLI capabilities remain available.
Raw non-brokered CLI work mutations fail under admission policy.

`codekg_mcp {}` lists the complete MCP catalog and input schemas. Supplying
`name` and `arguments` invokes the real MCP server with the trusted reviewer
context; the bridge does not maintain a reduced copy of the MCP tool set.

`codekg_work {command,options}` calls the shared Code-KG work command functions,
using their camelCase options. It covers interview/answer/assume/accept/seal,
claim/start, adoption/isolation, evidence, verification, closure, memories and
cleanup. The work store's admission policy remains authoritative: a reviewer
cannot impersonate the operator to force-close or clean worktrees.

The supervisor receives a host-bound reviewer actor. Host-configured
`workBindings` supply allowed work IDs and sealed revisions for final closure.
An unknown or stale binding does not become authority by appearing in tool input.
The shared work implementation must be installed with
`.code-kg/work/admission.json` containing `{"requireAuthority":true}` before
claiming lifecycle enforcement. A role environment variable alone is not work
mutation authority.

## Supported activation configuration

The parent integration owns activation, credentials and Gateway restart. Build a
reviewable artifact with `openclaw plugins pack --root <this-directory> --out
<new-absolute-path.tgz> --json`, then submit its exact path/hash through the
supported artifact-activation flow. Do not replace hooks by copying skill text.

```json
{
  "plugins": {
    "entries": {
      "code-kg": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true,
          "allowPromptInjection": true
        },
        "config": {
          "agentId": "roscoe-supervisor",
          "sessionPrefixes": ["agent:roscoe-supervisor:"],
          "repository": "/data/repos/roscoe",
          "codekgRoot": "<absolute reviewed Code-KG installation>",
          "companionPath": "<same installation>/plugins/openclaw-code-kg/runner.mjs",
          "companionSha256": "<reviewed SHA256 of runner.mjs>",
          "hookTimeouts": { "pre": 10000, "sessionCheck": 10000, "session": 30000, "prompt": 30000, "edit": 45000, "stop": 45000 },
          "commandTimeoutMs": 120000,
          "workBindings": []
        }
      }
    }
  }
}
```

`codekgRoot` must contain the built CLI and its qualified dependencies. The
reviewed `runner.mjs` companion is installed there with the full Code-KG package;
its required SHA256 is checked before each command. It calls the shared trusted
CLI entry, work dispatcher and MCP server; it owns no separate admission policy.
The native plugin pack bundles backend dependencies but does not copy skills or
external programs. Install the supplied, unchanged
`skills/code-kg-orchestrator/SKILL.md` through OpenClaw's supported workspace skill
installation and verify its hash. The backend archive deliberately declares no
dangling skills directory. CLI/companion, unchanged skill, backend artifact and
live host qualification are separate parts of this complete installation. No
password, token, API key or alternate environment belongs in plugin config or
model tool inputs. The bridge inherits the supported host process environment;
it does not implement a credential extraction or proxy bypass path.

## Verification and limits

Run `node --test plugins/openclaw-code-kg/tests/bridge.test.mjs` from a checkout
whose canonical Code-KG root has been built. Tests include a real synthetic Git
repository, actual CLI/bootstrap/prechecks/search, full MCP listing/call, and
actual Code-KG open-work Stop/second-pass behavior; other tests exercise scope,
identity, failures, cancellation, nested dispatch mapping and sealed bindings.

Before calling this installed and enforcing, separately demonstrate on the live
host: hook registrations and config, actual native pre-tool deny/admit, dynamic
and nested tool deny/admit, true native Stop causing another model pass, no
impact on another agent, all intended supervisor sessions, and the full Claude
worker plugin in the preserved session identities. A synthetic handler call does
not establish those host-level facts. A host `finalize` decision from another
plugin can override `revise`; qualification must inspect competing hooks.

## Monorepo lifecycle budgets

Roscoe warm measurements before the no-match scan fix were approximately 12s
for SessionStart and 16–19s for Stop. Lifecycle child budgets are therefore 30s
for session/prompt and 45s for edit/Stop, while pre-tool and session-check stay
10s. `hookTimeouts` may narrow these bounded operation-specific values, never
increase every pre-tool check implicitly. Host registrations add 2s headroom;
prompt bootstrap reserves the sum of its three sequential children plus 3s
(73s with defaults). A child deadline kills its process and surfaces an explicit
enforcement failure. `codekg_bridge_status` reports the configured budgets.

**Outer native relay qualification is required:** this installed OpenClaw build
has a separate Codex command relay default of 10s (its RPC deadline is 9s).
`api.on` and `plugins.entries.code-kg.hooks.timeouts` do not themselves lengthen
that relay. The bridge therefore caps trusted `event.provider === "codex"`
Stop checks at an owned 7.5s deadline. Installed native tool names (`exec`,
`exec_command`, `apply_patch`, `spawn_agent`) receive the same cap for pre/post
checks; the post emitter does not expose provider identity. Other dynamic tool
names retain their direct-host budgets. A timeout kills the child, records a
failure, and returns `revise` **before** the outer relay deadline, with explicit
instructions in the forwarded `reason` to run full long-budget `codekg_cli map`
validation and retry. No partial/timed-out check is admitted. Direct lifecycle
Stop retains 45s. Native qualification requires the complete freshness-validated
check to finish comfortably below 7.5s and an actual native Stop round trip;
synthetic timeout tests prove failure handling, not live enforcement. Do not
patch installed host files to hide the deadline.
The measured cold structural bootstrap (~132s) is explicit installation work,
not a reason to make interactive hooks unbounded. Qualify/warm the actual
repository using the full CLI before enabling lifecycle hooks.

The full Claude plugin at version 0.1.1 retains every original command/matcher:
PreToolUse remains 10s; SessionStart/UserPromptSubmit become 30s;
PostToolUse/Stop become 45s. Refresh through the supported marketplace installer
so preserved and future worker sessions load the same metadata, not hook copies.
