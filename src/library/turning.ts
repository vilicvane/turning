import {
  DefineNode,
  InitializeNode,
  SpawnNode,
  TransformNode,
  TurnNode,
} from './nodes';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_REPEAT = 2;

interface SearchPathContext {
  initializeNode: InitializeNode;
  transformNodes: TransformNode[];
  repeatCountMap: Map<number, number>;
}

interface Path {
  initializeNode: InitializeNode;
  transformNodes: TransformNode[];
}

interface SearchContext {
  paths: Path[];
}

export interface ITurningTestAdapter {
  describe(name: string, callback: () => void): void;
  test(name: string, callback: () => Promise<void>): void;
}

export interface TurningOptions {
  maxDepth?: number;
  maxRepeat?: number;
}

export class Turning<TContext> {
  private defineNodeMap = new Map<string, DefineNode>();

  private initializeNodes: InitializeNode[] = [];
  private transformNodes: TransformNode[] = [];

  private maxDepth: number;
  private maxRepeat: number;

  constructor(
    private testAdapter: ITurningTestAdapter,
    {
      maxDepth = DEFAULT_MAX_DEPTH,
      maxRepeat = DEFAULT_MAX_REPEAT,
    }: TurningOptions = {},
  ) {
    this.maxDepth = maxDepth;
    this.maxRepeat = maxRepeat;
  }

  define(state: string): DefineNode<TContext> {
    let node = new DefineNode<TContext>(state);
    this.defineNodeMap.set(state, node);
    return node;
  }

  initialize(states: string[]): InitializeNode<TContext> {
    let node = new InitializeNode<TContext>(states);
    this.initializeNodes.push(node);
    return node;
  }

  turn(states: string[]): TurnNode<TContext> {
    let node = new TurnNode<TContext>(states);
    this.transformNodes.push(node);
    return node;
  }

  spawn(states: string[]): SpawnNode<TContext> {
    let node = new SpawnNode<TContext>(states);
    this.transformNodes.push(node);
    return node;
  }

  ensure(..._statesList: string[][]): void {}

  test(): void {
    let paths = this.search();

    let {describe, test} = this.testAdapter;

    for (let [index, {initializeNode, transformNodes}] of paths.entries()) {
      describe(`Test Case #${index + 1}`, () => {
        let context: unknown;

        test(initializeNode.description, async () => {
          context = await initializeNode.initialize();
          await initializeNode.test(context);
        });

        for (let transformNode of transformNodes) {
          test(transformNode.description, async () => {
            context = await transformNode.transform(context);
            await transformNode.test(context);
          });
        }
      });
    }
  }

  search(): Path[] {
    let searchContext: SearchContext = {
      paths: [],
    };

    for (let initializeNode of this.initializeNodes) {
      let states = initializeNode.states;

      console.info();
      console.info(initializeNode.description);

      this.searchNext(
        states,
        {
          initializeNode,
          transformNodes: [],
          repeatCountMap: new Map(),
        },
        searchContext,
      );
    }

    let {paths} = searchContext;

    console.info();
    console.info(`Found ${paths.length} possible paths.`);

    return paths;
  }

  private searchNext(
    states: string[],
    {initializeNode, transformNodes, repeatCountMap}: SearchPathContext,
    searchContext: SearchContext,
  ): void {
    if (transformNodes.length > this.maxDepth) {
      searchContext.paths.push({
        initializeNode,
        transformNodes,
      });
      return;
    }

    let hasTransformation = false;

    for (let transformNode of this.transformNodes) {
      let id = transformNode.id;
      let count = repeatCountMap.get(id) || 0;

      if (count >= this.maxRepeat) {
        continue;
      }

      count++;

      let transformedStates = transformNode.transformStates(states);

      if (!transformedStates) {
        continue;
      }

      console.info(
        Array(transformNodes.length + 2).join('  ') + transformNode.description,
      );

      this.searchNext(
        transformedStates,
        {
          initializeNode,
          transformNodes: [...transformNodes, transformNode],
          repeatCountMap: new Map([...repeatCountMap, [id, count]]),
        },
        searchContext,
      );

      if (!hasTransformation) {
        hasTransformation = true;
      }
    }

    if (!hasTransformation) {
      searchContext.paths.push({
        initializeNode,
        transformNodes,
      });
    }
  }
}
