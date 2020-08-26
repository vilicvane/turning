import {ITurningContext} from './context';

export interface TurningEnvironmentAfterEachData {
  id: string;
  attempts: number;
  passed: boolean;
  passedBeforeSpawn: boolean;
}

abstract class TurningEnvironment<TContext extends ITurningContext> {
  async setup(): Promise<void> {}

  async teardown(): Promise<void> {}

  async before(): Promise<void> {}

  async after(): Promise<void> {}

  async afterEach(
    _context: TContext,
    _data: TurningEnvironmentAfterEachData,
  ): Promise<void> {}
}

export const AbstractTurningEnvironment = TurningEnvironment;

export interface ITurningEnvironment<TContext extends ITurningContext>
  extends TurningEnvironment<TContext> {}
