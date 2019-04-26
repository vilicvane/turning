export type TestHandler<TContext = unknown> = (
  context: TContext,
) => Promise<void> | void;

export interface PathNode {
  /** @internal */
  id: number;
  /** @internal */
  _alias: string | undefined;
  /** @internal */
  testHandler: TestHandler | undefined;
}
