import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { clampLeadingParagraph } from './limits.js';
import type { DiscoveryResult, EntityNode, ProjectGraph } from './types.js';

const SYMBOL_DOC_LIMIT = 20;
const SYMBOL_NAME_LIMIT = 30;
const TEST_NAME_LIMIT = 20;
const COMMAND_LIMIT = 8;
const RELATION_LIMIT = 6;
const DOC_MAX = 160;
/** An identifier called by more registered commands than this is a shared helper. */
const HELPER_COMMAND_LIMIT = 5;

const HASH_COMMENT_EXTENSIONS = new Set([
  '.py',
  '.rb',
  '.sh',
  '.bash',
  '.ex',
  '.exs',
  '.r',
  '.pl',
]);
const SCRIPT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);
const TEST_ROOTS = new Set(['test', 'tests', '__tests__', 'spec', 'specs']);
const CALL_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'function',
  'return',
  'import',
  'require',
  'typeof',
  'await',
  'new',
]);

type Command = {
  /** `code-kg skeleton` or `MCP codekg_skeleton`. */
  label: string;
  description: string;
  file: string;
  calls: Set<string>;
};

export type TestDeclaration = {
  line: number;
  name: string;
  /** Enclosing `describe` names, outermost first. */
  suites: string[];
};

function isHashCommented(path: string): boolean {
  return HASH_COMMENT_EXTENSIONS.has(extname(path).toLowerCase());
}

/** Markdown-safe single-line prose: no wiki links, HTML comments, or stray whitespace. */
function prose(text: string): string {
  return text
    .replace(/\{@link\s+([^}]+)\}/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/</g, '&lt;')
    .replace(/[─━=*-]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text: string): string {
  const sentence = /^(.*?[.!?])(?=\s|$)/.exec(text)?.[1] ?? text;
  if (sentence.length <= DOC_MAX) return sentence;
  const cut = sentence.slice(0, DOC_MAX - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trimEnd() + '…';
}

function isDirective(text: string): boolean {
  return /^(@lat:|eslint|prettier-ignore|@ts-|istanbul|c8 |type: |noqa|pylint|-\*-|!)/.test(
    text,
  );
}

/** Comment text, without markers, for a contiguous comment block ending at `end` (0-based). */
function commentAbove(lines: string[], end: number, hash: boolean): string[] {
  const collected: string[] = [];
  let i = end;
  if (i >= 0 && /\*\/\s*$/.test(lines[i])) {
    while (i >= 0) {
      collected.unshift(lines[i]);
      if (/^\s*\/\*/.test(lines[i])) break;
      i--;
    }
    if (i < 0) return [];
  } else {
    const marker = hash ? /^\s*#(?![[!])/ : /^\s*\/\//;
    while (i >= 0 && marker.test(lines[i])) collected.unshift(lines[i--]);
  }
  return collected
    .map((line) =>
      line
        .replace(/^\s*(\/\*\*?|\*\/|\*(?!\/)|\/\/\/?|#)\s?/, '')
        .replace(/\s*\*\/\s*$/, '')
        .trim(),
    )
    .filter((line) => !isDirective(line));
}

/** The first paragraph of comment text, before any JSDoc-style tag. */
function commentParagraph(comment: string[]): string {
  const paragraph: string[] = [];
  for (const line of comment) {
    if (/^@\w+/.test(line)) break;
    if (!line) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line);
  }
  return prose(paragraph.join(' '));
}

function pythonDocstring(lines: string[], declaration: number): string {
  for (let i = declaration; i < Math.min(lines.length, declaration + 4); i++) {
    const match = /^\s*[rRuU]?("""|''')(.*)$/.exec(lines[i]);
    if (!match) {
      if (/:\s*(#.*)?$/.test(lines[i])) continue;
      return '';
    }
    const body = [match[2]];
    let j = i;
    while (!body[body.length - 1].includes(match[1]) && ++j < lines.length)
      body.push(lines[j]);
    return prose(body.join(' ').split(match[1])[0]);
  }
  return '';
}

/** The doc comment directly above a symbol, skipping decorators and `@lat` backlinks. */
function symbolDoc(path: string, lines: string[], node: EntityNode): string {
  const start = (node.source_span?.start_line ?? 1) - 1;
  const hash = isHashCommented(path);
  let end = start - 1;
  while (
    end >= 0 &&
    (/^\s*@\w/.test(lines[end]) ||
      /^\s*#\[/.test(lines[end]) ||
      /^\s*(\/\/|#)\s*@lat:/.test(lines[end]))
  )
    end--;
  const above = commentParagraph(commentAbove(lines, end, hash));
  if (above) return firstSentence(above);
  return path.endsWith('.py')
    ? firstSentence(pythonDocstring(lines, start + 1))
    : '';
}

/** The comment that opens a file, unless it documents the first symbol instead. */
function fileDoc(path: string, lines: string[], symbolStarts: Set<number>) {
  const hash = isHashCommented(path);
  let i = 0;
  while (
    i < lines.length &&
    (!lines[i].trim() ||
      /^#!/.test(lines[i]) ||
      /^['"]use strict['"]/.test(lines[i].trim()) ||
      /coding[:=]/.test(lines[i]))
  )
    i++;
  if (path.endsWith('.py') && /^\s*[rRuU]?("""|''')/.test(lines[i] ?? ''))
    return pythonDocstring(lines, i);
  while (i < lines.length) {
    const opensBlock = /^\s*\/\*/.test(lines[i]);
    const isLine = hash ? /^\s*#(?![[!])/ : /^\s*\/\//;
    if (!opensBlock && !isLine.test(lines[i])) return '';
    let end = i;
    if (opensBlock)
      while (end < lines.length && !/\*\//.test(lines[end])) end++;
    else while (end + 1 < lines.length && isLine.test(lines[end + 1])) end++;
    const comment = commentParagraph(commentAbove(lines, end, hash));
    let next = end + 1;
    while (
      next < lines.length &&
      /^\s*((\/\/|#)\s*@lat:|@\w)/.test(lines[next])
    )
      next++;
    const attached = symbolStarts.has(next + 1);
    if (comment && !attached && !/copyright|spdx-license/i.test(comment))
      return comment;
    i = end + 1;
    while (i < lines.length && !lines[i].trim()) i++;
  }
  return '';
}

/** Index just past the `)` that closes the `(` at `open`, skipping strings and comments. */
function closeParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') i = text.indexOf('\n', i) >>> 0;
    else if (c === '/' && text[i + 1] === '*')
      i = (text.indexOf('*/', i + 2) >>> 0) + 1;
    else if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++)
        if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return text.length;
}

const STRING = /^\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/;

function stringArg(text: string): string | undefined {
  return STRING.exec(text)?.[2];
}

function calledIdentifiers(chunk: string): Set<string> {
  const calls = new Set<string>();
  for (const match of chunk.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g))
    if (!CALL_KEYWORDS.has(match[2])) calls.add(match[2]);
  return calls;
}

/** Commander `.command()` chains and MCP `.tool()` / `.registerTool()` calls. */
function registeredCommands(file: string, content: string): Command[] {
  const commands: Command[] = [];
  const program = /\.name\(\s*['"]([^'"]+)['"]\s*\)/.exec(content)?.[1];
  const groups = new Map<string, string>();
  for (const match of content.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*\.command\(\s*(['"`])([^'"`\s]+)/g,
  ))
    groups.set(match[1], match[3]);
  for (const match of content.matchAll(/\.command\(/g)) {
    const leaf = stringArg(content.slice(match.index + 9))?.split(/\s/)[0];
    if (!leaf) continue;
    const receiver = /([A-Za-z_$][\w$]*)\s*$/.exec(
      content.slice(0, match.index),
    )?.[1];
    const group = receiver && groups.get(receiver);
    const name = group ? `${group} ${leaf}` : leaf;
    let end = closeParen(content, match.index + 8);
    for (;;) {
      const next = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(content.slice(end));
      if (!next || next[1] === 'command') break;
      end = closeParen(content, end + next[0].length - 1);
    }
    const chunk = content.slice(match.index, end);
    const description = /\.description\(/.exec(chunk);
    commands.push({
      label: `${program ?? 'CLI'} ${name}`,
      description: description
        ? (stringArg(chunk.slice(description.index + 13)) ?? '')
        : '',
      file,
      calls: calledIdentifiers(chunk),
    });
  }
  for (const match of content.matchAll(/\.(registerTool|tool)\(/g)) {
    const open = match.index + match[0].length - 1;
    const args = content.slice(open + 1);
    const name = stringArg(args);
    if (!name || !/^[\w.-]+$/.test(name)) continue;
    const rest = args.slice(STRING.exec(args)![0].length).replace(/^\s*,/, '');
    const description =
      stringArg(rest) ??
      /description:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.exec(rest)?.[2] ??
      '';
    commands.push({
      label: `MCP ${name}`,
      description,
      file,
      calls: calledIdentifiers(content.slice(open, closeParen(content, open))),
    });
  }
  const descriptions = new Map(commands.map((c) => [c.label, c.description]));
  for (const command of commands)
    if (!command.description)
      command.description =
        descriptions.get(command.label.split(' ').slice(0, -1).join(' ')) ?? '';
  return commands;
}

/** `it`/`test` calls (with their `describe` suites), Python `test_` functions, Go `Test` funcs. */
export function testDeclarations(
  path: string,
  content: string,
): TestDeclaration[] {
  const lines = content.split('\n');
  const declarations: TestDeclaration[] = [];
  const suites: Array<{ indent: number; name: string }> = [];
  lines.forEach((line, index) => {
    const indent = line.length - line.trimStart().length;
    const js =
      /^\s*(describe|it|test)(?:\.\w+(?:\([^()]*\))?)*\s*\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/.exec(
        line,
      );
    const py = /^\s*(?:async\s+)?def\s+(test_\w+)/.exec(line);
    const go = /^func\s+(Test\w+)\s*\(/.exec(line);
    const rust =
      index > 0 && /#\[(tokio::)?test\]/.test(lines[index - 1])
        ? /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/.exec(line)
        : null;
    while (suites.length && suites[suites.length - 1].indent >= indent)
      if (js || py || go || rust || line.trim()) suites.pop();
      else break;
    if (js?.[1] === 'describe') {
      suites.push({ indent, name: js[3] });
      return;
    }
    const name = js?.[3] ?? py?.[1] ?? go?.[1] ?? rust?.[1];
    if (name)
      declarations.push({
        line: index + 1,
        name: prose(name),
        suites: suites.map((suite) => prose(suite.name)),
      });
  });
  return declarations;
}

function codeList(items: string[], limit: number): string {
  const visible = items.slice(0, limit).map((item) => `\`${item}\``);
  const remaining = items.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')}, and ${remaining} more`
    : visible.join(', ');
}

function relatedFiles(
  graph: ProjectGraph,
  nodes: Map<string, EntityNode>,
  file: EntityNode,
  relation: 'imports' | 'tests',
  direction: 'outgoing' | 'incoming',
  inferred?: boolean,
): string[] {
  const related = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation !== relation) continue;
    if (inferred !== undefined && (edge.confidence === 'INFERRED') !== inferred)
      continue;
    const [from, to] =
      direction === 'outgoing'
        ? [edge.source, edge.target]
        : [edge.target, edge.source];
    if (from !== file.id) continue;
    const path = nodes.get(to)?.source_file;
    if (path && path !== file.source_file) related.add(path);
  }
  return [...related].sort();
}

/** Files that get a card: parsed code and tests, minus fixtures nothing imports. */
function cardPaths(discovery: DiscoveryResult, graph: ProjectGraph): string[] {
  const categories = new Map(discovery.files.map((f) => [f.path, f.category]));
  const imported = new Set(
    graph.edges.filter((e) => e.relation === 'imports').map((e) => e.target),
  );
  return graph.nodes
    .filter((node) => node.kind === 'file' && node.source_file)
    .filter((node) => {
      const path = node.source_file!;
      const category = categories.get(path);
      if (category === 'test') return true;
      if (category !== 'code') return false;
      const fixture =
        TEST_ROOTS.has(path.split('/')[0]) &&
        path.split('/').length > 2 &&
        !imported.has(node.id);
      return !fixture;
    })
    .map((node) => node.source_file!)
    .sort();
}

/**
 * Commands whose handlers call into each file, keyed by file. Shared helpers
 * that many commands call are left out so a card names the file's own commands.
 */
function commandsByFile(
  commands: Command[],
  definitions: Map<string, string>,
): Map<string, Command[]> {
  const callers = new Map<string, number>();
  for (const command of commands)
    for (const call of command.calls)
      callers.set(call, (callers.get(call) ?? 0) + 1);
  const byFile = new Map<string, Command[]>();
  for (const command of commands) {
    const files = new Set<string>();
    for (const call of command.calls) {
      const file = definitions.get(call);
      if (!file || file === command.file) continue;
      if ((callers.get(call) ?? 0) > HELPER_COMMAND_LIMIT) continue;
      files.add(file);
    }
    for (const file of files)
      byFile.set(file, [...(byFile.get(file) ?? []), command]);
  }
  return byFile;
}

/** Symbol names that only one file defines, mapped to that file. */
function uniqueDefinitions(graph: ProjectGraph): Map<string, string> {
  const files = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    if (node.kind === 'file' || node.kind === 'module' || !node.source_file)
      continue;
    const name = node.label.split('#').pop()!;
    if (!files.has(name)) files.set(name, new Set());
    files.get(name)!.add(node.source_file);
  }
  return new Map(
    [...files]
      .filter(([, defined]) => defined.size === 1)
      .map(([name, defined]) => [name, [...defined][0]]),
  );
}

function renderCard(input: {
  path: string;
  isTest: boolean;
  lines: string[];
  symbols: EntityNode[];
  uses: Command[];
  registers: Command[];
  tests: TestDeclaration[];
  covers: string[];
  testedBy: string[];
  inferredTests: string[];
  imports: string[];
  importedBy: string[];
}): string[] {
  const { path, lines, symbols } = input;
  const starts = new Set(symbols.map((s) => s.source_span?.start_line ?? 0));
  const documented: string[] = [];
  const undocumented = new Set<string>();
  // The extractor tells repeated names apart as `name~2`, `name~3`, ...
  const name = (symbol: EntityNode) => symbol.label.replace(/~\d+$/, '');
  for (const symbol of symbols) {
    const doc = symbolDoc(path, lines, symbol);
    if (doc && documented.length < SYMBOL_DOC_LIMIT)
      documented.push(`- \`${name(symbol)}\` (${symbol.kind}): ${doc}`);
    else undocumented.add(name(symbol));
  }
  const names = [...new Set(symbols.map(name))];
  const lead =
    fileDoc(path, lines, starts) ||
    (input.isTest
      ? `Test file \`${path}\`${
          input.covers.length
            ? ` checks ${codeList(input.covers, 2)}`
            : ` has ${input.tests.length} tests`
        }.`
      : names.length
        ? `Source file \`${path}\` defines ${codeList(names, 3)}.`
        : `Source file \`${path}\` defines no extracted symbols.`);
  const bullets = [
    ...input.uses
      .slice(0, COMMAND_LIMIT)
      .map(
        (command) =>
          `- Used by \`${command.label}\`${command.description ? `: ${prose(command.description)}` : ''}`,
      ),
    ...(input.registers.length
      ? [
          `- Registers ${input.registers.length} commands: ${codeList(
            input.registers.map((command) => command.label),
            SYMBOL_NAME_LIMIT,
          )}`,
        ]
      : []),
    ...input.tests
      .slice(0, TEST_NAME_LIMIT)
      .map((test) => `- Test: ${[...test.suites, test.name].join(' › ')}`),
    ...(input.tests.length > TEST_NAME_LIMIT
      ? [`- and ${input.tests.length - TEST_NAME_LIMIT} more tests`]
      : []),
    ...documented,
    ...(undocumented.size
      ? [
          `- ${documented.length ? 'Also defines' : 'Defines'}: ${codeList([...undocumented], SYMBOL_NAME_LIMIT)}`,
        ]
      : []),
    ...(input.covers.length
      ? [`- Checks: ${codeList(input.covers, RELATION_LIMIT)}`]
      : []),
    ...(input.testedBy.length
      ? [`- Tested by: ${codeList(input.testedBy, RELATION_LIMIT)}`]
      : []),
    ...(input.inferredTests.length
      ? [
          `- Inferred tests (load it by path, not by import): ${codeList(input.inferredTests, RELATION_LIMIT)}`,
        ]
      : []),
    ...(input.imports.length
      ? [`- Imports: ${codeList(input.imports, RELATION_LIMIT)}`]
      : []),
    ...(input.importedBy.length
      ? [`- Imported by: ${codeList(input.importedBy, RELATION_LIMIT)}`]
      : []),
  ];
  return [
    `## ${path}`,
    '',
    clampLeadingParagraph(lead),
    ...(bullets.length ? ['', ...bullets] : []),
    '',
  ];
}

/** `lat.md/files.md`: one card per source and test file, built from names, docs, and relations. */
// @lat: [[lat.md/concepts#Concepts#File Cards]]
export async function filesFile(
  root: string,
  discovery: DiscoveryResult,
  graph: ProjectGraph,
): Promise<string> {
  const paths = cardPaths(discovery, graph);
  const categories = new Map(discovery.files.map((f) => [f.path, f.category]));
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const fileNodes = new Map(
    graph.nodes
      .filter((node) => node.kind === 'file' && node.source_file)
      .map((node) => [node.source_file!, node]),
  );
  const contents = new Map<string, string>();
  for (const path of paths)
    contents.set(
      path,
      await readFile(join(root, path), 'utf-8').catch(() => ''),
    );
  const commands = paths
    .filter((path) => SCRIPT_EXTENSIONS.has(extname(path).toLowerCase()))
    .filter((path) => categories.get(path) === 'code')
    .flatMap((path) => registeredCommands(path, contents.get(path)!));
  const uses = commandsByFile(commands, uniqueDefinitions(graph));

  const cards = paths.flatMap((path) => {
    const file = fileNodes.get(path)!;
    const content = contents.get(path)!;
    const isTest = categories.get(path) === 'test';
    const symbols = graph.nodes
      .filter(
        (node) =>
          node.source_file === path &&
          node.kind !== 'file' &&
          node.kind !== 'module',
      )
      .sort(
        (a, b) =>
          (a.source_span?.start_line ?? 0) - (b.source_span?.start_line ?? 0) ||
          a.label.localeCompare(b.label),
      );
    const related = (
      relation: 'imports' | 'tests',
      direction: 'outgoing' | 'incoming',
      inferred?: boolean,
    ) => relatedFiles(graph, nodes, file, relation, direction, inferred);
    return renderCard({
      path,
      isTest,
      lines: content.split('\n'),
      symbols: isTest ? [] : symbols,
      uses: uses.get(path) ?? [],
      registers: commands.filter((command) => command.file === path),
      tests: isTest ? testDeclarations(path, content) : [],
      covers: isTest ? related('tests', 'outgoing') : [],
      testedBy: isTest ? [] : related('tests', 'incoming', false),
      inferredTests: isTest ? [] : related('tests', 'incoming', true),
      imports: related('imports', 'outgoing'),
      importedBy: related('imports', 'incoming'),
    });
  });

  return [
    '# Source Files',
    '<!-- code-kg:id files.overview -->',
    '',
    paths.length
      ? 'Each parsed source and test file has a generated card: what the file is for, its symbols and their doc comments, the commands that use it, and its tests and imports.'
      : 'No parsed source or test files were available for file cards during bootstrap.',
    '',
    ...cards,
  ]
    .join('\n')
    .trimEnd()
    .concat('\n');
}
