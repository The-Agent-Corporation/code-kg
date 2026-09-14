#!/usr/bin/env node
/**
 * Caliper-shaped structural skill evals for Code-KG plugin skills.
 * This is not a full agent harness; it checks skill packaging + required
 * guidance so regressions are caught in CI without LLM spend.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evalDir = join(root, 'evals', 'skills');

function parseSimpleYaml(text) {
  // Minimal YAML subset used by our eval files (no nested objects beyond one level of lists).
  const doc = {};
  let listKey = null;
  let listItem = null;
  let listItemKey = null;
  let subListKey = null;

  const flushItem = () => {
    if (listKey && listItem) {
      doc[listKey].push(listItem);
      listItem = null;
      listItemKey = null;
      subListKey = null;
    }
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const indent = rawLine.match(/^ */)[0].length;

    if (indent === 0 && line.includes(':')) {
      flushItem();
      listKey = null;
      const idx = line.indexOf(':');
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!value) {
        doc[key] = [];
        listKey = key;
      } else {
        doc[key] = stripQuotes(value);
      }
      continue;
    }

    if (listKey && indent === 2 && line.trim().startsWith('- ')) {
      flushItem();
      const rest = line.trim().slice(2);
      listItem = {};
      if (rest.includes(':')) {
        const idx = rest.indexOf(':');
        listItemKey = rest.slice(0, idx).trim();
        const value = rest.slice(idx + 1).trim();
        if (!value) {
          listItem[listItemKey] = [];
          subListKey = listItemKey;
        } else {
          listItem[listItemKey] = stripQuotes(value);
          listItemKey = null;
          subListKey = null;
        }
      }
      continue;
    }

    if (listItem && indent === 4 && line.includes(':')) {
      const trimmed = line.trim();
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!value) {
        listItem[key] = [];
        subListKey = key;
      } else {
        listItem[key] = stripQuotes(value);
        subListKey = null;
      }
      continue;
    }

    if (listItem && subListKey && indent >= 6 && line.trim().startsWith('- ')) {
      listItem[subListKey].push(stripQuotes(line.trim().slice(2)));
    }
  }
  flushItem();
  return doc;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function runEval(fileName) {
  const raw = await readFile(join(evalDir, fileName), 'utf8');
  const spec = parseSimpleYaml(raw);
  const failures = [];

  for (const check of spec.checks ?? []) {
    if (check.kind === 'file_exists') {
      try {
        await readFile(join(root, check.path), 'utf8');
      } catch {
        failures.push(`missing file ${check.path}`);
      }
    } else if (check.kind === 'frontmatter_name') {
      const body = await readFile(join(root, spec.skill), 'utf8');
      const match = body.match(/^---[\s\S]*?name:\s*([^\n]+)[\s\S]*?---/);
      const name = match?.[1]?.trim();
      if (name !== check.equals) {
        failures.push(`frontmatter name ${name} != ${check.equals}`);
      }
    } else if (check.kind === 'body_contains') {
      const body = await readFile(join(root, spec.skill), 'utf8');
      for (const text of check.texts ?? []) {
        if (!body.includes(text)) failures.push(`missing text ${JSON.stringify(text)}`);
      }
    } else if (check.kind === 'references_command') {
      const body = await readFile(join(root, spec.skill), 'utf8');
      if (!body.includes(check.command)) {
        failures.push(`missing command reference ${check.command}`);
      }
    } else {
      failures.push(`unknown check kind ${check.kind}`);
    }
  }

  return { id: spec.id ?? fileName, failures, taskCount: (spec.tasks ?? []).length };
}

const files = (await readdir(evalDir)).filter((name) => name.endsWith('.eval.yaml'));
if (!files.length) {
  console.error('No evals found in evals/skills');
  process.exit(1);
}

let failed = 0;
for (const file of files.sort()) {
  const result = await runEval(file);
  if (result.failures.length) {
    failed += 1;
    console.log(`FAIL ${result.id}`);
    for (const failure of result.failures) console.log(`  - ${failure}`);
  } else {
    console.log(`PASS ${result.id} (${result.taskCount} task specs recorded)`);
  }
}

if (failed) {
  console.error(`\n${failed}/${files.length} skill evals failed`);
  process.exit(1);
}
console.log(`\n${files.length}/${files.length} skill evals passed`);
