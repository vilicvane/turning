import {TestHandler} from './common';

export class DefineNode<TContext = unknown> {
  /** @internal */
  testHandler: TestHandler | undefined;

  constructor(public state: string) {}

  test(handler: TestHandler<TContext>): void {
    this.testHandler = handler;
  }
}
