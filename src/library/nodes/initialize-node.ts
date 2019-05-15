import {generateNodeId} from './@utils';
import {IPathNode, TestHandler} from './common';
import {ResultNode} from './result-node';

export type InitializeHandler<TContext = unknown> = () =>
  | Promise<TContext>
  | TContext;

export class InitializeNode<TContext = unknown> implements IPathNode {
  /** @internal */
  readonly id = generateNodeId();

  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description!: string;

  /** @internal */
  handler!: InitializeHandler<TContext>;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  _depth: number | undefined;

  /** @internal */
  _manual: boolean | undefined;

  constructor(
    /** @internal */
    readonly states: string[],
  ) {}

  /** @internal */
  get description(): string {
    let description = `Initialize [${this.states}]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }

  alias(alias: string): this {
    this._alias = alias;
    return this;
  }

  depth(depth: number): this {
    this._depth = depth;
    return this;
  }

  manual(): this {
    this._manual = true;
    return this;
  }

  by(
    description: string,
    handler: InitializeHandler<TContext>,
  ): ResultNode<TContext> {
    this._description = description;
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
