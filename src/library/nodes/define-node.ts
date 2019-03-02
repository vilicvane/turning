import {ITurningState} from '../turning';

import {VerifyHandler} from './common';

export class DefineNode<TState extends ITurningState = ITurningState> {
  verifyHandler: VerifyHandler | undefined;

  constructor(public state: string) {}

  verify(handler: VerifyHandler<[TState]>): void {
    this.verifyHandler = handler;
  }
}
