import { describe, expect, it } from 'vitest';
import {
  closingParen,
  scanSource,
  stringAt,
} from '../src/codekg/source-scan.js';

const texts = (path: string, content: string) =>
  scanSource(path, content).strings.map(([start, end]) =>
    content.slice(start, end),
  );

describe('scanSource', () => {
  it('blanks line and block comments but not slashes inside strings', () => {
    const content =
      "const url = 'http://x/y'; // run('a/b')\n/* spawn(c) */ go();\n";
    const { code } = scanSource('a.ts', content);

    expect(code).toHaveLength(content.length);
    expect(code).toContain("'http://x/y';");
    expect(code).not.toContain('run(');
    expect(code).not.toContain('spawn(');
    expect(code).toContain('go();');
  });

  it('skips regex literals so their quotes do not open strings', () => {
    expect(
      texts('a.ts', `const re = /['"]/g; f("b");\nconst n = a / 2 / 'c';\n`),
    ).toStrictEqual(['"b"', "'c'"]);
  });

  it('handles hash comments and triple quotes in scripts', () => {
    const content = `# it's a note\ns = """one\n'two'"""\nrun('x')  # trailing\n`;
    const { code } = scanSource('test_a.py', content);

    expect(texts('test_a.py', content)).toStrictEqual([
      `"""one\n'two'"""`,
      "'x'",
    ]);
    expect(code).not.toContain('note');
    expect(code).not.toContain('trailing');
  });

  it('keeps UTF-16 offsets aligned past astral characters', () => {
    const content = "const e = '😀'; f('src/a.ts');\n";
    const scan = scanSource('a.ts', content);
    const at = content.indexOf("'src/a.ts'");

    expect(stringAt(scan, at)).toStrictEqual([at, at + "'src/a.ts'".length]);
  });

  it('finds the closing paren across lines, strings and comments', () => {
    const content = "run(\n  ')', // )\n  [a(b)],\n) + 1;\n";
    const scan = scanSource('a.ts', content);

    expect(content.slice(0, closingParen(scan, 3))).toBe(
      "run(\n  ')', // )\n  [a(b)],\n)",
    );
  });
});
