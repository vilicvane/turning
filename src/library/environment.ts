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

  /**
   * Before every complete test case, e.g. "Test Case 1", "Test Case 2".
   */
  async before(): Promise<void> {}

  /**
   * After every complete test case, e.g. "Test Case 1", "Test Case 2".
   */
  async after(): Promise<void> {}

  /**
   * After each test case branch, e.g. "Test Case 1.1", "Test Case 1.2", "Test
   * Case 1".
   */
  async afterEach(
    _context: TContext | undefined,
    _data: TurningEnvironmentAfterEachData,
  ): Promise<void> {}
}

export const AbstractTurningEnvironment = TurningEnvironment;

export interface ITurningEnvironment<TContext extends ITurningContext>
  extends TurningEnvironment<TContext> {}
