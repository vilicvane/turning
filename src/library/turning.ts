import _ from 'lodash';
import match from 'micromatch';

import {ManualTestCase, PathInitialize, search} from './@search';
import {test} from './@test';
import {ITurningContext} from './context';
import {ITurningEnvironment} from './environment';
import {
  DefineNode,
  InitializeNode,
  PathNode,
  SingleMultipleStateMatchingPattern,
  SpawnNode,
  TransitionMatchOptions,
  TransitionNode,
  TransitionNodeOptions,
  TurnNode,
  buildTransitionMatchOptions,
} from './nodes';

interface TurningSearchOptions {
  allowUnreachable?: boolean;
  minTransitionSearchCount?: number;
  randomSeed?: string | number;
}

export interface TurningTestOptions extends TurningSearchOptions {
  bail?: boolean;
  filter?: string[];
  verbose?: boolean;
  listOnly?: boolean;
  maxAttempts?: number;
}

export class Turning<
  TContext extends ITurningContext,
  TEnvironment extends ITurningEnvironment<TContext>
> {
  private defineNodeMap = new Map<string, DefineNode<TContext>>();

  private transitionMatchOptionsMap = new Map<
    string | undefined,
    TransitionMatchOptions
  >();

  private initializeNodes: InitializeNode<TContext, TEnvironment>[] = [];
  private transitionNodes: TransitionNode<TContext, TEnvironment>[] = [];

  private nameToCasePathNodeAliasesMap = new Map<string, string[]>();

  constructor(readonly environment: TEnvironment) {}

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
      buildTransitionMatchOptions(patterns),
    );
  }

  initialize(states: string[]): InitializeNode<TContext, TEnvironment> {
    let node = new InitializeNode<TContext, TEnvironment>(states);
    this.initializeNodes.push(node);
    return node;
  }

  turn(
    states: string[],
    options: TransitionNodeOptions = {},
  ): TurnNode<TContext, TEnvironment> {
    let node = new TurnNode<TContext, TEnvironment>(states, options);
    this.transitionNodes.push(node);
    return node;
  }

  spawn(
    states: string[],
    options: TransitionNodeOptions = {},
  ): SpawnNode<TContext, TEnvironment> {
    let node = new SpawnNode<TContext, TEnvironment>(states, options);
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

  async test(options?: TurningTestOptions): Promise<boolean>;
  async test({
    bail = false,
    maxAttempts = 1,
    filter,
    verbose = false,
    listOnly = false,
    ...searchOptions
  }: TurningTestOptions = {}): Promise<boolean> {
    let pathInitializes = this.search(searchOptions);

    return test(pathInitializes, {
      environment: this.environment,
      bail,
      maxAttempts,
      filter,
      verbose,
      listOnly,
      defineNodeMap: this.defineNodeMap,
    });
  }

  private search({
    allowUnreachable = false,
    minTransitionSearchCount = 10,
    randomSeed = new Date().toDateString(),
  }: TurningSearchOptions = {}): PathInitialize[] {
    this.validateStatesAndStatePatterns();

    let manualTestCases = this.buildManualTestCases();

    let {pathInitializes, reachedStateSet} = search({
      defineNodeMap: this.defineNodeMap,
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

    for (let transitionNode of this.transitionNodes) {
      for (let state of transitionNode.newStates) {
        stateSet.add(state);
      }

      for (let statePattern of [
        ...transitionNode.obsoleteStatePatterns,
        ...transitionNode.relatedStatePatterns,
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
    let aliasToPathNodeMap = new Map<
      string,
      PathNode<TContext, TEnvironment>
    >();

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
  transitionNodes: TransitionNode<unknown, unknown>[],
): void {
  let unreachableTransitionNodes = transitionNodes.filter(
    node => !node.reached,
  );

  if (!unreachableTransitionNodes.length) {
    return;
  }

  throw new Error(
    `Unreachable transitions:\n${unreachableTransitionNodes
      .map(node => `  ${node._alias || node.description}`)
      .join('\n')}`,
  );
}
