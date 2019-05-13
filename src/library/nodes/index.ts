import {InitializeNode} from './initialize-node';
import {TransitionNode} from './transform-nodes';

export type PathNode<TContext = unknown> =
  | InitializeNode<TContext>
  | TransitionNode<TContext>;

export * from './common';
export * from './define-node';
export * from './initialize-node';
export * from './result-node';
export * from './transform-nodes';
