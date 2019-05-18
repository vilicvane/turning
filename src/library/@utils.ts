const INDENT_TAB_SIZE = 2;

export function pairwise<T>(array: T[]): [T, T][] {
  return array
    .slice(0, -1)
    .map((current, index) => [current, array[index + 1]]);
}

export function indent(text: string, depth: number): string {
  let whitespaces = ' '.repeat(INDENT_TAB_SIZE * depth);
  return text.replace(/^/gm, whitespaces);
}
