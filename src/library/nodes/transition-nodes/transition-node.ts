import assert from 'assert';

import _ from 'lodash';
import match from 'micromatch';

import {generateNodeId} from '../@utils';
import {IPathNode, TestHandler} from '../common';
import {ResultNode} from '../result-node';

export interface TransitionMatchOptions {
  patterns: string[];
  negativePatterns: string[];
}

export type TransitionHandler<TContext, TEnvironment> = (
  context: TContext,
  environment: TEnvironment,
) => Promise<TContext | void> | TContext | void;

export interface NegativeStateMatchingPattern {
  not: string;
}

export type StateMatchingPattern = string | NegativeStateMatchingPattern;

export type SingleMultipleStateMatchingPattern =
  | StateMatchingPattern
  | StateMatchingPattern[];

export interface TransitionNodeOptions {
  pattern?: string | false;
  match?: SingleMultipleStateMatchingPattern;
  matches?: (SingleMultipleStateMatchingPattern)[];
}

abstract class TransitionNode<TContext, TEnvironment>
  implements IPathNode<TContext> {
  /** @internal */
  readonly id = generateNodeId();

  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description!: string;

  /** @internal */
  newStates!: string[];

  /** @internal */
  handler!: TransitionHandler<TContext, TEnvironment>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  reached = false;

  /** @internal */
  _depth: number | undefined;

  /** @internal */
  _manual: boolean | undefined;

  private patternName: string | false | undefined;

  private matchOptionsList: TransitionMatchOptions[];

  constructor(
    /** @internal */
    readonly obsoleteStatePatterns: string[],
    {
      pattern: patternName,
      match: matchPatterns,
      matches: matchPatternsList,
    }: TransitionNodeOptions,
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
      states = match.not(states, obsoleteStatePatterns);
    }

    return _.union(states, newStates);
  }

  /** @internal */
  async transit(
    context: TContext,
    environment: TEnvironment,
  ): Promise<TContext> {
    let handler = this.handler;

    let updatedContext = await handler(context, environment);

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

export interface ITransitionNode<TContext, TEnvironment>
  extends TransitionNode<TContext, TEnvironment> {}

export const AbstractTransitionNode = TransitionNode;

export class TransitionToChain<
  TContext,
  TEnvironment,
  TTransitionHandler extends TransitionHandler<
    TContext,
    TEnvironment
  > = TransitionHandler<TContext, TEnvironment>
> {
  constructor(
    /** @internal */
    readonly node: TransitionNode<TContext, TEnvironment>,
  ) {}

  alias(alias: string): this {
    this.node._alias = alias;
    return this;
  }

  depth(depth: number): this {
    this.node._depth = depth;
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
  patterns: SingleMultipleStateMatchingPattern,
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

  if (match.some(states, negativePatterns)) {
    return false;
  }

  return true;
}
