import { describe, expect, it, afterAll, vi } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkEntries } from '../src/walk.js';
import { scanCodeRefs } from '../src/code-refs.js';

const root = mkdtempSync(join(tmpdir(), 'codekg-walk-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

mkdirSync(join(root, 'examples', 'debby'), { recursive: true });
mkdirSync(join(root, 'resources'), { recursive: true });
writeFileSync(join(root, 'examples', 'debby', 'case.txt'), 'x\n');
writeFileSync(join(root, 'src.ts'), 'export {};\n');
// A tracked symlink to a directory (git mode 120000) lives alongside real files.
symlinkSync(join('..', 'examples', 'debby'), join(root, 'resources', 'debby'));
symlinkSync(join('..', 'src.ts'), join(root, 'resources', 'src-link.ts'));
symlinkSync(join('..', 'missing.ts'), join(root, 'resources', 'dangling.ts'));

describe('walkEntries', () => {
  it('reports only regular files; symlinked directories and dangling links are dropped', async () => {
    const entries = (await walkEntries(root)).sort();
    expect(entries).toEqual([
      'examples/debby/case.txt',
      'resources/src-link.ts',
      'src.ts',
    ]);
  });

  it('lets the fallback code-ref scanner read every walked entry', async () => {
    vi.stubEnv('_LAT_DISABLE_RG', '1');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const result = await scanCodeRefs(root);
      expect(result.usedRg).toBe(false);
      expect(result.files.sort()).toEqual(
        ['examples/debby/case.txt', 'resources/src-link.ts', 'src.ts'].map(
          (entry) => join(root, entry),
        ),
      );
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
