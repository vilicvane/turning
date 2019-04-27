import {PathNode, TestHandler} from './common';
import {ResultNode} from './result-node';

export type InitializeHandler<TContext = unknown> = () =>
  | Promise<TContext>
  | TContext;

export class InitializeNode<TContext = unknown> implements PathNode {
  /** @internal */
  _alias: string | undefined;

  /** @internal */
  rawDescription!: string;

  /** @internal */
  handler!: InitializeHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  _depth: number | undefined;

  /** @internal */
  blockedTransformAliases: string[] | undefined;

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

  block(aliases: string[]): this {
    this.blockedTransformAliases = aliases;
    return this;
  }

  depth(depth: number): this {
    this._depth = depth;
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
