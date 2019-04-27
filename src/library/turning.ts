import _ from 'lodash';
import match from 'micromatch';

import {
  DefineNode,
  InitializeNode,
  PathNode,
  SpawnNode,
  TransformNode,
  TransformNodeOptions,
  TurnNode,
} from './nodes';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_REPEAT = 1;

const CONTEXT_SKIPPED: any = {};

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
  remainingDepth: number;
  repeatCountMap: Map<TransformNode, number>;
  parentPathStart: PathStart;
  searchCases: SearchCase[];
  blockedTransformAliasSet: Set<string>;
}

interface SearchCase {
  name: string;
  rest: PathNode[];
}

interface SearchNextOptions {
  maxDepth: number;
  maxRepeat: number;
}

export interface ITurningTestAdapter {
  describe(name: string, callback: () => void): void;
  test(name: string, callback: () => Promise<void>): void;
}

export interface TurningSearchOptions {
  maxDepth?: number;
  maxRepeat?: number;
  allowUnreachable?: boolean;
  verbose?: boolean;
}

export interface TurningTestOptions extends TurningSearchOptions {
  only?: string[];
}

export class Turning<TContext> {
  private defineNodeMap = new Map<string, DefineNode<TContext>>();

  private initializeNodes: InitializeNode<TContext>[] = [];
  private transformNodes: TransformNode<TContext>[] = [];

  private nameToCasePathNodeAliasesMap = new Map<string, string[]>();

  constructor(private testAdapter: ITurningTestAdapter) {}

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
    options: TransformNodeOptions = {},
  ): TurnNode<TContext> {
    let node = new TurnNode<TContext>(states, options);
    this.transformNodes.push(node);
    return node;
  }

  spawn(
    states: string[],
    options: TransformNodeOptions = {},
  ): SpawnNode<TContext> {
    let node = new SpawnNode<TContext>(states, options);
    this.transformNodes.push(node);
    return node;
  }

  case(name: string, aliases: string[]): void {
    let nameToCasePathNodeAliasesMap = this.nameToCasePathNodeAliasesMap;

    if (nameToCasePathNodeAliasesMap.has(name)) {
      throw new Error(`Case name "${name}" has already been taken`);
    }

    nameToCasePathNodeAliasesMap.set(name, aliases);
  }

  test(options?: TurningTestOptions): void;
  test({
    only: onlyTestCaseIds,
    verbose = false,
    ...searchOptions
  }: TurningTestOptions = {}): void {
    let onlyTestCaseIdSet =
      onlyTestCaseIds &&
      new Set(_.flatMap(onlyTestCaseIds, getRelatedTestCaseIds));

    let pathInitializes = this.search(searchOptions);

    let {describe, test} = this.testAdapter;

    let defineNextTests = (
      pathStarts: PathStart[],
      parentTestCaseId?: string,
      contextGetter?: () => unknown,
    ): void => {
      for (let [index, pathStart] of pathStarts.entries()) {
        let {
          turns: pathTurns,
          spawns: nextPathSpawns,
        } = getPathTurnsAndNextSpawns(pathStart);

        let testCaseId = `${
          parentTestCaseId ? `${parentTestCaseId}.` : ''
        }${index + 1}`;

        if (onlyTestCaseIdSet && !onlyTestCaseIdSet.has(testCaseId)) {
          continue;
        }

        let describeName = `Test Case ${testCaseId}`;

        describe(describeName, () => {
          let context: unknown;

          test(buildTestCaseName(pathStart, verbose), async () => {
            if (context === CONTEXT_SKIPPED) {
              return;
            }

            try {
              let {node: startNode, states: startStates} = pathStart;

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
            } catch (error) {
              context = CONTEXT_SKIPPED;

              throw error;
            }
          });

          for (let pathTurn of pathTurns) {
            test(buildTestCaseName(pathTurn, verbose), async () => {
              if (context === CONTEXT_SKIPPED) {
                return;
              }

              try {
                let {node: turnNode, states: turnStates} = pathTurn;

                context = await turnNode.transform(context);

                await this.testStates(context, turnStates);

                await turnNode.test(context);
              } catch (error) {
                context = CONTEXT_SKIPPED;

                throw error;
              }
            });
          }

          if (nextPathSpawns) {
            defineNextTests(nextPathSpawns, testCaseId, () => context);
          }
        });
      }
    };

    defineNextTests(pathInitializes);
  }

  search(options?: TurningSearchOptions): PathInitialize[];
  search({
    maxDepth = DEFAULT_MAX_DEPTH,
    maxRepeat = DEFAULT_MAX_REPEAT,
    allowUnreachable = false,
  }: TurningSearchOptions = {}): PathInitialize[] {
    let searchNextOptions: SearchNextOptions = {
      maxDepth,
      maxRepeat,
    };

    this.validateStatesAndStatePatterns();

    let pathInitializes: PathInitialize[] = [];

    let searchCases = this.buildSearchCases();
    let neverReachedStateSet = new Set(this.defineNodeMap.keys());

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

      this.searchNext(
        states,
        pathInitializes,
        neverReachedStateSet,
        {
          depth: 0,
          remainingDepth: initializeNode._depth || Infinity,
          repeatCountMap: new Map(),
          parentPathStart: pathInitialize,
          searchCases: nextSearchCases,
          blockedTransformAliasSet: new Set(
            initializeNode.blockedTransformAliases,
          ),
        },
        searchNextOptions,
      );
    }

    assertEmptySearchCases(searchCases, true);

    if (!allowUnreachable) {
      assertNoUnreachableStates(neverReachedStateSet);
    }

    let unreachableTransformNodes = this.transformNodes.filter(
      node => !node.reached,
    );

    assertNoUnreachableTransforms(unreachableTransformNodes);

    return pathInitializes;
  }

  private validateStatesAndStatePatterns(): void {
    let stateSet = new Set<string>();
    let statePatternSet = new Set<string>();

    for (let initializeNode of this.initializeNodes) {
      for (let state of initializeNode.states) {
        stateSet.add(state);
      }
    }

    for (let transformNode of this.transformNodes) {
      for (let state of transformNode.newStates) {
        stateSet.add(state);
      }

      for (let statePattern of [
        ...transformNode.obsoleteStatePatterns,
        ...transformNode.relatedStatePatterns,
      ]) {
        statePatternSet.add(statePattern);
      }
    }

    let definedStates = Array.from(this.defineNodeMap.keys());
    let definedStateSet = new Set(definedStates);

    for (let state of stateSet) {
      if (!definedStateSet.has(state)) {
        throw new Error(`State "${state}" is not defined`);
      }
    }

    for (let statePattern of statePatternSet) {
      if (match(definedStates, statePattern).length === 0) {
        throw new Error(
          `State pattern "${statePattern}" does not match any of the states defined`,
        );
      }
    }
  }

  private buildSearchCases(): SearchCase[] {
    let aliasToPathNodeMap = new Map<string, PathNode>();

    for (let pathNode of [...this.initializeNodes, ...this.transformNodes]) {
      if (pathNode._alias) {
        aliasToPathNodeMap.set(pathNode._alias, pathNode);
      }
    }

    let searchCases: SearchCase[] = [];

    for (let [name, aliases] of this.nameToCasePathNodeAliasesMap) {
      let pathNodes: PathNode[] = [];

      for (let alias of aliases) {
        let pathNode = aliasToPathNodeMap.get(alias);

        if (!pathNode) {
          throw new Error(`Unknown node alias "${alias}"`);
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
    neverReachedStateSet: Set<string>,
    {
      depth,
      remainingDepth,
      repeatCountMap,
      parentPathStart,
      searchCases,
      blockedTransformAliasSet,
    }: SearchPathContext,
    options: SearchNextOptions,
  ): void {
    for (let state of states) {
      neverReachedStateSet.delete(state);
    }

    let hasTransformation = false;

    for (let transformNode of this.transformNodes) {
      let alias = transformNode._alias;

      if (alias && blockedTransformAliasSet.has(alias)) {
        continue;
      }

      let transformedStates = transformNode.transformStates(states);

      if (!transformedStates) {
        continue;
      }

      let nextSearchCases = removeAndGetMatchingRestSearchCases(
        searchCases,
        transformNode,
      );

      let repeatCount = repeatCountMap.get(transformNode) || 0;

      if (
        !nextSearchCases.length &&
        (depth >= options.maxDepth ||
          remainingDepth <= 0 ||
          repeatCount >= options.maxRepeat)
      ) {
        continue;
      }

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

      this.searchNext(
        transformedStates,
        pathStarts,
        neverReachedStateSet,
        {
          depth: depth + 1,
          remainingDepth: transformNode._depth || remainingDepth - 1,
          repeatCountMap: new Map([
            ...repeatCountMap,
            [transformNode, repeatCount + 1],
          ]),
          parentPathStart: pathStart,
          searchCases: nextSearchCases,
          blockedTransformAliasSet: new Set([
            ...blockedTransformAliasSet,
            ...(transformNode.blockedTransformAliases || []),
          ]),
        },
        options,
      );

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
      let defineNode = defineNodeMap.get(state)!;

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

function getRelatedTestCaseIds(testCaseId: string): string[] {
  let parts = testCaseId.split('.');
  return parts.map((_part, index) => parts.slice(0, index + 1).join('.'));
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
            ...searchCase.rest.map(
              node => node._alias || `[by] ${node.rawDescription}`,
            ),
          ].join(' -> ')}`,
      )
      .join('\n')}`,
  );
}

function assertNoUnreachableStates(neverReachedStateSet: Set<string>): void {
  if (!neverReachedStateSet.size) {
    return;
  }

  let neverReachedStates = Array.from(neverReachedStateSet);

  throw new Error(
    `Unreachable states:\n${neverReachedStates
      .map(state => `  ${state}`)
      .join('\n')}`,
  );
}

function assertNoUnreachableTransforms(transformNodes: TransformNode[]): void {
  if (!transformNodes.length) {
    return;
  }

  throw new Error(
    `Unreachable transforms:\n${transformNodes
      .map(node => `  ${node._alias || `[by] ${node.rawDescription}`}`)
      .join('\n')}`,
  );
}

function getCaseNameOnEnd(searchCases: SearchCase[]): string | undefined {
  let searchCaseOnEnd = searchCases.find(searchCase => !searchCase.rest.length);
  return searchCaseOnEnd && searchCaseOnEnd.name;
}

function buildTestCaseName(
  {node, caseNameOnEnd, states}: PathVia,
  verbose: boolean,
): string {
  let name = node.description;

  if (caseNameOnEnd) {
    name += ` <${caseNameOnEnd}>`;
  }

  if (verbose) {
    name += `, current states [${states.join(',')}]`;
  }

  return name;
}
