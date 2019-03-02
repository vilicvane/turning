import {ITurningState} from '../turning';
import {SingleElementTupleWithFallback} from '../types';

import {ITurningNode, VerifyHandler} from './common';
import {ResultNode} from './result-node';

export type SyncInitializeHandler<
  TStateTuple extends ITurningState[]
> = () => SingleElementTupleWithFallback<TStateTuple>;

export type AsyncInitializeHandler<
  TStateTuple extends ITurningState[]
> = () => Promise<SingleElementTupleWithFallback<TStateTuple>>;

export type InitializeHandler<
  TStateTuple extends ITurningState[] = ITurningState[]
> = SyncInitializeHandler<TStateTuple> | AsyncInitializeHandler<TStateTuple>;

export class InitializeNode<
  TStateTuple extends ITurningState[] = ITurningState[]
> implements ITurningNode {
  _description: string | undefined;

  handler: InitializeHandler | undefined;
  verifyHandler: VerifyHandler | undefined;

  constructor(public stateSet: Set<string>) {}

  get description(): string {
    let description = `Initialize [${Array.from(this.stateSet)}]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }

  sync(
    description: string,
    handler: SyncInitializeHandler<TStateTuple>,
  ): ResultNode<TStateTuple> {
    return this.by(description, handler);
  }

  async(
    description: string,
    handler: AsyncInitializeHandler<TStateTuple>,
  ): ResultNode<TStateTuple> {
    return this.by(description, handler);
  }

  private by(
    description: string,
    handler: InitializeHandler<TStateTuple>,
  ): ResultNode<TStateTuple> {
    this._description = description;
    this.handler = handler;

    return new ResultNode(this);
  }
}
