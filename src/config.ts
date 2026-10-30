import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import xdg from '@folder/xdg';

// ── XDG config directory ────────────────────────────────────────────

export function getConfigDir(): string {
  return join(xdg().config, 'lat');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

// ── Config read/write ───────────────────────────────────────────────

export type LatConfig = {
  llm_key?: string;
  embedding_provider?: 'local' | 'openai' | 'vercel' | string;
  local_embedding_model?: string;
  local_embedding_dimensions?: number;
};

/** Where JSON.parse failed, without the input excerpt its message may quote. */
function jsonErrorLocation(content: string, message: string): string {
  const lineColumn = /\(line (\d+) column (\d+)\)/.exec(message);
  if (lineColumn) return ` (line ${lineColumn[1]}, column ${lineColumn[2]})`;
  const position = /at position (\d+)/.exec(message);
  if (!position) return '';
  const lines = content.slice(0, Number(position[1])).split('\n');
  return ` (line ${lines.length}, column ${lines.at(-1)!.length + 1})`;
}

export function readConfig(): LatConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  const content = readFileSync(configPath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (err) {
    // The config holds llm_key, and parser messages can quote the input.
    throw new Error(
      `Failed to parse config ${configPath}: not valid JSON${jsonErrorLocation(content, (err as Error).message)}`,
    );
  }
}

export function writeConfig(config: LatConfig): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2) + '\n');
}

// ── Centralized LLM key resolution ─────────────────────────────────

/**
 * Returns the LLM key from (in priority order):
 * 1. LAT_LLM_KEY environment variable
 * 2. LAT_LLM_KEY_FILE — path to a file containing the key
 * 3. LAT_LLM_KEY_HELPER — shell command that prints the key
 * 4. llm_key field in ~/.config/lat/config.json
 *
 * Returns undefined if none is set.
 */
function getEnvLlmKey(): string | undefined {
  const envKey = process.env.LAT_LLM_KEY;
  if (envKey) return envKey;

  const file = process.env.LAT_LLM_KEY_FILE;
  if (file) {
    const content = readFileSync(file, 'utf-8').trim();
    if (!content) {
      throw new Error(`LAT_LLM_KEY_FILE (${file}) is empty.`);
    }
    return content;
  }

  const helper = process.env.LAT_LLM_KEY_HELPER;
  if (helper) {
    const result = execSync(helper, {
      encoding: 'utf-8',
      timeout: 10_000,
    }).trim();
    if (!result) {
      throw new Error('LAT_LLM_KEY_HELPER command returned an empty string.');
    }
    return result;
  }

  return undefined;
}

function isChatOnlyKey(key: string): boolean {
  return ['eyJ', 'sk-ant-', 'sk-or-', 'xai-'].some((prefix) =>
    key.startsWith(prefix),
  );
}

export function getEmbeddingKey(): string | undefined {
  const config = readConfig();
  const envProvider = process.env.LAT_EMBEDDING_PROVIDER?.trim().toLowerCase();
  const configuredProvider =
    envProvider || config.embedding_provider?.trim().toLowerCase() || '';

  if (configuredProvider === 'local') return 'local';

  if (envProvider) {
    if (envProvider !== 'openai' && envProvider !== 'vercel') {
      throw new Error(
        'LAT_EMBEDDING_PROVIDER must be local, openai, or vercel.',
      );
    }
  } else if (configuredProvider) {
    if (configuredProvider !== 'openai' && configuredProvider !== 'vercel') {
      throw new Error('embedding_provider must be local, openai, or vercel.');
    }
  }

  const envKey = getEnvLlmKey();
  if (envKey) {
    // Never route chat-only credentials to an embedding provider, including
    // when an explicit remote provider or a persisted fallback is configured.
    if (isChatOnlyKey(envKey)) {
      return config.llm_key &&
        !isChatOnlyKey(config.llm_key) &&
        (config.llm_key.startsWith('sk-') || config.llm_key.startsWith('vck_'))
        ? config.llm_key
        : undefined;
    }
    return envKey;
  }

  if (config.llm_key) {
    if (isChatOnlyKey(config.llm_key)) {
      return undefined;
    }
    return config.llm_key;
  }

  return undefined;
}

export function getLlmKey(): string | undefined {
  const envKey = getEnvLlmKey();
  if (envKey) return envKey;

  const config = readConfig();
  if (config.llm_key) return config.llm_key;

  return undefined;
}

export function getLocalEmbeddingModelConfig(): {
  model?: string;
  dimensions?: number;
} {
  const config = readConfig();
  return {
    model: config.local_embedding_model,
    dimensions: config.local_embedding_dimensions,
  };
}

export function saveLocalEmbeddingConfig(): void {
  writeConfig({
    ...readConfig(),
    embedding_provider: 'local',
  });
}

export function saveRemoteEmbeddingKey(key: string): void {
  const provider = key.startsWith('vck_') ? 'vercel' : 'openai';
  writeConfig({
    ...readConfig(),
    embedding_provider: provider,
    llm_key: key,
  });
}

export function hasEmbeddingConfig(): boolean {
  try {
    return !!getEmbeddingKey();
  } catch {
    return false;
  }
}

/** Why the embedding configuration cannot be resolved, or null if it can. */
export function embeddingConfigError(): string | null {
  try {
    getEmbeddingKey();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}
