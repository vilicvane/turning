import {VerifyHandler, WithVerifyHandler} from './common';

export class ResultNode<T> {
  constructor(public node: WithVerifyHandler<T>) {}

  verify(handler: VerifyHandler<T>): void {
    this.node.verifyHandler = handler;
  }
}
