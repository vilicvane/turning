import {IPathNode, TestHandler} from './common';

export class ResultNode<TContext> {
  constructor(public node: IPathNode<TContext>) {}

  test(handler: TestHandler<TContext>): this {
    this.node.testHandler = handler;
    return this;
  }
}
