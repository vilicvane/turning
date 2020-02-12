import {TestHandler} from './common';

export class DefineNode<TContext> {
  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  _necessary: boolean | undefined;

  constructor(public state: string) {}

  necessary(): this {
    this._necessary = true;
    return this;
  }

  test(handler: TestHandler<TContext>): void {
    this.testHandler = handler;
  }
}
