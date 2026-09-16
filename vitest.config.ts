import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Freshness/invalidation fixtures perform several full runtime-byte checks.
    // This test-only budget does not change the owned 7.5s native hook deadline.
    testTimeout: 20000,
    exclude: [
      ...configDefaults.exclude,
      // Linked worktrees are separate checkouts, not duplicate root suites.
      '**/.code-kg/**',
      // This suite uses node:test and runs as the second mandatory `pnpm test` leg.
      'plugins/openclaw-code-kg/tests/bridge.test.mjs',
    ],
  },
});
