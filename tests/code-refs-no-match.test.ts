import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasRipgrep, scanCodeRefs } from '../src/code-refs.js';
const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'codekg-rg-no-match-'));
  roots.push(root);
  await writeFile(join(root, 'source.ts'), 'export const untouched = 1;\n');
  return root;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe('ripgrep no-match exit handling', () => {
  it('retains the actual rg fast path when zero references match', async () => {
    vi.stubEnv('_LAT_DISABLE_RG', '0');
    expect(await hasRipgrep()).toBe(true);
    const root = await fixture();
    const result = await scanCodeRefs(root);
    expect(result.usedRg).toBe(true);
    expect(result.refs).toEqual([]);
    expect(result.files).toContain(join(root, 'source.ts'));
  });
  it.each([
    { code: 2, stderr: 'synthetic scan error' },
    { code: 1, stderr: 'synthetic scan warning' },
  ])(
    'preserves fallback for genuine rg failure %#',
    async ({ code, stderr }) => {
      vi.stubEnv('_LAT_DISABLE_RG', '0');
      const root = await fixture();
      const bin = await mkdtemp(join(tmpdir(), 'codekg-rg-bin-'));
      roots.push(bin);
      await writeFile(
        join(bin, 'rg'),
        `#!/bin/sh\necho '${stderr}' >&2\nexit ${code}\n`,
        { mode: 0o755 },
      );
      vi.stubEnv('PATH', bin + delimiter + (process.env.PATH ?? ''));
      await writeFile(
        join(root, 'source.ts'),
        '// @lat: [[architecture#Entry]]\nexport const untouched = 1;\n',
      );
      const result = await scanCodeRefs(root);
      expect(result.usedRg).toBe(false);
      expect(result.refs).toEqual([
        { file: 'source.ts', line: 1, target: 'architecture#Entry' },
      ]);
    },
  );
});
