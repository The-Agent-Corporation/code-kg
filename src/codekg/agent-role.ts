import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Agent role for Code-KG hooks + guidance. */
export type AgentRole = 'orchestrator' | 'worker' | 'full';

export const AGENT_ROLES: readonly AgentRole[] = [
  'orchestrator',
  'worker',
  'full',
] as const;

const ROLE_FILE = join('.code-kg', 'agent-role.json');

export type AgentRoleConfig = {
  role: AgentRole;
  /** Who last set the default role (human / install / openclaw). */
  setBy?: string;
  updatedAt?: string;
};

export function isAgentRole(value: unknown): value is AgentRole {
  return (
    value === 'orchestrator' || value === 'worker' || value === 'full'
  );
}

export function parseAgentRole(value: string | undefined): AgentRole | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return isAgentRole(normalized) ? normalized : null;
}

/**
 * Resolve the effective agent role for this process.
 * Precedence: CODEKG_AGENT_ROLE env → .code-kg/agent-role.json → full.
 *
 * OpenClaw (orchestrator) and Claude Code (worker) often share one repo: set
 * CODEKG_AGENT_ROLE per process so each session gets the right hook policy.
 */
export async function resolveAgentRole(
  projectRoot: string,
): Promise<AgentRole> {
  const fromEnv = parseAgentRole(process.env.CODEKG_AGENT_ROLE);
  if (fromEnv) return fromEnv;
  const stored = await readAgentRoleConfig(projectRoot);
  return stored?.role ?? 'full';
}

export async function readAgentRoleConfig(
  projectRoot: string,
): Promise<AgentRoleConfig | null> {
  try {
    const raw = await readFile(join(projectRoot, ROLE_FILE), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AgentRoleConfig>;
    if (!isAgentRole(parsed.role)) return null;
    return {
      role: parsed.role,
      setBy: typeof parsed.setBy === 'string' ? parsed.setBy : undefined,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export async function writeAgentRoleConfig(
  projectRoot: string,
  role: AgentRole,
  setBy = 'agents-install',
): Promise<string> {
  const dir = join(projectRoot, '.code-kg');
  await mkdir(dir, { recursive: true });
  const config: AgentRoleConfig = {
    role,
    setBy,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(
    join(projectRoot, ROLE_FILE),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8',
  );
  return `set default agent role to ${role} (.code-kg/agent-role.json)`;
}

/** Hook policies by role — keep planning noise off coding workers. */
export type HookPolicy = {
  /** PreToolUse search/read nudges toward code-kg search/context. */
  preToolUseNudge: boolean;
  /** SessionStart map + work summary. */
  sessionContext: boolean;
  /** SessionStart bootstrap offer when lat.md is missing. */
  sessionBootstrapOffer: boolean;
  /** UserPromptSubmit planning retrieval (ask). */
  promptPlanningContext: boolean;
  /** PostToolUse edit traces. */
  editContext: boolean;
  /** Stop: block once on check failure / lat.md sync drift. */
  stopBlockOnSync: boolean;
  /** Stop: block once when sealed work / verify / close duties remain. */
  stopBlockOnOpenWork: boolean;
};

export function hookPolicyFor(role: AgentRole): HookPolicy {
  switch (role) {
    case 'orchestrator':
      return {
        preToolUseNudge: true,
        sessionContext: true,
        sessionBootstrapOffer: true,
        promptPlanningContext: true,
        editContext: false,
        stopBlockOnSync: false,
        stopBlockOnOpenWork: true,
      };
    case 'worker':
      return {
        preToolUseNudge: true,
        sessionContext: true,
        sessionBootstrapOffer: false,
        promptPlanningContext: false,
        editContext: true,
        stopBlockOnSync: true,
        stopBlockOnOpenWork: false,
      };
    default:
      return {
        preToolUseNudge: true,
        sessionContext: true,
        sessionBootstrapOffer: true,
        promptPlanningContext: true,
        editContext: true,
        stopBlockOnSync: true,
        stopBlockOnOpenWork: false,
      };
  }
}

export function roleDescription(role: AgentRole): string {
  switch (role) {
    case 'orchestrator':
      return 'plan, seal work, and delegate — do not implement code';
    case 'worker':
      return 'implement sealed work — do not re-plan or interview';
    default:
      return 'solo agent: plan and implement (all hooks enabled)';
  }
}
