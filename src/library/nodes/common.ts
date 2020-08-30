import {InitializeNode} from './initialize-node';
import {SpawnNode, TransitionNode} from './transition-nodes';

export type PathNode<TContext, TEnvironment> =
  | InitializeNode<TContext, TEnvironment, string>
  | TransitionNode<TContext, TEnvironment, string, string>;

export type StartNode<TContext, TEnvironment> =
  | InitializeNode<TContext, TEnvironment, string>
  | SpawnNode<TContext, TEnvironment, string, string>;

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
  only: boolean;

  /** @internal */
  testHandler: TestHandler<TContext> | undefined;
}
