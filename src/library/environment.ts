import {ITurningContext} from './context';

abstract class TurningEnvironment<TContext extends ITurningContext> {
  async setup(): Promise<void> {}

  async teardown(): Promise<void> {}

  async before(): Promise<void> {}

  async after(): Promise<void> {}

  async afterEach(_context: TContext): Promise<void> {}
}

export const AbstractTurningEnvironment = TurningEnvironment;

export interface ITurningEnvironment<TContext extends ITurningContext>
  extends TurningEnvironment<TContext> {}
