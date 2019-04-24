import * as URL from 'url';

import {Browser, Page, launch} from 'puppeteer-core';

import {Turning} from '../../bld/library';

jest.setTimeout(200000);

let browser!: Browser;
let page!: Page;

beforeAll(async () => {
  browser = await launch({
    headless: false,
    executablePath:
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  });

  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

interface Context {
  page: Page;
}

let turning = new Turning<Context>({
  describe,
  test,
});

turning.define('session:account:logged-in').test(async ({page}) => {
  let accountId = await page.evaluate('ACCOUNT_ID');

  // ...
});

turning.define('session:user:selected').test(async ({page}) => {
  let userProfileElement = page.$('.user-profile');

  // ...
});

turning.define('page:home').test(async ({page}) => {
  // let form = await page.$('.slider');
  // ...
});

turning.define('page:login').test(async ({page}) => {
  let form = page.$('.login-form');

  // ...
});

turning.define('page:app:workbench').test(async ({page}) => {
  let taskListElement = page.$('.task-list');

  // ...
});

turning.initialize(['page:home']).by('opening new page', async () => {
  await page.goto('http://localhost:8080');

  return {
    page,
  };
});

turning.initialize(['page:login']).by('opening new page', async () => {
  await page.goto('http://localhost:8080/login');

  return {
    page,
  };
});

turning
  .turn(['page:home'])
  .to(['page:login'])
  .by('clicking login link', async ({page}) => {
    await page.click('.login-button');
    await page.waitFor('.login-view');
  })
  .test(async ({page}) => {});

turning
  .turn(['page:login'])
  .to([
    'session:account:logged-in',
    'page:app:workbench',
    // 'page:app:workbench.task',
    // 'page:app:sidebar.collapsed',
  ])
  .by('submitting username and password (lion)', async ({page}) => {
    await page.type('.mobile-input input', '18600000001');
    await page.type('.password-input input', 'abc123');

    await page.click('.submit-button');

    await page.waitForNavigation();
  })
  .test(async ({page}) => {
    // ...
  });

// turning
//   .turn(['page:login'])
//   .to([
//     'session:account:logged-in',
//     'page:app:workbench',
//     // 'page:app:workbench.task',
//     // 'page:app:sidebar.collapsed',
//   ])
//   .by('submitting username and password (xin)', async ({page}) => {
//     await page.type('.mobile-input input', '18600000003');
//     await page.type('.password-input input', 'abc123');

//     await page.click('.submit-button');

//     await page.waitForNavigation();
//   })
//   .test(async ({page}) => {
//     // ...
//   });

let state = {
  session: {
    account: 'logged-in',
  },
  page: {
    app: {
      workbench: true,
      sidebar: 'collapsed',
    },
  },
};

turning
  .turn([
    'session:account:logged-in',
    'page:app:*',
    // 'page:app:workbench.task',
    // 'page:app:sidebar.collapsed',
  ])
  .to(['page:login'])
  .by('to /logout', async ({page}) => {
    await page.goto('http://localhost:8080/logout');

    await page.waitForNavigation();
  })
  .test(async ({page}) => {
    // ...
  });

// turning
//   .turn(['page:app:workbench'])
//   .to(['page:app:workbench', 'page:app:workbench.task'])
//   .by('click task in task list', async ({page}) => {
//     await page.click('.task');
//   })
//   .test(async ({page}) => {
//     await page.waitForNavigation();

//     // ...
//   });

// turning
//   .spawn(['page:app:workbench'])
//   .to(['page:app:workbench', 'page:app:workbench.task'])
//   .by('', async ({page, ...rest}) => {
//     let popup = await new Promise<Page>(resolve => page.once('popup', resolve));

//     return {
//       page: popup,
//       ...rest,
//     };
//   });

turning.ensure(['page:app:workbench.task', 'page:app:sidebar.achievement']);

// turning.search();

turning.test();

interface PageEssential {
  path: string;
  title: string;
}

async function extractPageEssential(page: Page): Promise<PageEssential> {
  let url = page.url();
  let title = await page.title();

  return {
    path: URL.parse(url).path!,
    title,
  };
}

// turning.case();

// class Page {
//   opened: boolean;
//   loggedIn: boolean;

//   logIn(username: string, password: string): void {}
// }

// import * as assert from 'assert';

// type PromiseState =
//   | PromisePendingState
//   | PromiseFulfilledState
//   | PromiseRejectedState;

// interface PromisePendingState {
//   name: 'pending';
// }

// interface PromiseFulfilledState {
//   name: 'fulfilled';
// }

// interface PromiseRejectedState {
//   name: 'rejected';
// }

// declare function xxx<TTuple extends any[]>(
//   ...args: TTuple
// ): {[TIndex in keyof TTuple]: number};

// xxx('foo', 'bar');

// type X = ['foo', 'bar'];

// type Y = {[TIndex in keyof X]: number};

// let y!: Y;

// y['filter'];

// let turning = new Turning<PromiseState>();

// turning.define('pending').verify(state => {});

// turning.define('fulfilled').verify(state => {});

// turning.define('rejected').verify(state => {});

// turning.initialize('pending', 'fulfilled').async('test', async () => {
//   return [
//     {
//       name: 'pending',
//     },
//     {
//       name: 'fulfilled',
//     },
//   ];
// });

// turning
//   .turn('pending')
//   .to('fulfilled')
//   .sync('', context => {
//     return {
//       name: 'fulfilled',
//     };
//   });

// turning
//   .turn('pending')
//   .to('rejected')
//   .by(context => {
//     // context.promise.reject(new Error());
//   });

// turning
//   .spawn(['pending', 'oops'])
//   .from('fulfilled')
//   .by(context => {
//     return {
//       promise: context.promise.then(() => new Promise(() => {})),
//     };
//   })
//   .verify(async (spawned, original) => {
//     assert((await spawned.promise) === (await original.promise));
//   });

// turning
//   .spawn('pending')
//   .from(['rejected', 'oops'])
//   .by(context => {
//     return {
//       promise: context.promise.then(() => new Promise(() => {})),
//     };
//   })
//   .verify(async (spawned, original) => {
//     assert((await spawned.promise) === (await original.promise));
//   });

// turning.search();
