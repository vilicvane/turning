import {TestHandler} from './common';

export class DefineNode<TContext = unknown> {
  _testHandler: TestHandler | undefined;

  constructor(public state: string) {}

  test(handler: TestHandler<TContext>): void {
    this._testHandler = handler;
  }
}
