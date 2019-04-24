import assert from 'assert';

import _ from 'lodash';
import match from 'micromatch';

import {TestHandler} from '../common';

let lastTransformNodeId = 0;

export type TransformHandler<TContext = unknown> = (
  context: TContext,
) => Promise<TContext | void> | TContext | void;

export abstract class TransformNode<TContext = unknown> {
  /** @internal */
  readonly id = ++lastTransformNodeId;

  /** @internal */
  rawDescription!: string;

  protected obsoleteStatePatterns!: string[];
  protected newStates!: string[];

  /** @internal */
  handler!: TransformHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

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
      let matched = match(states, pattern);

      if (!matched.length) {
        return undefined;
      }
    }

    states = match.not(states, obsoleteStatePatterns);

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
