import assert from 'assert';

import _ from 'lodash';
import match from 'multimatch';

import {generateNodeId} from '../@utils';
import {IPathNode, TestHandler} from '../common';
import {ResultNode} from '../result-node';

export interface TransitionMatchOptions {
  patterns: string[];
  negativePatterns: string[];
}

export type TransitionHandler<TContext, TEnvironment, TState extends string> = (
  context: TContext,
  environment: TEnvironment,
  states: TState[],
) => Promise<TContext | void> | TContext | void;

export interface NegativeStateMatchingPattern<TStatePattern extends string> {
  not: TStatePattern;
}

export type StateMatchingPattern<TStatePattern extends string> =
  | TStatePattern
  | NegativeStateMatchingPattern<TStatePattern>;

export type SingleMultipleStateMatchingPattern<TStatePattern extends string> =
  | StateMatchingPattern<TStatePattern>
  | StateMatchingPattern<TStatePattern>[];

export interface TransitionNodeOptions<
  TPattern extends string,
  TStatePattern extends string
> {
  pattern?: TPattern | false;
  match?: SingleMultipleStateMatchingPattern<TStatePattern>;
  matches?: SingleMultipleStateMatchingPattern<TStatePattern>[];
}

abstract class TransitionNode<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string
> implements IPathNode<TContext> {
  /** @internal */
  readonly id = generateNodeId();

  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description!: string;

  /** @internal */
  newStates!: string[];

  /** @internal */
  handler!: TransitionHandler<TContext, TEnvironment, string>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  reached = false;

  /** @internal */
  _manual: boolean | undefined;

  private patternName: string | false | undefined;

  private matchOptionsList: TransitionMatchOptions[];

  constructor(
    /** @internal */
    readonly obsoleteStatePatterns: string[],
    /** @internal */
    readonly only: boolean,
    {
      pattern: patternName,
      match: matchPatterns,
      matches: matchPatternsList,
    }: TransitionNodeOptions<string, string>,
  ) {
    this.patternName = patternName;

    if (matchPatterns) {
      matchPatternsList = [matchPatterns];
    } else if (!matchPatternsList) {
      matchPatternsList = [];
    }

    this.matchOptionsList = matchPatternsList.map(buildTransitionMatchOptions);
  }

  get relatedStatePatterns(): string[] {
    return _.union(
      ...this.matchOptionsList.map(matchOptions => [
        ...matchOptions.patterns,
        ...matchOptions.negativePatterns,
      ]),
    );
  }

  /** @internal */
  abstract get description(): string;

  to(
    states: TState[],
  ): TransitionToChain<TContext, TEnvironment, TState, TAlias> {
    this.newStates = states;

    return new TransitionToChain(this);
  }

  /** @internal */
  transitStates(
    states: string[],
    matchOptionsMap: Map<string | undefined, TransitionMatchOptions>,
  ): string[] | undefined {
    let obsoleteStatePatterns = this.obsoleteStatePatterns;

    let newStates = this.newStates;

    assert(obsoleteStatePatterns);
    assert(newStates);

    let presetPatternName = this.patternName;
    let presetMatchOptions =
      presetPatternName === false
        ? undefined
        : matchOptionsMap.get(presetPatternName);

    for (let pattern of obsoleteStatePatterns) {
      // For every obsolete state pattern, it has at least one corespondent
      // state
      if (match(states, pattern).length === 0) {
        return undefined;
      }
    }

    if (presetMatchOptions && !testMatchOptions(states, presetMatchOptions)) {
      return undefined;
    }

    let matchOptionsList = this.matchOptionsList;

    let matched =
      !matchOptionsList.length ||
      matchOptionsList.some(matchOptions =>
        testMatchOptions(states, matchOptions),
      );

    if (!matched) {
      return undefined;
    }

    this.reached = true;

    if (obsoleteStatePatterns.length) {
      states = _.difference(states, match(states, obsoleteStatePatterns));
    }

    return _.union(states, newStates);
  }

  /** @internal */
  async transit(
    context: TContext,
    environment: TEnvironment,
    states: string[],
  ): Promise<TContext> {
    let handler = this.handler;

    let updatedContext = await handler(context, environment, states);

    return updatedContext || context;
  }

  /** @internal */
  async test(context: TContext): Promise<void> {
    let testHandler = this.testHandler;

    if (!testHandler) {
      return;
    }

    await testHandler(context);
  }
}

export interface ITransitionNode<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string
> extends TransitionNode<TContext, TEnvironment, TState, TAlias> {}

export const AbstractTransitionNode = TransitionNode;

export class TransitionToChain<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string,
  TTransitionHandler extends TransitionHandler<
    TContext,
    TEnvironment,
    TState
  > = TransitionHandler<TContext, TEnvironment, TState>
> {
  constructor(
    /** @internal */
    readonly node: TransitionNode<TContext, TEnvironment, string, string>,
  ) {}

  alias(alias: TAlias): this {
    this.node._alias = alias;
    return this;
  }

  manual(): this {
    this.node._manual = true;
    return this;
  }

  by(description: string, handler: TTransitionHandler): ResultNode<TContext> {
    let node = this.node;

    node._description = description;
    node.handler = handler;

    return new ResultNode(node);
  }
}

export function buildTransitionMatchOptions(
  patterns: SingleMultipleStateMatchingPattern<string>,
): TransitionMatchOptions {
  if (!Array.isArray(patterns)) {
    patterns = [patterns];
  }

  let matchingPatterns: string[] = [];
  let negativeMatchingPatterns: string[] = [];

  for (let pattern of patterns) {
    if (typeof pattern === 'string') {
      matchingPatterns.push(pattern);
    } else {
      negativeMatchingPatterns.push(pattern.not);
    }
  }

  return {
    patterns: matchingPatterns,
    negativePatterns: negativeMatchingPatterns,
  };
}

function testMatchOptions(
  states: string[],
  {patterns, negativePatterns}: TransitionMatchOptions,
): boolean {
  for (let pattern of patterns) {
    if (match(states, pattern).length === 0) {
      return false;
    }
  }

  if (match(states, negativePatterns).length > 0) {
    return false;
  }

  return true;
}
