import {IPathNode, TestHandler} from './common';

export class ResultNode<TContext = unknown> {
  constructor(public node: IPathNode) {}

  test(handler: TestHandler<TContext>): this {
    this.node.testHandler = handler;
    return this;
  }
}
