export type TestHandler<TContext = unknown> = (
  context: TContext,
) => Promise<void> | void;

export interface PathNode {
  /** @internal */
  _alias: string | undefined;

  /** @internal */
  _description: string;

  /** @internal */
  description: string;

  /** @internal */
  testHandler: TestHandler | undefined;

  /** @internal */
  _depth: number | undefined;

  /** @internal */
  blockedTransformAliases: string[] | undefined;
}
