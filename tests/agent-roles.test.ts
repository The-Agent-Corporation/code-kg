import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { plainStyler, type CmdContext } from '../src/context.js';
import {
  hookPolicyFor,
  parseAgentRole,
  resolveAgentRole,
  writeAgentRoleConfig,
} from '../src/codekg/agent-role.js';
import { agentsCommand, hookCheckCommand } from '../src/codekg/agents.js';
import { agentContextCommand } from '../src/codekg/agent-context.js';

function ctx(root: string): CmdContext {
  return {
    projectRoot: root,
    latDir: join(root, 'lat.md'),
    styler: plainStyler,
    mode: 'cli',
  };
}

async function mappedRepo(root: string): Promise<void> {
  await mkdir(join(root, 'lat.md'), { recursive: true });
  await mkdir(join(root, '.code-kg'), { recursive: true });
  await writeFile(join(root, 'lat.md', 'index.md'), '# Lat\n', 'utf-8');
  await writeFile(
    join(root, '.code-kg', 'materialization-manifest.json'),
    JSON.stringify({ version: 1, sections: {}, relationships: {} }),
    'utf-8',
  );
}

describe('agent roles', () => {
  let root: string;
  const roots: string[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'codekg-role-'));
    roots.push(root);
  });

  afterEach(async () => {
    delete process.env.CODEKG_AGENT_ROLE;
    for (const dir of roots.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('parses and resolves roles with env overriding the default file', async () => {
    expect(parseAgentRole('orchestrator')).toBe('orchestrator');
    expect(parseAgentRole('WORKER')).toBe('worker');
    expect(parseAgentRole('nope')).toBeNull();

    await writeAgentRoleConfig(root, 'orchestrator');
    expect(await resolveAgentRole(root)).toBe('orchestrator');

    process.env.CODEKG_AGENT_ROLE = 'worker';
    expect(await resolveAgentRole(root)).toBe('worker');
  });

  it('gives orchestrator and worker different hook policies', () => {
    const orch = hookPolicyFor('orchestrator');
    const worker = hookPolicyFor('worker');
    expect(orch.editContext).toBe(false);
    expect(orch.stopBlockOnSync).toBe(false);
    expect(orch.stopBlockOnOpenWork).toBe(true);
    expect(orch.promptPlanningContext).toBe(true);

    expect(worker.editContext).toBe(true);
    expect(worker.stopBlockOnSync).toBe(true);
    expect(worker.stopBlockOnOpenWork).toBe(false);
    expect(worker.promptPlanningContext).toBe(false);
    expect(worker.sessionBootstrapOffer).toBe(false);
  });

  it('install --role writes agent-role.json and dual guidance', async () => {
    const result = await agentsCommand(ctx(root), {
      action: 'install',
      role: 'orchestrator',
    });
    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('orchestrator');

    const roleFile = JSON.parse(
      await readFile(join(root, '.code-kg', 'agent-role.json'), 'utf-8'),
    );
    expect(roleFile.role).toBe('orchestrator');

    const agentsMd = await readFile(join(root, 'AGENTS.md'), 'utf-8');
    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf-8');
    expect(agentsMd).toContain('Agent roles');
    expect(agentsMd).toContain('orchestrator');
    expect(agentsMd).toContain('worker');
    expect(claudeMd).toContain('CODEKG_AGENT_ROLE');
  });

  it('skips edit context for orchestrator and planning prompt context for worker', async () => {
    await mappedRepo(root);
    await writeAgentRoleConfig(root, 'orchestrator');

    process.env.CODEKG_AGENT_ROLE = 'orchestrator';
    const edit = await agentContextCommand(
      ctx(root),
      'edit',
      JSON.stringify({
        tool_input: { file_path: join(root, 'src/app.ts') },
      }),
    );
    expect(edit.output).toBe('');

    process.env.CODEKG_AGENT_ROLE = 'worker';
    const prompt = await agentContextCommand(
      ctx(root),
      'prompt',
      JSON.stringify({ prompt: 'How should we redesign the auth module?' }),
    );
    expect(prompt.output).toBe('');
  });

  it('still nudges workers on search-style PreToolUse', async () => {
    await mappedRepo(root);
    process.env.CODEKG_AGENT_ROLE = 'worker';
    const result = await hookCheckCommand(ctx(root), {
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'rg -n "entry points" src' },
      }),
    });
    expect(result.output).toContain('code-kg search');
  });
});
