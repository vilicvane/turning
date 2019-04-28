import {TestHandler} from '../common';

import {
  AbstractTransformNode,
  TransformHandler,
  TransformToChain,
} from './transform-node';

export class TurnNode<TContext = unknown> extends AbstractTransformNode<
  TContext
> {
  /** @internal */
  handler!: TransformHandler<TContext>;

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

  to(states: string[]): TransformToChain<TContext> {
    this.newStates = states;

    return new TransformToChain(this);
  }
}
