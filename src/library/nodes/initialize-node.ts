import {generatePathNodeId} from '../@utils';

import {PathNode, TestHandler} from './common';
import {ResultNode} from './result-node';

export type InitializeHandler<TContext = unknown> = () =>
  | Promise<TContext>
  | TContext;

export class InitializeNode<TContext = unknown> implements PathNode {
  /** @internal */
  readonly id = generatePathNodeId();

  /** @internal */
  _alias: string | undefined;

  /** @internal */
  rawDescription!: string;

  /** @internal */
  handler!: InitializeHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  constructor(
    /** @internal */
    readonly states: string[],
  ) {}

  /** @internal */
  get description(): string {
    let description = `Initialize [${this.states}]`;

    if (this.rawDescription) {
      description += ` by ${this.rawDescription}`;
    }

    return description;
  }

  alias(alias: string): this {
    this._alias = alias;
    return this;
  }

  by(
    description: string,
    handler: InitializeHandler<TContext>,
  ): ResultNode<TContext> {
    this.rawDescription = description;
    this.handler = handler;

    return new ResultNode(this);
  }

  /** @internal */
  async initialize(): Promise<TContext> {
    let handler = this.handler;

    return handler();
  }

  /** @internal */
  async test(context: TContext): Promise<void> {
    let testHandler = this.testHandler;

    if (!testHandler) {
      return;
    }

    await testHandler(context);
  }
}
