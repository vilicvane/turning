import _ from 'lodash';
import Graph from 'node-dijkstra';
import Prando from 'prando';

import {pairwise} from './@utils';
import {
  InitializeNode,
  PathNode,
  TransformMatchOptions,
  TransitionNode,
} from './nodes';

const SOURCE_DESTINATION_KEY = (source: string, destination: string): string =>
  `${source}~${destination}`;

const RESOLVE_SOURCE_DESTINATION_KEY = (key: string): [string, string] =>
  key.split('~') as [string, string];

export interface SearchCasesOptions {
  initializeNodes: InitializeNode[];
  transitionNodes: TransitionNode[];
  transitionMatchOptionsMap: Map<string | undefined, TransformMatchOptions>;
  minTransitionSearchCount: number;
  randomSeed: string | number | undefined;
}

export function searchCases({
  initializeNodes,
  transitionNodes,
  transitionMatchOptionsMap,
  minTransitionSearchCount,
  randomSeed,
}: SearchCasesOptions): void {
  let prando = new Prando(randomSeed);

  let pathNodeToIndexMap = new Map<PathNode | undefined, number>([
    [undefined, 0],
  ]);
  let indexToPathNodeMap = new Map<number, PathNode>();

  for (let pathNode of [...initializeNodes, ...transitionNodes]) {
    let index = pathNodeToIndexMap.size;

    pathNodeToIndexMap.set(pathNode, index);
    indexToPathNodeMap.set(index, pathNode);
  }

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

  let rawSourceToRawDestinationToTransitionNodesMapMap = searchStatesCombinations();

  for (let [
    rawSource,
    rawDestinationToPathNodesMap,
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

    for (let [rawDestination, pathNodes] of rawDestinationToPathNodesMap) {
      if (rawSource === rawDestination) {
        for (let pathNode of pathNodes) {
          // [transition:head-tail]
          sameHeadTailPathNodeToCountMap.set(pathNode, 0);
        }

        // [self:tail-head]
        specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap.set(
          `${rawDestination}@head`,
          new Map([[undefined, 0]]),
        );
      } else {
        // [transition:tail-head]
        specifiedTailSourceToHeadDestinationToPathNodeToCountMapMap.set(
          `${rawDestination}@head`,
          new Map(pathNodes.map(pathNode => [pathNode, 0])),
        );
      }
    }
  }

  // console.log(sourceToDestinationToPathNodeToCountMapMapMap);

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
          SOURCE_DESTINATION_KEY(source, destination),
          {
            pathNode,
            count,
          },
        );
      }

      partialGraphData.set(destination, Number.MIN_VALUE);
    }
  }

  let caseIndexArrays: number[][] = [];

  let i = 0;

  while (true || i++ < 10) {
    let [minCountSourceAndDestination, {count: minCount}] = _.sortBy(
      Array.from(sourceAndDestinationToMinCountDataMap),
      ([, data]) => data.count,
    )[0];

    if (minCount >= minTransitionSearchCount) {
      break;
    }

    let [minCountSource, minCountDestination] = RESOLVE_SOURCE_DESTINATION_KEY(
      minCountSourceAndDestination,
    );

    // console.log('MIN COUNT');
    // console.log(pathNode && pathNode.description);
    // console.log(minCountSource);
    // console.log(minCountDestination);

    let startingPath =
      minCountSource !== 'start'
        ? new Graph(graphData).path('start', minCountSource)!
        : ['start'];

    let startingIndexes = lengthenPathInGraphData([
      ...startingPath,
      minCountDestination,
    ]);

    let endingPath =
      minCountDestination !== 'end'
        ? new Graph(graphData).path(minCountDestination, 'end')!
        : ['end'];

    let endingIndexes = lengthenPathInGraphData(endingPath);

    caseIndexArrays.push([...startingIndexes, ...endingIndexes]);

    // console.log('states', [...startingPath, ...endingPath]);
    // console.log('path', [...startingIndexes, ...endingIndexes]);
  }

  caseIndexArrays.sort(compareIndexArrays).reverse();

  let lastDedupedCaseIndexes = caseIndexArrays.shift()!;

  let dedupedCaseIndexArrays = [lastDedupedCaseIndexes];

  for (let caseIndexes of caseIndexArrays) {
    if (
      caseIndexes.length <= lastDedupedCaseIndexes.length &&
      _.isEqual(
        caseIndexes,
        lastDedupedCaseIndexes.slice(0, caseIndexes.length),
      )
    ) {
      continue;
    }

    lastDedupedCaseIndexes = caseIndexes;
    dedupedCaseIndexArrays.unshift(caseIndexes);
  }

  // console.log(
  //   dedupedCaseIndexArrays.map(indexes => {
  //     return indexes.map(index => indexToPathNodeMap.get(index)!.description);
  //   }),
  // );

  console.log(dedupedCaseIndexArrays);
  console.log(dedupedCaseIndexArrays.length);

  function lengthenPathInGraphData(path: string[]): number[] {
    let nodeIndexes: number[] = [];

    for (let [source, destination] of pairwise(path)) {
      let key = SOURCE_DESTINATION_KEY(source, destination);

      // let pathNodeToCountMap = sourceToDestinationToPathNodeToCountMapMapMap
      //   .get(source)!
      //   .get(destination)!;

      let minCountData = sourceAndDestinationToMinCountDataMap.get(key);

      if (!minCountData) {
        // it's [self:head-tail] or [tail-end]
        continue;
      }

      let {pathNode, count} = minCountData;

      if (pathNode) {
        nodeIndexes.push(pathNodeToIndexMap.get(pathNode)!);
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

    return nodeIndexes;
  }

  function getDistanceIncrementByCount(count: number): number {
    return Math.pow(2, count) * prando.next();
    // return Math.pow(2, count);
  }

  function getMinPathNodeCountEntry(
    pathNodeToCountMap: Map<PathNode | undefined, number>,
  ): [PathNode | undefined, number] {
    return Array.from(pathNodeToCountMap).sort(([, x], [, y]) => x - y)[0];
  }

  function searchStatesCombinations(): Map<
    string,
    Map<string, TransitionNode[]>
  > {
    let sourceToDestinationToTransitionNodesMapMap = new Map<
      string,
      Map<string, TransitionNode[]>
    >();

    for (let initializeNode of initializeNodes) {
      let states = initializeNode.states;

      searchNextStatesCombinations(states, buildStatesCombination(states));
    }

    return sourceToDestinationToTransitionNodesMapMap;

    function searchNextStatesCombinations(
      sourceStates: string[],
      source: string,
    ): void {
      let transitionNodeAndDestinationStatesAndDestinationTuples = transitionNodes
        .map(
          (transitionNode): [TransitionNode, string[], string] | undefined => {
            let destinationStates = transitionNode.transitStates(
              sourceStates,
              transitionMatchOptionsMap,
            );

            return (
              destinationStates && [
                transitionNode,
                destinationStates,
                buildStatesCombination(destinationStates),
              ]
            );
          },
        )
        .filter(
          (tuple): tuple is [TransitionNode, string[], string] => !!tuple,
        );

      if (sourceToDestinationToTransitionNodesMapMap.has(source)) {
        let destinationToTransitionNodesMap = sourceToDestinationToTransitionNodesMapMap.get(
          source,
        )!;

        for (let [
          transitionNode,
          ,
          destination,
        ] of transitionNodeAndDestinationStatesAndDestinationTuples) {
          destinationToTransitionNodesMap
            .get(destination)!
            .push(transitionNode);
        }
      } else {
        sourceToDestinationToTransitionNodesMapMap.set(
          source,
          new Map(
            transitionNodeAndDestinationStatesAndDestinationTuples.map(
              ([transitionNode, , destination]): [string, TransitionNode[]] => [
                destination,
                [transitionNode],
              ],
            ),
          ),
        );

        for (let [
          ,
          destinationStates,
          destination,
        ] of transitionNodeAndDestinationStatesAndDestinationTuples) {
          searchNextStatesCombinations(destinationStates, destination);
        }
      }
    }
  }
}

function buildStatesCombination(states: string[]): string {
  return [...states].sort().join(',');
}

function compareIndexArrays(xIndexes: number[], yIndexes: number[]): number {
  let minLength = Math.min(xIndexes.length, yIndexes.length);

  for (let i = 0; i < minLength; i++) {
    let result = xIndexes[i] - yIndexes[i];

    if (result) {
      return result;
    }
  }

  return xIndexes.length === minLength ? -1 : 1;
}
