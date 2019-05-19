import _ from 'lodash';
import match from 'micromatch';

import {ManualTestCase, PathInitialize, search} from './@search';
import {
  TurningAfterCallback,
  TurningAfterEachCallback,
  TurningBeforeCallback,
  TurningSetupCallback,
  TurningTeardownCallback,
  test,
} from './@test';
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
}

export class Turning<TContext, TEnvironment> {
  private setupCallback: TurningSetupCallback<TEnvironment> | undefined;
  private teardownCallback: TurningTeardownCallback<TEnvironment> | undefined;
  private beforeCallback: TurningBeforeCallback<TEnvironment> | undefined;
  private afterCallback: TurningAfterCallback<TEnvironment> | undefined;
  private afterEachCallback:
    | TurningAfterEachCallback<TContext, TEnvironment>
    | undefined;

  private defineNodeMap = new Map<string, DefineNode<TContext>>();

  private transitionMatchOptionsMap = new Map<
    string | undefined,
    TransformMatchOptions
  >();

  private initializeNodes: InitializeNode<TContext, TEnvironment>[] = [];
  private transitionNodes: TransitionNode<TContext, TEnvironment>[] = [];

  private nameToCasePathNodeAliasesMap = new Map<string, string[]>();

  setup(callback: TurningSetupCallback<TEnvironment>): void {
    if (this.setupCallback) {
      throw new Error('Hook `setup` has already been set');
    }

    this.setupCallback = callback;
  }

  teardown(callback: TurningTeardownCallback<TEnvironment>): void {
    if (this.teardownCallback) {
      throw new Error('Hook `teardown` has already been set');
    }

    this.teardownCallback = callback;
  }

  before(callback: TurningBeforeCallback<TEnvironment>): void {
    if (this.beforeCallback) {
      throw new Error('Hook `before` has already been set');
    }

    this.beforeCallback = callback;
  }

  after(callback: TurningAfterCallback<TEnvironment>): void {
    if (this.afterCallback) {
      throw new Error('Hook `after` has already been set');
    }

    this.afterCallback = callback;
  }

  afterEach(callback: TurningAfterEachCallback<TContext, TEnvironment>): void {
    if (this.afterEachCallback) {
      throw new Error('Hook `afterEach` has already been set');
    }

    this.afterEachCallback = callback;
  }

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

  initialize(states: string[]): InitializeNode<TContext, TEnvironment> {
    let node = new InitializeNode<TContext, TEnvironment>(states);
    this.initializeNodes.push(node);
    return node;
  }

  turn(
    states: string[],
    options: TransformNodeOptions = {},
  ): TurnNode<TContext, TEnvironment> {
    let node = new TurnNode<TContext, TEnvironment>(states, options);
    this.transitionNodes.push(node);
    return node;
  }

  spawn(
    states: string[],
    options: TransformNodeOptions = {},
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
    filter,
    verbose = false,
    listOnly = false,
    ...searchOptions
  }: TurningTestOptions = {}): Promise<boolean> {
    let pathInitializes = this.search(searchOptions);

    return test(pathInitializes, {
      bail,
      filter,
      verbose,
      listOnly,
      defineNodeMap: this.defineNodeMap,
      setupCallback: this.setupCallback,
      teardownCallback: this.teardownCallback,
      beforeCallback: this.beforeCallback,
      afterCallback: this.afterCallback,
      afterEachCallback: this.afterEachCallback,
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
