/** Shared limits for generated lat.md section prose. */

/** Max characters for a section's leading paragraph (excluding [[wiki links]]). */
export const LEADING_PARAGRAPH_MAX = 250;

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
