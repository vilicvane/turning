import {TestHandler} from '../common';

import {
  AbstractTransformNode,
  TransformHandler,
  TransformToChain,
} from './transform-node';

export class TurnNode<TContext, TEnvironment> extends AbstractTransformNode<
  TContext,
  TEnvironment
> {
  /** @internal */
  handler!: TransformHandler<TContext, TEnvironment>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  get description(): string {
    let description = `Turn [${this.obsoleteStatePatterns}] to [${
      this.newStates
    }]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }

  to(states: string[]): TransformToChain<TContext, TEnvironment> {
    this.newStates = states;

    return new TransformToChain(this);
  }
}
