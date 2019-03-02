import {ITurningState} from '../../turning';
import {SingleElementTupleWithFallback} from '../../types';
import {VerifyHandler} from '../common';
import {ResultNode} from '../result-node';

import {TransformNode} from './transform-node';

export type SyncTurnHandler<
  TFromStateTuple extends ITurningState[],
  TToStateTuple extends ITurningState[]
> = (
  ...states: TFromStateTuple
) => SingleElementTupleWithFallback<TToStateTuple>;

export type AsyncTurnHandler<
  TFromStateTuple extends ITurningState[],
  TToStateTuple extends ITurningState[]
> = (
  ...states: TFromStateTuple
) => SingleElementTupleWithFallback<TToStateTuple>;

export type TurnHandler<
  TFromStateTuple extends ITurningState[] = ITurningState[],
  TToStateTuple extends ITurningState[] = ITurningState[]
> =
  | SyncTurnHandler<TFromStateTuple, TToStateTuple>
  | AsyncTurnHandler<TFromStateTuple, TToStateTuple>;

export class TurnNode<
  TState extends ITurningState,
  TFromStateTuple extends ITurningState[]
> extends TransformNode {
  handler: TurnHandler | undefined;
  verifyHandler: VerifyHandler<TFromStateTuple> | undefined;

  constructor(fromStates: Set<string>) {
    super();

    this.fromStateSet = fromStates;
  }

  get description(): string {
    let description = `Turn [${Array.from(this.fromStateSet)}] to [${Array.from(
      this.toStateSet,
    )}]`;

    if (this._description) {
      description += ` by ${this._description}`;
    }

    return description;
  }

  to<TStateNameTuple extends TState['name'][]>(
    ...states: TStateNameTuple
  ): TurnToNode<
    TState,
    TFromStateTuple,
    {
      [TIndex in keyof TStateNameTuple]: Extract<
        TState,
        {name: TStateNameTuple[TIndex]}
      >
    }
  > {
    this.toStateSet = new Set(states);

    return new TurnToNode(this);
  }
}

export class TurnToNode<
  TState extends ITurningState,
  TFromStateTuple extends ITurningState[],
  TToStateTuple extends ITurningState[]
> {
  constructor(readonly node: TurnNode<TState, TFromStateTuple>) {}

  sync(
    description: string,
    handler: SyncTurnHandler<TFromStateTuple, TToStateTuple>,
  ): ResultNode<TToStateTuple> {
    return this.by(description, handler);
  }

  async(
    description: string,
    handler: AsyncTurnHandler<TFromStateTuple, TToStateTuple>,
  ): ResultNode<TToStateTuple> {
    return this.by(description, handler);
  }

  private by(
    description: string,
    handler: TurnHandler<TFromStateTuple, TToStateTuple>,
  ): ResultNode<TToStateTuple> {
    this.node._description = description;
    this.node.handler = handler;

    return new ResultNode(this);
  }
}
