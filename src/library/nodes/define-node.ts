import {TestHandler} from './common';

export class DefineNode<TContext> {
  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  constructor(
    readonly state: string,
    /** @internal */
    readonly only: boolean,
  ) {}

  test(handler: TestHandler<TContext>): void {
    this.testHandler = handler;
  }
}
