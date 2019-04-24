import {TestHandler, WithTestHandler} from './common';

export class ResultNode<TContext> {
  constructor(public node: WithTestHandler) {}

  test(handler: TestHandler<TContext>): void {
    this.node.testHandler = handler;
  }
}
