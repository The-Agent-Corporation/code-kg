/** Budgets for short display previews and complete source explanations. */

/** Max characters for a section's leading paragraph (excluding [[wiki links]]). */
export const LEADING_PARAGRAPH_MAX = 250;

/** Preview generation is separate from the full source-description budget. */
export const PREVIEW_MAX_TOKENS = 512;

export function sourceSummaryMaxTokens(): number {
  const value = process.env.CODEKG_SUMMARY_MAX_TOKENS?.trim();
  const tokens = value ? Number(value) : 2048;
  if (!Number.isInteger(tokens) || tokens < 512 || tokens > 16384)
    throw new Error(
      'CODEKG_SUMMARY_MAX_TOKENS must be an integer between 512 and 16384.',
    );
  return tokens;
}

/** A display excerpt only; the complete description is retained separately. */
export function descriptionPreview(description: string): string {
  const opening = description
    .split(/\r?\n\s*\r?\n/, 1)[0]
    .replace(/\s+/g, ' ')
    .trim();
  if (bodyTextLength(opening) <= LEADING_PARAGRAPH_MAX) return opening;
  const excerpt = opening.slice(0, LEADING_PARAGRAPH_MAX - 1);
  const boundary = Math.max(excerpt.lastIndexOf(' '), excerpt.lastIndexOf(','));
  return (boundary > 40 ? excerpt.slice(0, boundary) : excerpt).trimEnd() + '…';
}

/** Count body text length excluding `[[...]]` wiki link markers and content. */
export function bodyTextLength(body: string): number {
  return body.replace(/\[\[[^\]]*\]\]/g, '').length;
}

/**
 * Clamp prose to the leading-paragraph budget used by `code-kg check`.
 * Prefer cutting at a word boundary; always stay ≤ max measured length.
 */
export function clampLeadingParagraph(
  text: string,
  max = LEADING_PARAGRAPH_MAX,
): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (bodyTextLength(trimmed) <= max) return trimmed;

  let candidate = trimmed;
  while (bodyTextLength(candidate) > max && candidate.length > 0) {
    const cutAt = Math.min(candidate.length, max);
    const slice = candidate.slice(0, cutAt);
    const boundary = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','));
    candidate = (boundary > 40 ? slice.slice(0, boundary) : slice).trim();
    if (candidate.endsWith(',') || candidate.endsWith(';')) {
      candidate = candidate.slice(0, -1).trim();
    }
  }
  if (!candidate.endsWith('.')) candidate = `${candidate}.`;
  while (bodyTextLength(candidate) > max && candidate.length > 1) {
    candidate = candidate.slice(0, -1).trim();
    if (!candidate.endsWith('.')) candidate = `${candidate}.`;
  }
  return candidate;
}
