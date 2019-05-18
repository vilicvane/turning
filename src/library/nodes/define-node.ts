import {TestHandler} from './common';

export class DefineNode<TContext> {
  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  constructor(public state: string) {}

  test(handler: TestHandler<TContext>): void {
    this.testHandler = handler;
  }
}
