import _ from 'lodash';

import {
  DefineNode,
  InitializeNode,
  SpawnNode,
  TransformNode,
  TurnNode,
} from './nodes';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_REPEAT = 1;

interface IPathVia {
  states: string[];
  turn?: PathTurn;
  spawns?: PathSpawn[];
}

interface PathInitialize extends IPathVia {
  node: InitializeNode;
}

interface PathSpawn extends IPathVia {
  node: SpawnNode;
}

interface PathTurn extends IPathVia {
  node: TurnNode;
}

type PathStart = PathInitialize | PathSpawn;

type PathVia = PathInitialize | PathSpawn | PathTurn;

interface SearchPathContext {
  depth: number;
  repeatCountMap: Map<number, number>;
  parentPathStart: PathStart;
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

    let defineSpawnedTests = (
      pathSpawns: PathSpawn[],
      parentTestCaseId: string,
      contextGetter: () => unknown,
    ): void => {
      for (let [index, pathSpawn] of pathSpawns.entries()) {
        let {node: spawnNode, states: spawnStates} = pathSpawn;
        let {
          turns: pathTurns,
          spawns: nextPathSpawns,
        } = getPathTurnsAndNextSpawns(pathSpawn);

        let spawnedTestCaseId = `${parentTestCaseId}.${index + 1}`;

        describe(`Test Case ${spawnedTestCaseId}`, () => {
          let context: unknown;

          test(spawnNode.description, async () => {
            let parentContext = contextGetter();

            context = await spawnNode.transform(parentContext);

            if (
              typeof context === 'object' &&
              context &&
              context === parentContext
            ) {
              throw new Error(
                'Spawned context is not expected to have the same reference as the parent context',
              );
            }

            await this.testStates(context, spawnStates);

            await spawnNode.test(context);
          });

          for (let {node: turnNode, states: turnStates} of pathTurns) {
            test(turnNode.description, async () => {
              context = await turnNode.transform(context);

              await this.testStates(context, turnStates);

              await turnNode.test(context);
            });
          }

          if (nextPathSpawns) {
            defineSpawnedTests(
              nextPathSpawns,
              spawnedTestCaseId,
              () => context,
            );
          }
        });
      }
    };

    for (let [index, pathInitialize] of paths.entries()) {
      let {node: initializeNode, states: initializeStates} = pathInitialize;
      let {
        turns: pathTurns,
        spawns: nextPathSpawns,
      } = getPathTurnsAndNextSpawns(pathInitialize);

      let testCaseId = `${index + 1}`;

      describe(`Test Case ${testCaseId}`, () => {
        let context: unknown;

        test(initializeNode.description, async () => {
          context = await initializeNode.initialize();

          await this.testStates(context, initializeStates);

          await initializeNode.test(context);
        });

        for (let {node: turnNode, states: turnStates} of pathTurns) {
          test(turnNode.description, async () => {
            context = await turnNode.transform(context);

            await this.testStates(context, turnStates);

            await turnNode.test(context);
          });
        }

        if (nextPathSpawns) {
          defineSpawnedTests(nextPathSpawns, testCaseId, () => context);
        }
      });
    }
  }

  search(): PathInitialize[] {
    let pathInitializes: PathInitialize[] = [];

    for (let initializeNode of this.initializeNodes) {
      let states = initializeNode.states;

      let pathInitialize: PathInitialize = {
        node: initializeNode,
        states,
      };

      this.searchNext(states, pathInitializes, {
        depth: 0,
        repeatCountMap: new Map(),
        parentPathStart: pathInitialize,
      });
    }

    return pathInitializes;
  }

  private searchNext(
    states: string[],
    currentPathStarts: PathStart[],
    {depth, repeatCountMap, parentPathStart}: SearchPathContext,
  ): void {
    if (depth >= this.maxDepth) {
      currentPathStarts.push(parentPathStart);
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
        // from states not matching
        continue;
      }

      let pathStarts: PathStart[];
      let pathStart: PathStart;

      if (transformNode instanceof TurnNode) {
        pathStarts = currentPathStarts;

        pathStart = clonePath(parentPathStart);

        getPathEnd(pathStart).turn = {
          node: transformNode,
          states: transformedStates,
        };
      } else {
        if (!currentPathStarts.includes(parentPathStart)) {
          currentPathStarts.push(parentPathStart);
        }

        let parentPathEnd = getPathEnd(parentPathStart);

        pathStarts = parentPathEnd.spawns || (parentPathEnd.spawns = []);

        pathStart = {
          node: transformNode,
          states: transformedStates,
        };
      }

      this.searchNext(transformedStates, pathStarts, {
        depth: depth + 1,
        repeatCountMap: new Map([...repeatCountMap, [id, count]]),
        parentPathStart: pathStart,
      });

      if (!hasTransformation) {
        hasTransformation = true;
      }
    }

    if (!hasTransformation) {
      currentPathStarts.push(parentPathStart);
    }
  }

  private async testStates(context: unknown, states: string[]): Promise<void> {
    let defineNodeMap = this.defineNodeMap;

    for (let state of states) {
      let defineNode = defineNodeMap.get(state);

      if (!defineNode) {
        continue;
      }

      let {testHandler} = defineNode;

      if (!testHandler) {
        continue;
      }

      await testHandler(context);
    }
  }
}

function clonePath<T extends PathStart>(pathStart: T): T {
  return _.cloneDeepWith(pathStart, value => {
    if (Array.isArray(value) || _.isPlainObject(value)) {
      return undefined;
    } else {
      return value;
    }
  });
}

function getPathEnd(pathStart: PathStart): PathVia {
  let via: PathVia = pathStart;

  while (via.turn) {
    via = via.turn;
  }

  return via;
}

interface PathTurnsAndNextSpawns {
  turns: PathTurn[];
  spawns: PathSpawn[] | undefined;
}

function getPathTurnsAndNextSpawns(
  pathStart: PathStart,
): PathTurnsAndNextSpawns {
  let turns: PathTurn[] = [];

  let via: PathVia = pathStart;

  while (via.turn) {
    via = via.turn;

    turns.push(via);
  }

  return {
    turns,
    spawns: via.spawns,
  };
}
