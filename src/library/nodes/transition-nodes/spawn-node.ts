import {TestHandler} from '../common';

import {AbstractTransitionNode, TransitionHandler} from './transition-node';

export class SpawnNode<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string
> extends AbstractTransitionNode<TContext, TEnvironment, TState, TAlias> {
  /** @internal */
  handler!: TransitionHandler<TContext, TEnvironment, string>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  get description(): string {
    let description = `Spawn [${this.obsoleteStatePatterns}] to [${this.newStates}]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }
}
