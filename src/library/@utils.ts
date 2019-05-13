export function pairwise<T>(array: T[]): [T, T][] {
  return array
    .slice(0, -1)
    .map((current, index) => [current, array[index + 1]]);
}
