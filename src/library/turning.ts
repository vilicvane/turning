import {
  DefineNode,
  InitializeNode,
  SpawnNode,
  TransformNode,
  TurnNode,
} from './nodes';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_REPEAT = 1;

interface StackFrame<T> {
  target: T;
  node: TransformNode;
}

interface SearchContext {
  pathsCount: number;
}

export interface ITurningState {
  name: string;
}

export interface TurningOptions {
  maxDepth?: number;
  maxRepeat?: number;
}

export class Turning<TState extends ITurningState> {
  private defineNodeMap = new Map<string, DefineNode>();

  private initializeNodes: InitializeNode[] = [];
  private transformNodes: TransformNode[] = [];

  private maxDepth: number;
  private maxRepeat: number;

  constructor({
    maxDepth = DEFAULT_MAX_DEPTH,
    maxRepeat = DEFAULT_MAX_REPEAT,
  }: TurningOptions = {}) {
    this.maxDepth = maxDepth;
    this.maxRepeat = maxRepeat;
  }

  define<TStateName extends TState['name']>(
    state: TStateName,
  ): DefineNode<Extract<TState, {name: TStateName}>> {
    let node = new DefineNode(state);
    this.defineNodeMap.set(state, node);
    return node as any;
  }

  initialize<TStateNameTuple extends TState['name'][]>(
    ...states: TStateNameTuple
  ): InitializeNode<
    {
      [TIndex in keyof TStateNameTuple]: Extract<
        TState,
        {name: TStateNameTuple[TIndex]}
      >
    }
  > {
    let node = new InitializeNode(new Set(states));
    this.initializeNodes.push(node);
    return node as any;
  }

  turn<TStateNameTuple extends TState['name'][]>(
    ...states: TStateNameTuple
  ): TurnNode<
    TState,
    {
      [TIndex in keyof TStateNameTuple]: Extract<
        TState,
        {name: TStateNameTuple[TIndex]}
      >
    }
  > {
    let node = new TurnNode(new Set(states));
    this.transformNodes.push(node);
    return node as any;
  }

  spawn<TStateNameTuple extends TState['name'][]>(
    ...states: TStateNameTuple
  ): SpawnNode<TState> {
    let node = new SpawnNode<TState>(new Set(states));
    this.transformNodes.push(node);
    return node;
  }

  start(): void {}

  search(): void {
    let context: SearchContext = {
      pathsCount: 0,
    };

    for (let initNode of this.initializeNodes) {
      let states = initNode.stateSet;
      console.log();
      console.log(initNode.description);
      this.next(states, [], context);
    }

    console.log();
    console.log(`Found ${context.pathsCount} possible paths.`);
  }

  private next(
    states: Set<string>,
    stack: StackFrame<TState>[],
    context: SearchContext,
  ): void {
    if (stack.length > this.maxDepth) {
      context.pathsCount++;
      return;
    }

    let hasTransformation = false;

    for (let transformNode of this.transformNodes) {
      let transformedStates = transformNode.transform(states);

      if (!transformedStates) {
        continue;
      }

      let frame: StackFrame<TState> = {
        target: undefined!,
        node: transformNode,
      };

      console.log(
        Array(stack.length + 2).join('  ') + transformNode.description,
      );

      this.next(transformedStates, stack.concat(frame), context);

      if (!hasTransformation) {
        hasTransformation = true;
      }
    }

    if (!hasTransformation) {
      context.pathsCount++;
    }
  }
}
