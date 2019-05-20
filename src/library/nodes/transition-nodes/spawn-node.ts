import {TestHandler} from '../common';

import {AbstractTransitionNode, TransitionToChain} from './transition-node';

export type SpawnHandler<TContext, TEnvironment> = (
  context: TContext,
  environment: TEnvironment,
) => Promise<TContext> | TContext;

export class SpawnNode<TContext, TEnvironment> extends AbstractTransitionNode<
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
  ): TransitionToChain<
    TContext,
    TEnvironment,
    SpawnHandler<TContext, TEnvironment>
  > {
    this.newStates = states;

    return new TransitionToChain(this);
  }
}
