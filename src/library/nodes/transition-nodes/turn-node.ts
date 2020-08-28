import {TestHandler} from '../common';

import {AbstractTransitionNode, TransitionHandler} from './transition-node';

export class TurnNode<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string
> extends AbstractTransitionNode<TContext, TEnvironment, TState, TAlias> {
  /** @internal */
  handler!: TransitionHandler<TContext, TEnvironment>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  get description(): string {
    let description = `Turn [${this.obsoleteStatePatterns}] to [${this.newStates}]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }
}
