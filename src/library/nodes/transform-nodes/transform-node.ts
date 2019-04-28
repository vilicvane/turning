import assert from 'assert';

import _ from 'lodash';
import match from 'micromatch';

import {PathNode, TestHandler} from '../common';
import {ResultNode} from '../result-node';

interface TransformMatchOptions {
  patterns: string[];
  negativePatterns: string[];
}

export type TransformHandler<TContext = unknown> = (
  context: TContext,
) => Promise<TContext | void> | TContext | void;

export interface NegativeStateMatchingPattern {
  not: string;
}

export type StateMatchingPattern = string | NegativeStateMatchingPattern;

export interface TransformNodeOptions {
  match?: StateMatchingPattern | StateMatchingPattern[];
  matches?: (StateMatchingPattern | StateMatchingPattern[])[];
}

abstract class TransformNode<TContext = unknown> implements PathNode {
  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description!: string;

  /** @internal */
  newStates!: string[];

  /** @internal */
  handler!: TransformHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  reached = false;

  /** @internal */
  _depth: number | undefined;

  /** @internal */
  _manual: boolean | undefined;

  /** @internal */
  blockedTransformAliases: string[] | undefined;

  private matchOptionsList: TransformMatchOptions[];

  constructor(
    /** @internal */
    readonly obsoleteStatePatterns: string[],
    {match: matchPatterns, matches: matchPatternsList}: TransformNodeOptions,
  ) {
    if (matchPatterns) {
      matchPatternsList = [matchPatterns];
    } else if (!matchPatternsList) {
      matchPatternsList = [];
    }

    let matchOptionsList: TransformMatchOptions[] = [];

    for (let patterns of matchPatternsList) {
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

      matchOptionsList.push({
        patterns: matchingPatterns,
        negativePatterns: negativeMatchingPatterns,
      });
    }

    this.matchOptionsList = matchOptionsList;
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
  transformStates(states: string[]): string[] | undefined {
    states = [...states];

    let obsoleteStatePatterns = this.obsoleteStatePatterns;

    let newStates = this.newStates;

    assert(obsoleteStatePatterns);
    assert(newStates);

    for (let pattern of obsoleteStatePatterns) {
      // For every obsolete state pattern, it has at least one corespondent
      // state
      if (match(states, pattern).length === 0) {
        return undefined;
      }
    }

    let matchOptionsList = this.matchOptionsList;

    let matched =
      !matchOptionsList.length ||
      matchOptionsList.some(({patterns, negativePatterns}) => {
        for (let pattern of patterns) {
          if (match(states, pattern).length === 0) {
            return false;
          }
        }

        if (match.some(states, negativePatterns)) {
          return false;
        }

        return true;
      });

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
  async transform(context: TContext): Promise<TContext> {
    let handler = this.handler;

    let updatedContext = await handler(context);

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

export interface ITransformNode extends TransformNode {}

export const AbstractTransformNode = TransformNode;

export class TransformToChain<
  TContext = unknown,
  TTransformHandler extends TransformHandler<TContext> = TransformHandler<
    TContext
  >
> {
  constructor(
    /** @internal */
    readonly node: TransformNode<TContext>,
  ) {}

  alias(alias: string): this {
    this.node._alias = alias;
    return this;
  }

  block(aliases: string[]): this {
    this.node.blockedTransformAliases = aliases;
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

  by(description: string, handler: TTransformHandler): ResultNode<TContext> {
    let node = this.node;

    node._description = description;
    node.handler = handler;

    return new ResultNode(node);
  }
}
