import {SpawnNode} from './spawn-node';
import {TurnNode} from './turn-node';

export type TransitionNode<TContext = unknown> =
  | TurnNode<TContext>
  | SpawnNode<TContext>;

export * from './transform-node';
export * from './turn-node';
export * from './spawn-node';
