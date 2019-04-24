import {TestHandler} from '../common';
import {ResultNode} from '../result-node';

import {TransformHandler, TransformNode} from './transform-node';

export class TurnNode<TContext = unknown> extends TransformNode<TContext> {
  /** @internal */
  handler!: TransformHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  constructor(obsoleteStatePatterns: string[]) {
    super();

    this.obsoleteStatePatterns = obsoleteStatePatterns;
  }

  /** @internal */
  get description(): string {
    let description = `Turn [${this.obsoleteStatePatterns}] to [${
      this.newStates
    }]`;

    if (this.rawDescription) {
      description += ` by ${this.rawDescription}`;
    }

    return description;
  }

  to(states: string[]): TurnToChain<TContext> {
    this.newStates = states;

    return new TurnToChain(this);
  }
}

export class TurnToChain<TContext = unknown> {
  constructor(
    /** @internal */
    readonly node: TurnNode<TContext>,
  ) {}

  by(
    description: string,
    handler: TransformHandler<TContext>,
  ): ResultNode<TContext> {
    this.node.rawDescription = description;
    this.node.handler = handler;

    return new ResultNode(this.node);
  }
}
