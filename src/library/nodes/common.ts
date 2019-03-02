import {ITurningState} from '../turning';

export interface ITurningNode {
  _description: string | undefined;
  description: string;
}

export type VerifyHandler<
  TStateTuple extends ITurningState[] = ITurningState[]
> = (...states: TStateTuple) => Promise<void> | void;

export interface WithVerifyHandler {
  verifyHandler: VerifyHandler | undefined;
}
