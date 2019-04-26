import {TestHandler} from '../common';
import {ResultNode} from '../result-node';

import {AbstractTransformNode} from './transform-node';

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

    if (this.rawDescription) {
      description += ` by ${this.rawDescription}`;
    }

    return description;
  }

  to(states: string[]): SpawnToChain<TContext> {
    this.newStates = states;

    return new SpawnToChain(this);
  }
}

export class SpawnToChain<TContext> {
  constructor(
    /** @internal */
    readonly node: SpawnNode<TContext>,
  ) {}

  alias(alias: string): this {
    this.node._alias = alias;
    return this;
  }

  by(
    description: string,
    handler: SpawnHandler<TContext>,
  ): ResultNode<TContext> {
    this.node.rawDescription = description;
    this.node.handler = handler;

    return new ResultNode(this.node);
  }
}
