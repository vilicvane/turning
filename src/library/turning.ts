import _ from 'lodash';
import match from 'micromatch';

import {
  ManualTestCase,
  PathInitialize,
  PathSpawn,
  PathStart,
  PathTurn,
  PathVia,
  searchTestCases,
} from './@search';
import {
  DefineNode,
  InitializeNode,
  PathNode,
  SingleMultipleStateMatchingPattern,
  SpawnNode,
  TransformMatchOptions,
  TransformNodeOptions,
  TransitionNode,
  TurnNode,
  buildTransformMatchOptions,
} from './nodes';

const CONTEXT_SKIPPED: any = {};

export interface ITurningTestAdapter {
  describe(name: string, callback: () => void): void;
  test(name: string, callback: () => Promise<void>): void;
}

export interface TurningSearchOptions {
  allowUnreachable?: boolean;
  minTransitionSearchCount?: number;
  randomSeed?: string | number;
}

export interface TurningTestOptions extends TurningSearchOptions {
  only?: string[];
  verbose?: boolean;
}

export class Turning<TContext> {
  private defineNodeMap = new Map<string, DefineNode<TContext>>();

  private transitionMatchOptionsMap = new Map<
    string | undefined,
    TransformMatchOptions
  >();

  private initializeNodes: InitializeNode<TContext>[] = [];
  private transitionNodes: TransitionNode<TContext>[] = [];

  private nameToCasePathNodeAliasesMap = new Map<string, string[]>();

  constructor(private testAdapter: ITurningTestAdapter) {}

  define(state: string): DefineNode<TContext> {
    let node = new DefineNode<TContext>(state);
    this.defineNodeMap.set(state, node);
    return node;
  }

  pattern(patterns: SingleMultipleStateMatchingPattern): void;
  pattern(name: string, patterns: SingleMultipleStateMatchingPattern): void;
  pattern(
    name: string | undefined | SingleMultipleStateMatchingPattern,
    patterns?: SingleMultipleStateMatchingPattern,
  ): void {
    if (!patterns) {
      patterns = name as SingleMultipleStateMatchingPattern;
      name = undefined;
    }

    this.transitionMatchOptionsMap.set(
      name as string | undefined,
      buildTransformMatchOptions(patterns),
    );
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
    this.transitionNodes.push(node);
    return node;
  }

  spawn(
    states: string[],
    options: TransformNodeOptions = {},
  ): SpawnNode<TContext> {
    let node = new SpawnNode<TContext>(states, options);
    this.transitionNodes.push(node);
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
              let {node: startNode, states: startStatesCombination} = pathStart;

              if (startNode instanceof InitializeNode) {
                context = await startNode.initialize();
              } else {
                let parentContext = contextGetter!();

                context = await startNode.transit(parentContext);

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

              await this.testStates(context, startStatesCombination);

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

                context = await turnNode.transit(context);

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
    allowUnreachable = false,
    minTransitionSearchCount = 10,
    randomSeed = new Date().toDateString(),
  }: TurningSearchOptions = {}): PathInitialize[] {
    this.validateStatesAndStatePatterns();

    let manualTestCases = this.buildManualTestCases();

    let {pathInitializes, reachedStateSet} = searchTestCases({
      initializeNodes: this.initializeNodes,
      transitionNodes: this.transitionNodes,
      transitionMatchOptionsMap: this.transitionMatchOptionsMap,
      manualTestCases,
      minTransitionSearchCount,
      randomSeed,
    });

    if (!allowUnreachable) {
      let definedStateSet = new Set(this.defineNodeMap.keys());
      assertNoUnreachableStates(definedStateSet, reachedStateSet);
    }

    assertNoUnreachableTransitions(this.transitionNodes);

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

    for (let transformNode of this.transitionNodes) {
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

    for (let {
      patterns,
      negativePatterns,
    } of this.transitionMatchOptionsMap.values()) {
      for (let pattern of [...patterns, ...negativePatterns]) {
        statePatternSet.add(pattern);
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

  private buildManualTestCases(): ManualTestCase[] {
    let aliasToPathNodeMap = new Map<string, PathNode>();

    for (let pathNode of [...this.initializeNodes, ...this.transitionNodes]) {
      if (pathNode._alias) {
        aliasToPathNodeMap.set(pathNode._alias, pathNode);
      }
    }

    return Array.from(this.nameToCasePathNodeAliasesMap).map(
      ([name, aliases]) => {
        return {
          name,
          path: aliases.map(alias => {
            let pathNode = aliasToPathNodeMap.get(alias);

            if (!pathNode) {
              throw new Error(`Unknown node alias "${alias}" in case`);
            }

            return pathNode;
          }),
        };
      },
    );
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

function assertNoUnreachableStates(
  definedStateSet: Set<string>,
  reachedStateSet: Set<string>,
): void {
  let neverReachedStateSet = new Set(definedStateSet);

  for (let state of reachedStateSet) {
    neverReachedStateSet.delete(state);
  }

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

function assertNoUnreachableTransitions(
  transitionNodes: TransitionNode[],
): void {
  let unreachableTransformNodes = transitionNodes.filter(node => !node.reached);

  if (!unreachableTransformNodes.length) {
    return;
  }

  throw new Error(
    `Unreachable transforms:\n${unreachableTransformNodes
      .map(node => `  ${node._alias || node.description}`)
      .join('\n')}`,
  );
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
