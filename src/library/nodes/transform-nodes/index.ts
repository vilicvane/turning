import {SpawnNode} from './spawn-node';
import {TurnNode} from './turn-node';

export type TransitionNode<TContext, TEnvironment> =
  | TurnNode<TContext, TEnvironment>
  | SpawnNode<TContext, TEnvironment>;

export * from './transform-node';
export * from './turn-node';
export * from './spawn-node';
