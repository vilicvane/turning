export type Resolvable<T> = Promise<T>;

export type SingleElementTupleWithFallback<
  TTuple extends any[]
> = '1' extends keyof TTuple ? TTuple : TTuple | TTuple[0];
