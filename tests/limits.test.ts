import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

describe('description previews', () => {
  it('finishes promptly for a long unbroken opening token', async () => {
    // A subprocess timeout can stop a synchronous truncation loop that would
    // otherwise freeze the test runner itself.
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "import { descriptionPreview } from './src/codekg/limits.ts'; process.stdout.write(descriptionPreview('x'.repeat(300)));",
      ],
      { timeout: 3000 },
    );
    expect(stdout.length).toBeLessThanOrEqual(250);
    expect(stdout).toMatch(/^x+…$/);
  });
});
