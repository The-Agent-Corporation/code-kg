export type SourceScan = {
  /** The content with comments blanked to spaces; offsets are unchanged. */
  code: string;
  /** String literal ranges `[start, end)`, quotes included, sorted by start. */
  strings: Array<[number, number]>;
};

const HASH_COMMENT_FILE = /\.(?:py|rb|sh|bash|zsh|pl|r)$/i;
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'void',
  'yield',
  'await',
  'delete',
  'new',
  'throw',
]);

function stringEnd(
  content: string,
  start: number,
  quote: string,
  triple: boolean,
  multiline: boolean,
): number {
  const close = triple ? quote.repeat(3) : quote;
  for (let i = start + close.length; i < content.length; i++) {
    const char = content[i];
    if (char === '\\') i++;
    else if (content.startsWith(close, i)) return i + close.length;
    else if (char === '\n' && !multiline && !triple) return -1;
  }
  return -1;
}

function regexAllowed(code: string[], at: number): boolean {
  let end = at - 1;
  while (end >= 0 && /\s/.test(code[end])) end--;
  if (end < 0 || '(,=:[!&|?{};+-*%<>~^'.includes(code[end])) return true;
  let start = end;
  while (start >= 0 && /[\w$]/.test(code[start])) start--;
  return REGEX_AFTER_WORD.has(code.slice(start + 1, end + 1).join(''));
}

function regexEnd(content: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') return -1;
    if (char === '\\') i++;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      while (/[a-z]/i.test(content[i + 1] ?? '')) i++;
      return i + 1;
    }
  }
  return -1;
}

/**
 * Finds comments and string literals well enough to tell code from prose and
 * data. `#` comments and triple quotes for script languages, C-style comments,
 * template literals and regex literals otherwise. Template `${}` bodies are
 * treated as part of the string.
 */
export function scanSource(path: string, content: string): SourceScan {
  const hash = HASH_COMMENT_FILE.test(path);
  const code = content.split('');
  const strings: Array<[number, number]> = [];
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (code[i] !== '\n') code[i] = ' ';
  };
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];
    if (hash ? char === '#' : char === '/' && (next === '/' || next === '*')) {
      const block = !hash && next === '*';
      const close = content.indexOf(block ? '*/' : '\n', i + 2);
      const end = close === -1 ? content.length : block ? close + 2 : close;
      blank(i, end);
      i = end;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const triple = hash && content.startsWith(char.repeat(3), i);
      const end = stringEnd(content, i, char, triple, char === '`');
      if (end !== -1) {
        strings.push([i, end]);
        i = end;
        continue;
      }
    } else if (!hash && char === '/' && regexAllowed(code, i)) {
      const end = regexEnd(content, i);
      if (end !== -1) {
        i = end;
        continue;
      }
    }
    i++;
  }
  return { code: code.join(''), strings };
}

/** The `[start, end)` range of the string literal containing `index`. */
export function stringAt(
  scan: SourceScan,
  index: number,
): [number, number] | undefined {
  let low = 0;
  let high = scan.strings.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [start, end] = scan.strings[middle];
    if (index < start) high = middle - 1;
    else if (index >= end) low = middle + 1;
    else return scan.strings[middle];
  }
  return undefined;
}

/**
 * The end of the parenthesized argument list opening at `open`, skipping
 * strings and comments, or -1 when it never closes.
 */
export function closingParen(scan: SourceScan, open: number): number {
  let depth = 0;
  for (let i = open; i < scan.code.length; i++) {
    const string = stringAt(scan, i);
    if (string) {
      i = string[1] - 1;
      continue;
    }
    if (scan.code[i] === '(') depth++;
    else if (scan.code[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
}
