import {SpawnNode} from './spawn-node';
import {TurnNode} from './turn-node';

export type TransitionNode<
  TContext,
  TEnvironment,
  TState extends string,
  TAlias extends string
> =
  | TurnNode<TContext, TEnvironment, TState, TAlias>
  | SpawnNode<TContext, TEnvironment, TState, TAlias>;

export * from './transition-node';
export * from './turn-node';
export * from './spawn-node';
