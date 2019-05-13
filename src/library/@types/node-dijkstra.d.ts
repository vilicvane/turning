declare module 'node-dijkstra' {
  class Graph<TKey> {
    constructor(data: Map<TKey, Map<TKey, number>>);

    path(start: string, end: string): string[] | null;
  }

  export = Graph;
}
