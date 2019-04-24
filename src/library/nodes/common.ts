export type TestHandler<TContext = unknown> = (
  context: TContext,
) => Promise<void> | void;

export interface WithTestHandler {
  testHandler: TestHandler | undefined;
}
