import { existsSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { backlinkAnchorsForSection } from './anchors.js';
import { sourceHash } from './structural.js';
import type { MaterializationManifest } from './types.js';

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

/** Resolves a manifest-relative path, refusing anything outside the project. */
async function projectFile(root: string, file: string): Promise<string | null> {
  if (isAbsolute(file)) return null;
  const target = resolve(root, file);
  if (!isInside(root, target)) return null;
  if (!existsSync(target)) return target;
  const [realRoot, realTarget] = await Promise.all([
    realpath(root),
    realpath(target),
  ]);
  return isInside(realRoot, realTarget) ? target : null;
}

function missingManifest(): CmdResult {
  return {
    output:
      '# Code-KG Apply Backlinks\n\n.code-kg/materialization-manifest.json is missing.',
    isError: true,
  };
}

async function backlinkPlan(
  ctx: CmdContext,
  manifest: MaterializationManifest,
): Promise<BacklinkPlan> {
  const insertions: BacklinkInsertion[] = [];
  const skips: BacklinkSkip[] = [];
  const seen = new Set<string>();

  for (const section of Object.values(manifest.sections)) {
    if (section.status === 'suppressed' || section.status === 'orphaned') {
      continue;
    }

    const spans = [...backlinkAnchorsForSection(section)].sort((a, b) =>
      a.file === b.file
        ? a.start_line - b.start_line
        : a.file.localeCompare(b.file),
    );
    for (const span of spans) {
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
      const recordedHash = section.source_hashes?.[span.file];
      const currentHash = sourceHash(content);
      if (!recordedHash) {
        skips.push({
          file: span.file,
          reason: `skipped ${span.file}: section ${section.stable_id} has no recorded source hash for it; review it with \`code-kg review-source ${section.stable_id} --write\` first`,
        });
        continue;
      }
      if (recordedHash !== currentHash) {
        skips.push({
          file: span.file,
          reason: `skipped ${span.file}: changed since section ${section.stable_id} recorded its source spans; review the section and refresh its spans before inserting backlinks`,
        });
        continue;
      }

      seen.add(key);
      insertions.push({
        file: span.file,
        line: span.start_line,
        comment,
        expectedHash: currentHash,
      });
    }
  }

  insertions.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  return { insertions, skips };
}

function formatPlan(plan: BacklinkPlan, write: boolean): string {
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

async function writeInsertions(
  ctx: CmdContext,
  manifest: MaterializationManifest,
  insertions: BacklinkInsertion[],
): Promise<{ written: BacklinkInsertion[]; skips: BacklinkSkip[] }> {
  const written: BacklinkInsertion[] = [];
  const skips: BacklinkSkip[] = [];
  const rehashed = new Map<string, { before: string; after: string }>();
  const byFile = new Map<string, BacklinkInsertion[]>();
  for (const insertion of insertions) {
    if (!byFile.has(insertion.file)) byFile.set(insertion.file, []);
    byFile.get(insertion.file)!.push(insertion);
  }

  for (const [file, fileInsertions] of byFile) {
    const target = join(ctx.projectRoot, file);
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
      rehashed.set(file, { before, after: sourceHash(next) });
    }
  }

  // The inserted comments are the only change to these files, so sections
  // whose baseline matched the pre-insert content stay in sync.
  if (rehashed.size > 0) {
    for (const section of Object.values(manifest.sections)) {
      for (const [file, { before, after }] of rehashed) {
        if (section.source_hashes?.[file] === before) {
          section.source_hashes[file] = after;
        }
      }
    }
    await writeFile(
      manifestPath(ctx),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf-8',
    );
  }

  written.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  return { written, skips };
}

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
  );
  return {
    output: formatPlan(
      { insertions: written, skips: [...plan.skips, ...skips] },
      true,
    ),
    isError: false,
  };
}
