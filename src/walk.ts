// @ts-expect-error -- no type declarations
import walk from 'ignore-walk';
import { lstat, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Walk a directory tree respecting .gitignore rules. Returns relative paths
 * of all non-ignored regular files, excluding .git/ and dotfiles (e.g.
 * .gitignore). Symbolic links are kept only when they resolve to a regular
 * file; links to directories and dangling links are dropped so readers never
 * hit EISDIR/ENOENT on an entry that was reported as a file.
 *
 * This is the single entry point for all directory walking in lat.md — both
 * code-ref scanning and lat.md/ index validation use it so .gitignore rules
 * are consistently honored.
 */
export async function walkEntries(dir: string): Promise<string[]> {
  const entries: string[] = await walk({
    path: dir,
    ignoreFiles: ['.gitignore'],
  });
  const candidates = entries.filter(
    (entry) => !entry.startsWith('.git/') && !entry.startsWith('.'),
  );
  const regular = await Promise.all(
    candidates.map((entry) => isRegularFile(join(dir, entry))),
  );
  return candidates.filter((_, index) => regular[index]);
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (info.isFile()) return true;
    if (!info.isSymbolicLink()) return false;
    return (await stat(path)).isFile();
  } catch {
    return false; // dangling link, or removed during the walk
  }
}
