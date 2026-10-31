// Code-KG addition: whether a comment line can go directly above a definition.

/** The node shape shared by tree-sitter's native and web bindings. */
interface SpanNode {
  startIndex: number;
  endIndex: number;
  parent: SpanNode | null;
  descendantForIndex(index: number): SpanNode | null;
}

/**
 * True when nothing that starts on an earlier line, other than the nodes
 * enclosing `def`, runs onto `def`'s first line. A comment line inserted
 * above that line then lands between tokens, never inside a string, comment
 * or other construct that the line continues.
 */
export function clearStart(def: SpanNode, source: string): boolean {
  const lineStart = source.lastIndexOf("\n", def.startIndex - 1) + 1;
  let root = def;
  while (root.parent) root = root.parent;
  for (let node = root.descendantForIndex(lineStart); node; node = node.parent) {
    if (node.startIndex <= def.startIndex && node.endIndex >= def.endIndex) return true;
    if (node.startIndex < lineStart) return false;
  }
  return true;
}
