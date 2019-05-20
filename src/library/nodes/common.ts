import {InitializeNode} from './initialize-node';
import {SpawnNode, TransitionNode} from './transition-nodes';

export type PathNode<TContext, TEnvironment> =
  | InitializeNode<TContext, TEnvironment>
  | TransitionNode<TContext, TEnvironment>;

export type StartNode<TContext, TEnvironment> =
  | InitializeNode<TContext, TEnvironment>
  | SpawnNode<TContext, TEnvironment>;

export type TestHandler<TContext> = (context: TContext) => Promise<void> | void;

export interface IPathNode<TContext> {
  /** @internal */
  id: number;

  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description: string;

  /** @internal */
  description: string;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;

  /** @internal */
  _depth: number | undefined;
}
