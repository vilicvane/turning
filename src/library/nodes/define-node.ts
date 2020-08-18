import {TestHandler} from './common';

export class DefineNode<TContext> {
  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  _only: boolean | undefined;

  constructor(public state: string) {}

  only(): this {
    this._only = true;
    return this;
  }

  test(handler: TestHandler<TContext>): void {
    this.testHandler = handler;
  }
}
