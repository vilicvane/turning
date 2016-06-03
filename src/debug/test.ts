import { Turning } from '../';

class Page {
    opened: boolean;
    loggedIn: boolean;

    logIn(username: string, password: string): void {

    }
}

import * as assert from 'assert';

interface PromiseContext {
    promise: Promise<any>;
}

let turning = new Turning<PromiseContext>();

turning
    .define('pending')
    .verify(context => {
    });

turning
    .define('fulfilled')
    .verify(context => {
    });

turning
    .define('rejected')
    .verify(context => {
    });

turning
    .init('pending')
    .by('promise constructor', () => new Promise(() => { }));

turning
    .turn('pending')
    .to('fulfilled')
    .by(context => {
        // context.promise.resolve();
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
            promise: context.promise.then(() => new Promise(() => { }))
        };
    })
    .verify(async (spawned, original) => {
        assert(await spawned.promise === await original.promise);
    });

turning
    .spawn('pending')
    .from(['rejected', 'oops'])
    .by(context => {
        return {
            promise: context.promise.then(() => new Promise(() => { }))
        };
    })
    .verify(async (spawned, original) => {
        assert(await spawned.promise === await original.promise);
    });

turning.search();
