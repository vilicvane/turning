import _ from 'lodash';
import match from 'micromatch';
import Graph from 'node-dijkstra';
import Prando from 'prando';

import {pairwise} from './@utils';
import {
  AbstractTransitionNode,
  DefineNode as _DefineNode,
  InitializeNode as _InitializeNode,
  PathNode as _PathNode,
  SpawnNode as _SpawnNode,
  TransitionMatchOptions,
  TransitionNode as _TransitionNode,
  TurnNode as _TurnNode,
} from './nodes';

type DefineNode = _DefineNode<unknown>;
type InitializeNode = _InitializeNode<unknown, unknown>;
type PathNode = _PathNode<unknown, unknown>;
type SpawnNode = _SpawnNode<unknown, unknown>;
type TransitionNode = _TransitionNode<unknown, unknown>;
type TurnNode = _TurnNode<unknown, unknown>;

export interface IPathVia {
  caseNameOnEnd: string | undefined;
  states: string[];
  turn?: PathTurn;
  spawns?: PathSpawn[];
}

export interface PathInitialize extends IPathVia {
  node: InitializeNode;
}

export interface PathSpawn extends IPathVia {
  node: SpawnNode;
}

export interface PathTurn extends IPathVia {
  node: TurnNode;
}

export type PathStart = PathInitialize | PathSpawn;

export type PathVia = PathInitialize | PathSpawn | PathTurn;

interface TestCaseManualInfo {
  name: string;
  length: number;
}

interface TestCase {
  manual: TestCaseManualInfo | undefined;
  path: PathNode[];
}

export interface ManualTestCase {
  name: string;
  path: PathNode[];
}

export interface SearchOptions {
  defineNodeMap: Map<string, DefineNode>;
  initializeNodes: InitializeNode[];
  transitionNodes: TransitionNode[];
  manualTestCases: ManualTestCase[];
  transitionMatchOptionsMap: Map<string | undefined, TransitionMatchOptions>;
  minTransitionSearchCount: number;
  randomSeed: string | number | undefined;
}

export interface SearchResult {
  pathInitializes: PathInitialize[];
  reachedStateSet: Set<string>;
}

export function search({
  defineNodeMap,
  initializeNodes,
  transitionNodes,
  transitionMatchOptionsMap,
  manualTestCases,
  minTransitionSearchCount,
  randomSeed,
}: SearchOptions): SearchResult {
  console.info('Test case searching random seed:', randomSeed);

  let searchStartedAt = Date.now();

  let reachedStateSet = new Set<string>();

  let rawSourceToTransitionNodeToRawDestinationMapMap = new Map<
    string,
    Map<TransitionNode, string>
  >();

  /**
   * Manual transition nodes are not included.
   */
  let rawSourceToRawDestinationToTransitionNodesMapMap = new Map<
    string,
    Map<string, TransitionNode[]>
  >();

  searchTransitions();

  validateManualTestCases();

  let pathNodeToIndexMap = new Map<PathNode | undefined, number>([
    [undefined, 0],
  ]);

  for (let pathNode of [...initializeNodes, ...transitionNodes]) {
    let index = pathNodeToIndexMap.size;

    pathNodeToIndexMap.set(pathNode, index);
  }

  let prando = new Prando(randomSeed);

  /**
   * ```json
   * {
   *   "start": {
   *     // [start-head]
   *     "a@head": 0
   *   },
   *   "a@head": {
   *     // [self:head-tail] + [transition:head-tail]
   *     //   connect head and tail of the same states combination
   *     "a@tail": 0
   *   },
   *   "a@tail": {
   *     // [self:tail-head]
   *     //   connect tail and head of the same states combination (constant 0)
   *     "a@head": 0,
   *     // [transition:tail-head]
   *     //   min distance of a-b transitions
   *     "b@head": 0,
   *     // [tail-end]
   *     "end": 0
   *   },
   *   "b@head": {
   *     // [self:head-tail]
   *     //   connect head and tail of the same states combination
   *     "b@tail": 0
   *   },
   *   "b@tail": {
   *     // [self:tail-head]
   *     //   connect tail and head of the same states combination (constant 0)
   *     "b@head": 0,
   *     // [tail-end]
   *     "end": 0
   *   }
   * }
   * ```
   */

  let sourceToDestinationToPathNodeToCountMapMapMap = new Map<
    string,
    Map<string, Map<PathNode | undefined, number>>
  >();

  // >> [start-head]

  let startToHeadDestinationToPathNodeToCountMapMap = new Map<
    string,
    Map<PathNode | undefined, number>
  >();

  sourceToDestinationToPathNodeToCountMapMapMap.set(
    'start',
    startToHeadDestinationToPathNodeToCountMapMap,
  );

  for (let initializeNode of initializeNodes) {
    if (initializeNode._manual) {
      continue;
    }

    let rawDestination = buildStatesCombination(initializeNode.states);

    let headDestination = `${rawDestination}@head`;

    let pathNodeToCountMap = startToHeadDestinationToPathNodeToCountMapMap.get(
      headDestination,
    );

    if (!pathNodeToCountMap) {
      pathNodeToCountMap = new Map();
      startToHeadDestinationToPathNodeToCountMapMap.set(
        headDestination,
        pathNodeToCountMap,
      );
    }

    // [start-head]
    pathNodeToCountMap.set(initializeNode, 0);
  }

  for (let [
    rawSource,
    rawDestinationToTransitionNodesMap,
  ] of rawSourceToRawDestinationToTransitionNodesMapMap) {
    // >> [self:head-tail]

    let sameHeadTailPathNodeToCountMap = new Map<PathNode | undefined, number>([
      // [self:head-tail]
      [undefined, 0],
    ]);

    sourceToDestinationToPathNodeToCountMapMapMap.set(
      `${rawSource}@head`,
      new Map([[`${rawSource}@tail`, sameHeadTailPathNodeToCountMap]]),
    );

    // >> [self:tail-head] + [transition:tail-head] + [tail-end]

    let specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap = new Map<
      string,
      Map<PathNode | undefined, number>
    >([
      // [tail-end]
      ['end', new Map([[undefined, 0]])],
    ]);

    sourceToDestinationToPathNodeToCountMapMapMap.set(
      `${rawSource}@tail`,
      specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap,
    );

    for (let [
      rawDestination,
      transitionNodes,
    ] of rawDestinationToTransitionNodesMap) {
      let nonManualTransitionNodes = transitionNodes.filter(
        transitionNode => !transitionNode._manual,
      );

      if (rawSource === rawDestination) {
        for (let transitionNode of nonManualTransitionNodes) {
          // [transition:head-tail]
          sameHeadTailPathNodeToCountMap.set(transitionNode, 0);
        }

        // [self:tail-head]
        specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap.set(
          `${rawDestination}@head`,
          new Map([[undefined, 0]]),
        );
      } else {
        if (nonManualTransitionNodes.length) {
          // [transition:tail-head]
          specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap.set(
            `${rawDestination}@head`,
            new Map(
              nonManualTransitionNodes.map(transitionNode => [
                transitionNode,
                0,
              ]),
            ),
          );
        }
      }
    }
  }

  let graphData = new Map<string, Map<string, number>>();

  interface MinCountData {
    pathNode: PathNode | undefined;
    count: number;
  }

  interface PathNodeCountMapData {
    source: string;
    destination: string;
    map: Map<PathNode | undefined, number>;
  }

  let pathNodeToPathNodeCountMapDataListMap = new Map<
    PathNode,
    PathNodeCountMapData[]
  >();

  let sourceAndDestinationToMinCountDataMap = new Map<string, MinCountData>();

  for (let [
    source,
    destinationToPathNodeToCountMapMap,
  ] of sourceToDestinationToPathNodeToCountMapMapMap) {
    let partialGraphData = new Map<string, number>();

    graphData.set(source, partialGraphData);

    for (let [
      destination,
      pathNodeToCountMap,
    ] of destinationToPathNodeToCountMapMap) {
      for (let [pathNode] of pathNodeToCountMap) {
        if (pathNode) {
          let pathNodeCountMapDataList = pathNodeToPathNodeCountMapDataListMap.get(
            pathNode,
          );

          if (!pathNodeCountMapDataList) {
            pathNodeCountMapDataList = [];

            pathNodeToPathNodeCountMapDataListMap.set(
              pathNode,
              pathNodeCountMapDataList,
            );
          }

          pathNodeCountMapDataList.push({
            source,
            destination,
            map: pathNodeToCountMap,
          });
        }
      }

      let [pathNode, count] = getMinPathNodeCountEntry(pathNodeToCountMap);

      if (pathNode || pathNodeToCountMap.size > 1) {
        // Avoid [self:head-tail]-only and [tail-end] situation
        sourceAndDestinationToMinCountDataMap.set(
          buildSourceAndDestinationKey(source, destination),
          {
            pathNode,
            count,
          },
        );
      }

      partialGraphData.set(destination, Number.MIN_VALUE);
    }
  }

  let testCases = manualTestCases.map(
    ({name, path}): TestCase => {
      return {
        manual: {
          name,
          length: path.length,
        },
        path,
      };
    },
  );

  while (true) {
    let [minCountSourceAndDestination, {count: minCount}] = _.sortBy(
      Array.from(sourceAndDestinationToMinCountDataMap),
      ([, data]) => data.count,
    )[0];

    if (minCount >= minTransitionSearchCount) {
      break;
    }

    let [minCountSource, minCountDestination] = resolveSourceAndDestinationKey(
      minCountSourceAndDestination,
    );

    let startingPath =
      minCountSource !== 'start'
        ? new Graph(graphData).path('start', minCountSource)
        : ['start'];

    let endingPath =
      minCountDestination !== 'end'
        ? new Graph(graphData).path(minCountDestination, 'end')
        : ['end'];

    if (!startingPath || !endingPath) {
      blockTransition(minCountSource, minCountDestination);
      continue;
    }

    let pathNodes = increaseTransitionCount([...startingPath, ...endingPath]);

    testCases.push({
      manual: undefined,
      path: pathNodes,
    });
  }

  testCases.sort(compareTestCases).reverse();

  let anyOnlyNode =
    initializeNodes.some(initializeNode => initializeNode._only) ||
    transitionNodes.some(transitionNode => transitionNode._only) ||
    Array.from(defineNodeMap.values()).some(defineNode => defineNode._only);

  if (anyOnlyNode) {
    const states = Array.from(defineNodeMap.keys());

    testCases = testCases.filter(testCase =>
      testCase.path.some(pathNode => {
        if (pathNode._only) {
          return true;
        }

        if (pathNode instanceof AbstractTransitionNode) {
          return (
            pathNode.newStates.some(state => defineNodeMap.get(state)!._only) ||
            match(states, pathNode.obsoleteStatePatterns).some(
              state => defineNodeMap.get(state)!._only,
            )
          );
        }

        return false;
      }),
    );
  }

  let lastDedupedTestCase = testCases.shift()!;

  let dedupedTestCases = [lastDedupedTestCase];

  for (let testCase of testCases) {
    let {path: pathNodes} = testCase;
    let {path: lastDedupedPathNodes} = lastDedupedTestCase;

    if (
      pathNodes.length <= lastDedupedPathNodes.length &&
      _.isEqual(pathNodes, lastDedupedPathNodes.slice(0, pathNodes.length))
    ) {
      continue;
    }

    lastDedupedTestCase = testCase;
    dedupedTestCases.unshift(testCase);
  }

  let pathInitializes = buildTestCasePaths(
    dedupedTestCases,
    rawSourceToTransitionNodeToRawDestinationMapMap,
  );

  console.info('Total number of test cases:', dedupedTestCases.length);
  console.info(
    'Elapsed time searching test cases:',
    `${Date.now() - searchStartedAt} ms`,
  );

  console.info();

  return {
    pathInitializes,
    reachedStateSet,
  };

  function blockTransition(source: string, destination: string): void {
    let key = buildSourceAndDestinationKey(source, destination);

    sourceAndDestinationToMinCountDataMap.delete(key);

    let pathNodeToCountMap = sourceToDestinationToPathNodeToCountMapMapMap
      .get(source)!
      .get(destination)!;

    for (let pathNode of pathNodeToCountMap.keys()) {
      pathNodeToCountMap.set(pathNode, Infinity);
    }

    let partialGraphData = graphData.get(source)!;

    partialGraphData.delete(destination);

    if (!partialGraphData.size) {
      graphData.delete(source);
    }
  }

  function increaseTransitionCount(path: string[]): PathNode[] {
    let pathNodes: PathNode[] = [];

    for (let [source, destination] of pairwise(path)) {
      let key = buildSourceAndDestinationKey(source, destination);

      let minCountData = sourceAndDestinationToMinCountDataMap.get(key);

      if (!minCountData) {
        // it's [self:head-tail] or [tail-end]
        continue;
      }

      let {pathNode, count} = minCountData;

      if (pathNode) {
        pathNodes.push(pathNode);
      }

      let pathNodeCountMapDataList = pathNode
        ? pathNodeToPathNodeCountMapDataListMap.get(pathNode)!
        : [
            {
              source,
              destination,
              map: sourceToDestinationToPathNodeToCountMapMapMap
                .get(source)!
                .get(destination)!,
            },
          ];

      for (let {
        source,
        destination,
        map: pathNodeToCountMap,
      } of pathNodeCountMapDataList) {
        let key = buildSourceAndDestinationKey(source, destination);

        if (sourceAndDestinationToMinCountDataMap.has(key)) {
          pathNodeToCountMap.set(pathNode, count + 1);

          let [newPathNode, newCount] = getMinPathNodeCountEntry(
            pathNodeToCountMap,
          );

          sourceAndDestinationToMinCountDataMap.set(key, {
            pathNode: newPathNode,
            count: newCount,
          });

          let partialGraphData = graphData.get(source)!;

          let currentDistance = partialGraphData.get(destination)!;

          partialGraphData.set(
            destination,
            currentDistance + getDistanceIncrementByCount(newCount),
          );
        }
      }
    }

    return pathNodes;
  }

  function getDistanceIncrementByCount(count: number): number {
    return Math.pow(2, count) * prando.next();
  }

  function getMinPathNodeCountEntry(
    pathNodeToCountMap: Map<PathNode | undefined, number>,
  ): [PathNode | undefined, number] {
    return Array.from(pathNodeToCountMap).sort(([, x], [, y]) => x - y)[0];
  }

  function searchTransitions(): void {
    for (let initializeNode of initializeNodes) {
      let states = initializeNode.states;

      searchNextStatesCombinations(states, buildStatesCombination(states));
    }

    for (let [
      rawSource,
      transitionNodeToRawDestinationMap,
    ] of rawSourceToTransitionNodeToRawDestinationMapMap) {
      let rawDestinationToTransitionNodesMap = new Map<
        string,
        TransitionNode[]
      >();

      rawSourceToRawDestinationToTransitionNodesMapMap.set(
        rawSource,
        rawDestinationToTransitionNodesMap,
      );

      for (let [
        transitionNode,
        rawDestination,
      ] of transitionNodeToRawDestinationMap) {
        let transitionNodes = rawDestinationToTransitionNodesMap.get(
          rawDestination,
        );

        if (!transitionNodes) {
          transitionNodes = [];

          rawDestinationToTransitionNodesMap.set(
            rawDestination,
            transitionNodes,
          );
        }

        transitionNodes.push(transitionNode);
      }
    }

    function searchNextStatesCombinations(
      sourceStates: string[],
      rawSource: string,
    ): void {
      for (let state of sourceStates) {
        reachedStateSet.add(state);
      }

      let transitionNodeAndDestinationStatesAndRawDestinationTuples = transitionNodes
        .map((transitionNode):
          | [TransitionNode, string[], string]
          | undefined => {
          let destinationStates = transitionNode.transitStates(
            sourceStates,
            transitionMatchOptionsMap,
          );

          if (!destinationStates) {
            return undefined;
          }

          return [
            transitionNode,
            destinationStates,
            buildStatesCombination(destinationStates),
          ];
        })
        .filter(
          (tuple): tuple is [TransitionNode, string[], string] => !!tuple,
        );

      if (rawSourceToTransitionNodeToRawDestinationMapMap.has(rawSource)) {
        let transitionNodeToRawDestinationMap = rawSourceToTransitionNodeToRawDestinationMapMap.get(
          rawSource,
        )!;

        for (let [
          transitionNode,
          ,
          rawDestination,
        ] of transitionNodeAndDestinationStatesAndRawDestinationTuples) {
          transitionNodeToRawDestinationMap.set(transitionNode, rawDestination);
        }
      } else {
        rawSourceToTransitionNodeToRawDestinationMapMap.set(
          rawSource,
          new Map(
            transitionNodeAndDestinationStatesAndRawDestinationTuples.map(
              ([transitionNode, , rawDestination]): [
                TransitionNode,
                string,
              ] => [transitionNode, rawDestination],
            ),
          ),
        );

        for (let [
          ,
          destinationStates,
          destination,
        ] of transitionNodeAndDestinationStatesAndRawDestinationTuples) {
          searchNextStatesCombinations(destinationStates, destination);
        }
      }
    }
  }

  function validateManualTestCases(): void {
    let initializeNodeSet = new Set(initializeNodes);

    for (let {
      name,
      path: [initializeNode, ...transitionNodes],
    } of manualTestCases) {
      if (!initializeNodeSet.has(initializeNode as InitializeNode)) {
        throw new Error(
          `Invalid manual case "${name}": "${
            initializeNode._alias || initializeNode.description
          }" is not a valid initialize node`,
        );
      }

      let statesCombination: string | undefined = buildStatesCombination(
        (initializeNode as InitializeNode).states,
      );

      for (let transitionNode of transitionNodes) {
        let availableTransitionNodeToRawDestinationMap = rawSourceToTransitionNodeToRawDestinationMapMap.get(
          statesCombination,
        );

        let nextStatesCombination =
          availableTransitionNodeToRawDestinationMap &&
          availableTransitionNodeToRawDestinationMap.get(
            transitionNode as TransitionNode,
          );

        if (nextStatesCombination === undefined) {
          throw new Error(
            `Invalid manual case "${name}": "${
              transitionNode._alias || transitionNode.description
            }" is not available on states combination "${statesCombination}"`,
          );
        }

        statesCombination = nextStatesCombination;
      }
    }
  }

  function compareTestCases(
    {path: xPath}: TestCase,
    {path: yPath}: TestCase,
  ): number {
    let minLength = Math.min(xPath.length, yPath.length);

    for (let i = 0; i < minLength; i++) {
      let result =
        pathNodeToIndexMap.get(xPath[i])! - pathNodeToIndexMap.get(yPath[i])!;

      if (result) {
        return result;
      }
    }

    return xPath.length === minLength ? -1 : 1;
  }
}

function buildTestCasePaths(
  testCases: TestCase[],
  rawSourceToTransitionNodeToRawDestinationMapMap: Map<
    string,
    Map<TransitionNode, string>
  >,
): PathInitialize[] {
  let pathInitializes: PathInitialize[] = [];

  let initializeNodeToTestCasesMap = buildPathNodeToTestCasesMap<
    InitializeNode
  >(testCases, 0);

  for (let [initializeNode, testCases] of initializeNodeToTestCasesMap) {
    let states = initializeNode.states;

    let pathInitialize: PathInitialize = {
      caseNameOnEnd: getManualTestCaseNameOnEnd(testCases, 0),
      node: initializeNode,
      states,
    };

    buildNext(
      buildStatesCombination(states),
      pathInitializes,
      pathInitialize,
      testCases,
      1,
    );
  }

  return pathInitializes;

  function buildNext(
    statesCombination: string,
    currentPathStarts: PathStart[],
    parentPathStart: PathStart,
    matchingTestCases: TestCase[],
    index: number,
  ): void {
    let transitionNodeToTestCasesMap = buildPathNodeToTestCasesMap<
      TransitionNode
    >(matchingTestCases, index);

    for (let [transitionNode, testCases] of transitionNodeToTestCasesMap) {
      let nextStatesCombination = rawSourceToTransitionNodeToRawDestinationMapMap
        .get(statesCombination)!
        .get(transitionNode)!;

      let nextStates = resolveStatesCombination(nextStatesCombination);

      let nextPathStarts: PathStart[];
      let pathStart: PathStart;

      let caseNameOnEnd = getManualTestCaseNameOnEnd(testCases, index);

      if (transitionNode instanceof _TurnNode) {
        nextPathStarts = currentPathStarts;

        pathStart = clonePath(parentPathStart);

        getPathEnd(pathStart).turn = {
          caseNameOnEnd,
          node: transitionNode,
          states: nextStates,
        };
      } else {
        if (!currentPathStarts.includes(parentPathStart)) {
          currentPathStarts.push(parentPathStart);
        }

        let parentPathEnd = getPathEnd(parentPathStart);

        nextPathStarts = parentPathEnd.spawns || (parentPathEnd.spawns = []);

        pathStart = {
          caseNameOnEnd,
          node: transitionNode,
          states: nextStates,
        };
      }

      if (testCases.some(testCase => testCase.path.length > index + 1)) {
        buildNext(
          nextStatesCombination,
          nextPathStarts,
          pathStart,
          testCases,
          index + 1,
        );
      } else {
        nextPathStarts.push(pathStart);
      }
    }
  }

  function buildPathNodeToTestCasesMap<TPathNode extends PathNode>(
    testCases: TestCase[],
    index: number,
  ): Map<TPathNode, TestCase[]>;
  function buildPathNodeToTestCasesMap(
    testCases: TestCase[],
    index: number,
  ): Map<PathNode, TestCase[]> {
    let pathNodeToTestCasesMap = new Map<PathNode, TestCase[]>();

    for (let testCase of testCases) {
      let pathNode = testCase.path[index];

      let testCases = pathNodeToTestCasesMap.get(pathNode);

      if (!testCases) {
        testCases = [];
        pathNodeToTestCasesMap.set(pathNode, testCases);
      }

      testCases.push(testCase);
    }

    return pathNodeToTestCasesMap;
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

function getManualTestCaseNameOnEnd(
  testCase: TestCase[],
  index: number,
): string | undefined {
  let manualTestCaseOnEnd = testCase.find(({manual}) => {
    return !!manual && manual.length === index + 1;
  });

  return manualTestCaseOnEnd && manualTestCaseOnEnd.manual!.name;
}

function buildStatesCombination(states: string[]): string {
  return [...states].sort().join(',');
}

export function resolveStatesCombination(statesCombination: string): string[] {
  return statesCombination ? statesCombination.split(',') : [];
}

function buildSourceAndDestinationKey(
  source: string,
  destination: string,
): string {
  return `${source}~${destination}`;
}

function resolveSourceAndDestinationKey(key: string): [string, string] {
  return key.split('~') as [string, string];
}
