import { describe, expect, it, afterAll } from 'vitest';
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

const root = mkdtempSync(join(tmpdir(), 'codekg-walk-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('walkEntries', () => {
  it('reports only regular files; symlinked directories and dangling links are dropped', async () => {
    mkdirSync(join(root, 'examples', 'debby'), { recursive: true });
    mkdirSync(join(root, 'resources'), { recursive: true });
    writeFileSync(join(root, 'examples', 'debby', 'case.txt'), 'x\n');
    writeFileSync(join(root, 'src.ts'), 'export {};\n');
    // A tracked symlink to a directory (git mode 120000) lives alongside real files.
    symlinkSync(
      join('..', 'examples', 'debby'),
      join(root, 'resources', 'debby'),
    );
    symlinkSync(join('..', 'src.ts'), join(root, 'resources', 'src-link.ts'));
    symlinkSync(
      join('..', 'missing.ts'),
      join(root, 'resources', 'dangling.ts'),
    );

    const entries = (await walkEntries(root)).sort();
    expect(entries).toEqual([
      'examples/debby/case.txt',
      'resources/src-link.ts',
      'src.ts',
    ]);
  });
});
