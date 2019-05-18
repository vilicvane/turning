import {TestHandler} from '../common';

import {AbstractTransformNode, TransformToChain} from './transform-node';

export type SpawnHandler<TContext, TEnvironment> = (
  context: TContext,
  environment: TEnvironment,
) => Promise<TContext> | TContext;

export class SpawnNode<TContext, TEnvironment> extends AbstractTransformNode<
  TContext,
  TEnvironment
> {
  /** @internal */
  handler!: SpawnHandler<TContext, TEnvironment>;

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

  to(
    states: string[],
  ): TransformToChain<
    TContext,
    TEnvironment,
    SpawnHandler<TContext, TEnvironment>
  > {
    this.newStates = states;

    return new TransformToChain(this);
  }
}
