import Chalk from 'chalk';
import _ from 'lodash';
import * as v from 'villa';

import {
  PathInitialize,
  PathSpawn,
  PathStart,
  PathTurn,
  PathVia,
} from './@search';
import {indent} from './@utils';
import {
  DefineNode,
  InitializeNode,
  PathNode,
  StartNode,
  TurnNode,
} from './nodes';

export type TurningSetupCallback<TEnvironment> = () =>
  | Promise<TEnvironment>
  | TEnvironment;

export type TurningTeardownCallback<TEnvironment> = (
  environment: TEnvironment,
) => Promise<void> | void;

export type TurningBeforeCallback<TEnvironment> = (
  environment: TEnvironment,
) => Promise<void> | void;

export type TurningAfterCallback<TEnvironment> = (
  environment: TEnvironment,
) => Promise<void> | void;

export type TurningAfterEachCallback<TContext, TEnvironment> = (
  context: TContext,
  environment: TEnvironment,
) => Promise<void> | void;

export interface TestOptions<TContext, TEnvironment> {
  bail: boolean;
  filter: string[] | undefined;
  verbose: boolean;
  listOnly: boolean;
  defineNodeMap: Map<string, DefineNode<TContext>>;
  setupCallback: TurningSetupCallback<TEnvironment> | undefined;
  teardownCallback: TurningTeardownCallback<TEnvironment> | undefined;
  beforeCallback: TurningBeforeCallback<TEnvironment> | undefined;
  afterCallback: TurningAfterCallback<TEnvironment> | undefined;
  afterEachCallback:
    | TurningAfterEachCallback<TContext, TEnvironment>
    | undefined;
}

export interface TestResult {
  completed: boolean;
  passed: number;
  failed: number;
}

export async function test<TContext, TEnvironment>(
  pathInitializes: PathInitialize[],
  {
    bail,
    filter: filteringTestCaseIds,
    verbose,
    listOnly,
    defineNodeMap,
    setupCallback,
    teardownCallback,
    beforeCallback,
    afterCallback,
    afterEachCallback,
  }: TestOptions<TContext, TEnvironment>,
): Promise<boolean> {
  let onlyTestCaseIdSet =
    filteringTestCaseIds &&
    new Set(_.flatMap(filteringTestCaseIds, getRelatedTestCaseIds));

  let environment!: TEnvironment;

  await setup();

  let allFailedTestCaseIds = await run(0, pathInitializes);

  await teardown();

  if (allFailedTestCaseIds.length) {
    printErrorBadge('Failed test cases', 0);
    console.error(indent(allFailedTestCaseIds.join('\n'), 1));
    console.error();
  }

  return !allFailedTestCaseIds.length;

  async function run(
    depth: number,
    pathStarts: PathStart[],
    parentTestCaseId?: string,
    parentContext?: TContext,
  ): Promise<string[]> {
    let failedTestCaseIds: string[] = [];

    for (let [index, pathStart] of pathStarts.entries()) {
      let {
        turns: pathTurns,
        spawns: nextPathSpawns,
      } = getPathTurnsAndNextSpawns(pathStart);

      let testCaseId = `${
        parentTestCaseId ? `${parentTestCaseId}.` : ''
      }${index + 1}`;

      if (onlyTestCaseIdSet && !onlyTestCaseIdSet.has(testCaseId)) {
        continue;
      }

      let testCaseDisplayName = `Test Case ${testCaseId}`;

      console.info(indent(Chalk.green(testCaseDisplayName), depth));

      console.info(indent(buildTestCaseName(pathStart), depth + 1));

      let startStates = pathStart.states;

      if (verbose) {
        printCurrentStates(startStates, depth + 1);
      }

      if (!depth) {
        await before();
      }

      let context!: TContext;
      let startNode = pathStart.node as StartNode<TContext, TEnvironment>;

      let passed = await runSteps([
        () =>
          transit(async () => {
            if (startNode instanceof InitializeNode) {
              context = await startNode.initialize(environment);
            } else {
              context = await startNode.transit(parentContext!, environment);

              if (
                typeof context === 'object' &&
                context &&
                context === parentContext
              ) {
                throw new Error(
                  'Spawned context is not expected to have the same reference as the parent context',
                );
              }
            }
          }),
        () => testStates(startStates, context),
        () => testTransition(startNode, context),
      ]);

      if (passed) {
        for (let pathTurn of pathTurns) {
          console.info(indent(buildTestCaseName(pathTurn), depth + 1));

          let turnStates = pathTurn.states;

          if (verbose) {
            if (verbose) {
              printCurrentStates(turnStates, depth + 1);
            }
          }

          let turnNode = pathTurn.node as TurnNode<TContext, TEnvironment>;

          passed = await runSteps([
            () =>
              transit(async () => {
                context = await turnNode.transit(context, environment);
              }),
            () => testStates(turnStates, context),
            () => testTransition(turnNode, context),
          ]);

          if (!passed) {
            break;
          }
        }
      }

      let existingFailedSubTestCases = false;

      if (passed && nextPathSpawns) {
        let failedSubTestCaseIds = await run(
          depth + 1,
          nextPathSpawns,
          testCaseId,
          context,
        );

        if (failedSubTestCaseIds.length) {
          passed = false;
          existingFailedSubTestCases = true;

          failedTestCaseIds.push(...failedSubTestCaseIds);
        }
      }

      await afterEach(context);

      if (!depth) {
        await after();
      }

      if (!passed) {
        if (!existingFailedSubTestCases) {
          failedTestCaseIds.push(testCaseId);
        }

        if (bail) {
          break;
        }
      }
    }

    return failedTestCaseIds;

    async function runSteps(
      steps: (() => Promise<boolean>)[],
    ): Promise<boolean> {
      if (listOnly) {
        return true;
      }

      return v.every(steps, step => step());
    }

    async function transit(fn: () => Promise<void>): Promise<boolean> {
      try {
        await fn();
        return true;
      } catch (error) {
        printErrorBadge('Transition failed', depth + 1);
        printError(error, depth + 1);
        return false;
      }
    }

    async function testStates(
      states: string[],
      context: TContext,
    ): Promise<boolean> {
      let passed = true;

      for (let state of states) {
        let defineNode = defineNodeMap.get(state)!;

        let {testHandler} = defineNode;

        if (!testHandler) {
          continue;
        }

        try {
          await testHandler(context);
        } catch (error) {
          passed = false;
          printErrorBadge(`State "${state}" test failed`, depth + 1);
          printError(error, depth + 1);
        }
      }

      return passed;
    }

    async function testTransition(
      pathNode: PathNode<TContext, TEnvironment>,
      context: TContext,
    ): Promise<boolean> {
      try {
        await pathNode.test(context);
        return true;
      } catch (error) {
        printErrorBadge('Transition test failed', depth + 1);
        printError(error, depth + 1);
        return false;
      }
    }
  }

  async function setup(): Promise<void> {
    if (!listOnly && setupCallback) {
      environment = await setupCallback();
    }
  }

  async function teardown(): Promise<void> {
    if (!listOnly && teardownCallback) {
      await teardownCallback(environment);
    }
  }

  async function before(): Promise<void> {
    if (!listOnly && beforeCallback) {
      await beforeCallback(environment);
    }
  }

  async function after(): Promise<void> {
    if (!listOnly && afterCallback) {
      await afterCallback(environment);
    }
  }

  async function afterEach(context: TContext): Promise<void> {
    if (!listOnly && afterEachCallback) {
      await afterEachCallback(context, environment);
    }
  }
}

interface PathTurnsAndNextSpawns {
  turns: PathTurn[];
  spawns: PathSpawn[] | undefined;
}

function getPathTurnsAndNextSpawns(
  pathStart: PathStart,
): PathTurnsAndNextSpawns {
  let turns: PathTurn[] = [];

  let via: PathVia = pathStart;

  while (via.turn) {
    via = via.turn;

    turns.push(via);
  }

  return {
    turns,
    spawns: via.spawns,
  };
}

function getRelatedTestCaseIds(testCaseId: string): string[] {
  let parts = testCaseId.split('.');
  return parts.map((_part, index) => parts.slice(0, index + 1).join('.'));
}

function buildTestCaseName({node, caseNameOnEnd}: PathVia): string {
  let name = node.description;

  if (caseNameOnEnd) {
    name += ` <${caseNameOnEnd}>`;
  }

  return name;
}

function print(text: string, depth: number): void {
  console.info(indent(text, depth));
}

function printCurrentStates(states: string[], depth: number): void {
  print(Chalk.gray(`Current states [${states.join(',')}]`), depth);
}

function printErrorBadge(text: string, depth: number): void {
  console.error();
  console.error(indent(Chalk.bgRed(` ${text} `), depth));
  console.error();
}

function printError(error: Error | string, depth: number): void {
  let text =
    error instanceof Error ? error.stack || error.message : String(error);

  console.error(indent(Chalk.red(text), depth));
  console.error();
}
