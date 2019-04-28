import {TestHandler} from '../common';

import {AbstractTransformNode, TransformToChain} from './transform-node';

export type SpawnHandler<TContext = unknown> = (
  context: TContext,
) => Promise<TContext> | TContext;

export class SpawnNode<TContext = unknown> extends AbstractTransformNode<
  TContext
> {
  /** @internal */
  handler!: SpawnHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  get description(): string {
    let description = `Spawn [${this.obsoleteStatePatterns}] to [${
      this.newStates
    }]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }

  to(states: string[]): TransformToChain<TContext, SpawnHandler<TContext>> {
    this.newStates = states;

    return new TransformToChain(this);
  }
}
