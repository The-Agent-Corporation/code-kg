import { existsSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import {
  anchorName,
  anchorSpan,
  backlinkAnchorsForSection,
  sourceAnchorPolicy,
} from './anchors.js';
import { writeJsonAtomic } from './cache.js';
import { freshGraph } from './fresh.js';
import { sourceHash } from './structural.js';
import type {
  ManifestSection,
  MaterializationManifest,
  ProjectGraph,
  SourceSpan,
} from './types.js';

type ApplyBacklinksOptions = {
  write: boolean;
};

type BacklinkInsertion = {
  file: string;
  line: number;
  comment: string;
  expectedHash: string;
};

type BacklinkSkip = {
  file: string;
  reason: string;
};

type BacklinkPlan = {
  insertions: BacklinkInsertion[];
  skips: BacklinkSkip[];
  /** The graph anchors were located in, when any section has anchors. */
  graph: ProjectGraph | null;
};

const SLASH_COMMENT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.h',
  '.cc',
  '.cpp',
  '.cxx',
]);

const HASH_COMMENT_EXTENSIONS = new Set([
  '.py',
  '.rb',
  '.sh',
  '.bash',
  '.zsh',
  '.pl',
]);

const SKIP_PATH_PARTS = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  '.code-kg',
]);

function manifestPath(ctx: CmdContext): string {
  return join(ctx.projectRoot, '.code-kg', 'materialization-manifest.json');
}

async function readManifest(ctx: CmdContext): Promise<MaterializationManifest> {
  return JSON.parse(
    await readFile(manifestPath(ctx), 'utf-8'),
  ) as MaterializationManifest;
}

function commentPrefix(file: string): string | null {
  const extension = extname(file);
  if (SLASH_COMMENT_EXTENSIONS.has(extension)) return '//';
  if (HASH_COMMENT_EXTENSIONS.has(extension)) return '#';
  return null;
}

function skippedPathReason(file: string): string | null {
  const parts = file.split(/[\\/]/);
  return parts.some((part) => SKIP_PATH_PARTS.has(part))
    ? `skipped generated or dependency path ${file}`
    : null;
}

function isInside(root: string, target: string): boolean {
  const path = relative(root, target);
  return (
    path !== '' &&
    path !== '..' &&
    !path.startsWith('..' + sep) &&
    !isAbsolute(path)
  );
}

/**
 * Resolves a manifest-relative path to its real location, refusing anything
 * outside the project. Missing files resolve to their unresolved path.
 */
async function projectFile(root: string, file: string): Promise<string | null> {
  if (isAbsolute(file)) return null;
  const target = resolve(root, file);
  if (!isInside(root, target)) return null;
  if (!existsSync(target)) return target;
  const [realRoot, realTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  return isInside(realRoot, realTarget) ? realTarget : null;
}

const CODING_COOKIE = /^[ \t\f]*#.*?coding[:=]/;
const BLANK_OR_COMMENT = /^[ \t\f]*(#.*)?$/;

/**
 * A shebang only works on line 1. An encoding declaration works on line 1, or
 * on line 2 when line 1 is blank or a comment (PEP 263).
 */
function backlinkLine(content: string, line: number): number {
  const [first = '', second = ''] = content
    .split('\n', 2)
    .map((text) => text.replace(/\r$/, ''));
  let header = first.startsWith('#!') ? 1 : 0;
  if (CODING_COOKIE.test(first)) header = 1;
  else if (BLANK_OR_COMMENT.test(first) && CODING_COOKIE.test(second))
    header = 2;
  return Math.max(line, header + 1);
}

function missingManifest(): CmdResult {
  return {
    output:
      '# Code-KG Apply Backlinks\n\n.code-kg/materialization-manifest.json is missing.',
    isError: true,
  };
}

type BacklinkTarget = {
  span: SourceSpan;
  /** Content hash the span's line numbers were taken from. */
  baseline: string | undefined;
  anchored: boolean;
};

function anchoredTargets(
  section: ManifestSection,
  graph: ProjectGraph | null,
  skips: BacklinkSkip[],
): BacklinkTarget[] {
  if (sourceAnchorPolicy(section) !== 'edit-safe' || !graph) return [];
  const targets: BacklinkTarget[] = [];
  for (const anchor of section.source_anchors ?? []) {
    const node = graph.nodes.find((n) => n.id === anchor.node_id);
    const span = node && anchorSpan(node);
    if (!span) {
      skips.push({
        file: anchor.file,
        reason: `skipped ${anchorName(anchor)}: section ${section.stable_id} is anchored to it, but it no longer exists in the source; re-anchor the section with code-kg anchor`,
      });
      continue;
    }
    targets.push({
      span,
      baseline: graph.source_hashes?.[span.file],
      anchored: true,
    });
  }
  return targets;
}

async function backlinkPlan(
  ctx: CmdContext,
  manifest: MaterializationManifest,
): Promise<BacklinkPlan> {
  const insertions: BacklinkInsertion[] = [];
  const skips: BacklinkSkip[] = [];
  const seen = new Set<string>();
  const active = Object.values(manifest.sections).filter(
    (section) =>
      section.status !== 'suppressed' && section.status !== 'orphaned',
  );
  const graph = active.some((section) => section.source_anchors?.length)
    ? await freshGraph(ctx.projectRoot)
    : null;

  for (const section of active) {
    const targets = [
      ...backlinkAnchorsForSection(section).map((span) => ({
        span,
        baseline: section.source_hashes?.[span.file],
        anchored: false,
      })),
      ...anchoredTargets(section, graph, skips),
    ].sort((a, b) =>
      a.span.file === b.span.file
        ? a.span.start_line - b.span.start_line
        : a.span.file.localeCompare(b.span.file),
    );
    for (const { span, baseline, anchored } of targets) {
      const pathReason = skippedPathReason(span.file);
      if (pathReason) {
        skips.push({ file: span.file, reason: pathReason });
        continue;
      }

      const prefix = commentPrefix(span.file);
      if (!prefix) {
        skips.push({
          file: span.file,
          reason: `skipped unsupported file ${span.file}`,
        });
        continue;
      }

      const target = await projectFile(ctx.projectRoot, span.file);
      if (!target) {
        skips.push({
          file: span.file,
          reason: `skipped path outside the project root ${span.file}`,
        });
        continue;
      }
      if (!existsSync(target)) {
        skips.push({
          file: span.file,
          reason: `skipped missing file ${span.file}`,
        });
        continue;
      }

      const comment = `${prefix} @lat: [[${section.public_section_id}]]`;
      const key = `${span.file}\0${comment}`;
      if (seen.has(key)) continue;
      const content = await readFile(target, 'utf-8');
      if (content.includes(`@lat: [[${section.public_section_id}]]`)) {
        continue;
      }

      // Span line numbers are only trustworthy for the content they were
      // recorded against; a stale line can fall inside a string literal.
      const currentHash = sourceHash(content);
      if (!baseline) {
        skips.push({
          file: span.file,
          reason: anchored
            ? `skipped ${span.file}: it is not in the extracted source graph`
            : `skipped ${span.file}: section ${section.stable_id} has no recorded source hash for it, so its span line numbers cannot be verified; record fresh spans or anchor the section with code-kg anchor`,
        });
        continue;
      }
      if (baseline !== currentHash) {
        skips.push({
          file: span.file,
          reason: anchored
            ? `skipped ${span.file}: changed while its symbols were being located; rerun apply-backlinks`
            : `skipped ${span.file}: changed since section ${section.stable_id} recorded its source spans; record fresh spans or anchor the section with code-kg anchor`,
        });
        continue;
      }

      seen.add(key);
      insertions.push({
        file: span.file,
        line: backlinkLine(content, span.start_line),
        comment,
        expectedHash: currentHash,
      });
    }
  }

  insertions.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  return { insertions, skips, graph };
}

function formatPlan(
  plan: Pick<BacklinkPlan, 'insertions' | 'skips'>,
  write: boolean,
): string {
  const lines = ['# Code-KG Apply Backlinks', ''];
  if (plan.insertions.length === 0 && plan.skips.length === 0) {
    lines.push('No backlink changes.');
    return lines.join('\n');
  }

  const verb = write ? 'inserted' : 'would insert';
  lines.push(
    ...plan.insertions.map(
      (entry) => `- ${verb} ${entry.comment} at ${entry.file}:${entry.line}`,
    ),
  );
  lines.push(...plan.skips.map((skip) => `- ${skip.reason}`));
  return lines.join('\n');
}

/**
 * Inserts `comment` as a new line before 1-based `line`, matching that line's
 * indentation and line ending. Every other byte of `content` is preserved.
 */
export function insertCommentLine(
  content: string,
  line: number,
  comment: string,
): string {
  const fileEol = content.includes('\r\n') ? '\r\n' : '\n';
  let offset = 0;
  for (let current = 1; current < line; current++) {
    const newline = content.indexOf('\n', offset);
    if (newline === -1) {
      offset = content.length;
      break;
    }
    offset = newline + 1;
  }
  if (offset >= content.length) {
    const separator = content === '' || content.endsWith('\n') ? '' : fileEol;
    return content + separator + comment + fileEol;
  }
  const lineEnd = content.indexOf('\n', offset);
  const eol =
    lineEnd === -1 ? fileEol : content[lineEnd - 1] === '\r' ? '\r\n' : '\n';
  const indent = /^[ \t]*/.exec(content.slice(offset))?.[0] ?? '';
  return (
    content.slice(0, offset) + indent + comment + eol + content.slice(offset)
  );
}

/**
 * An inserted comment changes the hash of an anchored file, and of an anchored
 * symbol whose body contains it. Anchors reviewed against the pre-insert
 * content move to the new hash, as span baselines do.
 */
async function rehashAnchors(
  ctx: CmdContext,
  manifest: MaterializationManifest,
  before: ProjectGraph | null,
  files: Set<string>,
): Promise<void> {
  const anchors = Object.values(manifest.sections)
    .flatMap((section) => section.source_anchors ?? [])
    .filter((anchor) => files.has(anchor.file));
  if (!before || !anchors.length) return;
  const hashes = (graph: ProjectGraph) =>
    new Map(graph.nodes.map((node) => [node.id, node.body_hash]));
  const previous = hashes(before);
  const next = hashes(await freshGraph(ctx.projectRoot));
  for (const anchor of anchors) {
    const hash = next.get(anchor.node_id);
    if (hash && anchor.hash === previous.get(anchor.node_id))
      anchor.hash = hash;
  }
}

async function writeInsertions(
  ctx: CmdContext,
  manifest: MaterializationManifest,
  insertions: BacklinkInsertion[],
  graph: ProjectGraph | null,
): Promise<{ written: BacklinkInsertion[]; skips: BacklinkSkip[] }> {
  const written: BacklinkInsertion[] = [];
  const skips: BacklinkSkip[] = [];
  const rehashed = new Map<
    string,
    { before: string; after: string; lines: number[] }
  >();
  const byFile = new Map<string, BacklinkInsertion[]>();
  for (const insertion of insertions) {
    if (!byFile.has(insertion.file)) byFile.set(insertion.file, []);
    byFile.get(insertion.file)!.push(insertion);
  }

  for (const [file, fileInsertions] of byFile) {
    const target = await projectFile(ctx.projectRoot, file);
    if (!target || !existsSync(target)) {
      skips.push({
        file,
        reason: `skipped ${file}: it moved or now resolves outside the project root`,
      });
      continue;
    }
    const content = await readFile(target, 'utf-8');
    const before = sourceHash(content);
    if (fileInsertions.some((entry) => entry.expectedHash !== before)) {
      skips.push({
        file,
        reason: `skipped ${file}: changed while backlinks were being applied`,
      });
      continue;
    }
    const pending = fileInsertions
      .filter((entry) => !content.includes(entry.comment))
      .sort((a, b) => b.line - a.line);

    let next = content;
    for (const insertion of pending) {
      next = insertCommentLine(next, insertion.line, insertion.comment);
      written.push(insertion);
    }

    if (pending.length > 0) {
      await writeFile(target, next, 'utf-8');
      rehashed.set(file, {
        before,
        after: sourceHash(next),
        lines: pending.map((entry) => entry.line),
      });
    }
  }

  // The inserted comments are the only change to these files, so a section
  // whose baseline matched the pre-insert content stays valid once its spans
  // move down past the inserted lines. Its hash must not move without them.
  if (rehashed.size > 0) {
    for (const section of Object.values(manifest.sections)) {
      for (const [file, { before, after, lines }] of rehashed) {
        if (section.source_hashes?.[file] !== before) continue;
        section.source_hashes[file] = after;
        for (const span of section.source_spans ?? []) {
          if (span.file !== file) continue;
          const shift = (at: number) =>
            lines.filter((line) => line <= at).length;
          span.end_line += shift(span.end_line);
          span.start_line += shift(span.start_line);
        }
      }
    }
    await rehashAnchors(ctx, manifest, graph, new Set(rehashed.keys()));
    await writeJsonAtomic(manifestPath(ctx), manifest, 2);
  }

  written.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  return { written, skips };
}

// @lat: [[lat.md/concepts#Concepts#Source Anchor Policies]]
export async function applyBacklinksCommand(
  ctx: CmdContext,
  opts: ApplyBacklinksOptions,
): Promise<CmdResult> {
  if (!existsSync(manifestPath(ctx))) return missingManifest();

  const manifest = await readManifest(ctx);
  const plan = await backlinkPlan(ctx, manifest);
  if (!opts.write) {
    return { output: formatPlan(plan, false), isError: false };
  }

  const { written, skips } = await writeInsertions(
    ctx,
    manifest,
    plan.insertions,
    plan.graph,
  );
  return {
    output: formatPlan(
      { insertions: written, skips: [...plan.skips, ...skips] },
      true,
    ),
    isError: false,
  };
}
