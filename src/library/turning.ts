import _ from 'lodash';

import {
  DefineNode,
  InitializeNode,
  PathNode,
  ResultNode,
  SpawnNode,
  TransformNode,
  TransformStateMatchingOptions,
  TurnNode,
} from './nodes';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_REPEAT = 1;

interface IPathVia {
  caseNameOnEnd: string | undefined;
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
  searchCases: SearchCase[];
}

interface SearchCase {
  name: string;
  rest: PathNode[];
}

export type GeneralCaseNode<TContext = unknown> = string | ResultNode<TContext>;

export interface ITurningTestAdapter {
  describe(name: string, callback: () => void): void;
  test(name: string, callback: () => Promise<void>): void;
}

export interface TurningOptions {
  maxDepth?: number;
  maxRepeat?: number;
}

export class Turning<TContext> {
  private defineNodeMap = new Map<string, DefineNode<TContext>>();

  private initializeNodes: InitializeNode<TContext>[] = [];
  private transformNodes: TransformNode<TContext>[] = [];

  private nameToGeneralCasePathNodesMap = new Map<string, GeneralCaseNode[]>();

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

  turn(
    states: string[],
    {includes = [], excludes = []}: TransformStateMatchingOptions = {},
  ): TurnNode<TContext> {
    let node = new TurnNode<TContext>(states, includes, excludes);
    this.transformNodes.push(node);
    return node;
  }

  spawn(
    states: string[],
    {includes = [], excludes = []}: TransformStateMatchingOptions = {},
  ): SpawnNode<TContext> {
    let node = new SpawnNode<TContext>(states, includes, excludes);
    this.transformNodes.push(node);
    return node;
  }

  case(name: string, nodes: GeneralCaseNode<TContext>[]): void {
    let nameToGeneralCasePathNodesMap = this.nameToGeneralCasePathNodesMap;

    if (nameToGeneralCasePathNodesMap.has(name)) {
      throw new Error(`Case name "${name}" has already been taken`);
    }

    nameToGeneralCasePathNodesMap.set(name, nodes);
  }

  test(): void {
    let pathInitializes = this.search();

    let {describe, test} = this.testAdapter;

    let defineNextTests = (
      pathStarts: PathStart[],
      parentTestCaseId?: string,
      contextGetter?: () => unknown,
    ): void => {
      for (let [index, pathStart] of pathStarts.entries()) {
        let {
          caseNameOnEnd: startCaseNameOnEnd,
          node: startNode,
          states: startStates,
        } = pathStart;
        let {
          turns: pathTurns,
          spawns: nextPathSpawns,
        } = getPathTurnsAndNextSpawns(pathStart);

        let testCaseId = `${
          parentTestCaseId ? `${parentTestCaseId}.` : ''
        }${index + 1}`;

        let describeName = `Test Case ${testCaseId}`;

        describe(describeName, () => {
          let context: unknown;

          test(
            appendCaseNameOnEnd(startNode.description, startCaseNameOnEnd),
            async () => {
              if (startNode instanceof InitializeNode) {
                context = await startNode.initialize();
              } else {
                let parentContext = contextGetter!();

                context = await startNode.transform(parentContext);

                if (
                  typeof context === 'object' &&
                  context &&
                  context === parentContext
                ) {
                  throw new Error(
                    'Spawned context is not expected to have the same reference as the parent context',
                  );
                }
              }

              await this.testStates(context, startStates);

              await startNode.test(context);
            },
          );

          for (let {
            caseNameOnEnd: turnCaseNameOnEnd,
            node: turnNode,
            states: turnStates,
          } of pathTurns) {
            test(
              appendCaseNameOnEnd(turnNode.description, turnCaseNameOnEnd),
              async () => {
                context = await turnNode.transform(context);

                await this.testStates(context, turnStates);

                await turnNode.test(context);
              },
            );
          }

          if (nextPathSpawns) {
            defineNextTests(nextPathSpawns, testCaseId, () => context);
          }
        });
      }
    };

    defineNextTests(pathInitializes);
  }

  search(): PathInitialize[] {
    let pathInitializes: PathInitialize[] = [];

    let searchCases = this.buildSearchCases();

    for (let initializeNode of this.initializeNodes) {
      let nextSearchCases = removeAndGetMatchingRestSearchCases(
        searchCases,
        initializeNode,
      );

      let states = initializeNode.states;

      let pathInitialize: PathInitialize = {
        caseNameOnEnd: getCaseNameOnEnd(nextSearchCases),
        node: initializeNode,
        states,
      };

      this.searchNext(states, pathInitializes, {
        depth: 0,
        repeatCountMap: new Map(),
        parentPathStart: pathInitialize,
        searchCases: nextSearchCases,
      });
    }

    assertEmptySearchCases(searchCases, true);

    return pathInitializes;
  }

  private buildSearchCases(): SearchCase[] {
    let aliasToPathNodeMap = new Map<string, PathNode>();

    for (let pathNode of [...this.initializeNodes, ...this.transformNodes]) {
      if (pathNode._alias) {
        aliasToPathNodeMap.set(pathNode._alias, pathNode);
      }
    }

    let searchCases: SearchCase[] = [];

    for (let [name, generalCasePathNodes] of this
      .nameToGeneralCasePathNodesMap) {
      let pathNodes: PathNode[] = [];

      for (let generalCasePathNode of generalCasePathNodes) {
        let pathNode: PathNode;

        if (typeof generalCasePathNode === 'string') {
          let aliasedPathNode = aliasToPathNodeMap.get(generalCasePathNode);

          if (!aliasedPathNode) {
            throw new Error(`Unknown node alias "${generalCasePathNode}"`);
          }

          pathNode = aliasedPathNode;
        } else {
          pathNode = generalCasePathNode.node;
        }

        pathNodes.push(pathNode);
      }

      searchCases.push({
        name,
        rest: pathNodes,
      });
    }

    return searchCases;
  }

  private searchNext(
    states: string[],
    currentPathStarts: PathStart[],
    {depth, repeatCountMap, parentPathStart, searchCases}: SearchPathContext,
  ): void {
    let defineNodeMap = this.defineNodeMap;

    for (let state of states) {
      if (!defineNodeMap.has(state)) {
        throw new Error(`State "${state}" is not defined`);
      }
    }

    let hasTransformation = false;

    for (let transformNode of this.transformNodes) {
      let id = transformNode.id;
      let repeatCount = repeatCountMap.get(id) || 0;

      let transformedStates = transformNode.transformStates(states);

      if (!transformedStates) {
        // from states not matching
        continue;
      }

      let nextSearchCases = removeAndGetMatchingRestSearchCases(
        searchCases,
        transformNode,
      );

      if (
        !nextSearchCases.length &&
        (depth >= this.maxDepth || repeatCount >= this.maxRepeat)
      ) {
        continue;
      }

      repeatCount++;

      let pathStarts: PathStart[];
      let pathStart: PathStart;

      let caseNameOnEnd = getCaseNameOnEnd(nextSearchCases);

      if (transformNode instanceof TurnNode) {
        pathStarts = currentPathStarts;

        pathStart = clonePath(parentPathStart);

        getPathEnd(pathStart).turn = {
          caseNameOnEnd,
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
          caseNameOnEnd,
          node: transformNode,
          states: transformedStates,
        };
      }

      this.searchNext(transformedStates, pathStarts, {
        depth: depth + 1,
        repeatCountMap: new Map([...repeatCountMap, [id, repeatCount]]),
        parentPathStart: pathStart,
        searchCases: nextSearchCases,
      });

      if (!hasTransformation) {
        hasTransformation = true;
      }
    }

    assertEmptySearchCases(searchCases, false);

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

function removeAndGetMatchingRestSearchCases(
  searchCases: SearchCase[],
  node: PathNode,
): SearchCase[] {
  _.remove(searchCases, searchCase => !searchCase.rest.length);

  return _.remove(searchCases, searchCase => searchCase.rest[0] === node).map(
    ({name, rest}) => {
      return {
        name,
        rest: rest.slice(1),
      };
    },
  );
}

function assertEmptySearchCases(
  searchCases: SearchCase[],
  initialize: boolean,
): void {
  if (!searchCases.length) {
    return;
  }

  throw new Error(
    `Invalid manual cases:\n${searchCases
      .map(
        searchCase =>
          `  ${searchCase.name}: ${[
            ...(initialize ? [] : ['...']),
            ...searchCase.rest.map(node => node._alias || `[node ${node.id}]`),
          ].join(' -> ')}`,
      )
      .join('\n')}`,
  );
}

function getCaseNameOnEnd(searchCases: SearchCase[]): string | undefined {
  let searchCaseOnEnd = searchCases.find(searchCase => !searchCase.rest.length);
  return searchCaseOnEnd && searchCaseOnEnd.name;
}

function appendCaseNameOnEnd(
  description: string,
  caseNameOnEnd: string | undefined,
): string {
  return `${description}${caseNameOnEnd ? ` <${caseNameOnEnd}>` : ''}`;
}
