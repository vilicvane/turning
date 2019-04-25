import {SpawnNode} from './spawn-node';
import {TurnNode} from './turn-node';

export type TransformNode<TContext = unknown> =
  | TurnNode<TContext>
  | SpawnNode<TContext>;

export * from './transform-node';
export * from './turn-node';
export * from './spawn-node';
