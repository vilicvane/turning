import {Turning} from '../library';

class Page {
  opened: boolean;
  loggedIn: boolean;

  logIn(username: string, password: string): void {}
}

import * as assert from 'assert';

type PromiseState =
  | PromisePendingState
  | PromiseFulfilledState
  | PromiseRejectedState;

interface PromisePendingState {
  name: 'pending';
}

interface PromiseFulfilledState {
  name: 'fulfilled';
}

interface PromiseRejectedState {
  name: 'rejected';
}

declare function xxx<TTuple extends any[]>(
  ...args: TTuple
): {[TIndex in keyof TTuple]: number};

xxx('foo', 'bar');

type X = ['foo', 'bar'];

type Y = {[TIndex in keyof X]: number};

let y!: Y;

y['filter'];

let turning = new Turning<PromiseState>();

turning.define('pending').verify(state => {});

turning.define('fulfilled').verify(state => {});

turning.define('rejected').verify(state => {});

turning.initialize('pending', 'fulfilled').async('test', async () => {
  return [
    {
      name: 'pending',
    },
    {
      name: 'fulfilled',
    },
  ];
});

turning
  .turn('pending')
  .to('fulfilled')
  .sync('', context => {
    return {
      name: 'fulfilled',
    };
  });

turning
  .turn('pending')
  .to('rejected')
  .by(context => {
    // context.promise.reject(new Error());
  });

turning
  .spawn(['pending', 'oops'])
  .from('fulfilled')
  .by(context => {
    return {
      promise: context.promise.then(() => new Promise(() => {})),
    };
  })
  .verify(async (spawned, original) => {
    assert((await spawned.promise) === (await original.promise));
  });

turning
  .spawn('pending')
  .from(['rejected', 'oops'])
  .by(context => {
    return {
      promise: context.promise.then(() => new Promise(() => {})),
    };
  })
  .verify(async (spawned, original) => {
    assert((await spawned.promise) === (await original.promise));
  });

turning.search();
