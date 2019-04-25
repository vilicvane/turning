import {TestHandler} from '../common';
import {ResultNode} from '../result-node';

import {AbstractTransformNode, TransformHandler} from './transform-node';

export class SpawnNode<TContext = unknown> extends AbstractTransformNode<
  TContext
> {
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

  by(
    description: string,
    handler: TransformHandler<TContext>,
  ): ResultNode<TContext> {
    this.node.rawDescription = description;
    this.node.handler = handler;

    return new ResultNode(this.node);
  }
}
