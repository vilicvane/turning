import {chrome as chromePath} from 'chrome-paths';
import {Browser, Page, launch} from 'puppeteer-core';

import {Turning} from '../../bld/library';

let browser!: Browser;
let page!: Page;

beforeAll(async () => {
  browser = await launch({
    headless: false,
    executablePath: process.env.CHROME_EXECUTABLE_PATH || chromePath,
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

///////////////////
// Define States //
///////////////////

turning.define('session:account:not-logged-in');

turning.define('session:account:logged-in');

turning.define('session:user:not-selected');

turning.define('session:user:selected');

turning.define('page:home').test(async ({page}) => {
  await page.waitFor('.home-view');
});

turning.define('page:login').test(async ({page}) => {
  await page.waitFor('.login-view');
});

turning.define('page:app').test(async ({page}) => {
  await page.waitFor('#app > .header');
});

turning.define('page:app:sidebar:default').test(async ({page}) => {
  await page.waitFor('.sidebar');
});

turning.define('page:app:sidebar:achievements').test(async ({page}) => {
  await page.waitFor('.expanded-sidebar .achievements');
});

turning.define('page:app:sidebar:idea').test(async ({page}) => {
  await page.waitFor('.expanded-sidebar .idea');
});

turning.define('page:app:workbench').test(async ({page}) => {
  await page.waitFor('.workbench-view');
});

turning.define('page:app:kanban-list').test(async ({page}) => {
  await page.waitFor('.kanban-list-view');
});

turning.define('page:app:task-hub').test(async ({page}) => {
  await page.waitFor('.tasks-view');
});

/////////////////////////////
// Define Initialize Nodes //
/////////////////////////////

turning
  .initialize([
    'session:account:not-logged-in',
    'session:user:not-selected',
    'page:home',
  ])
  .alias('open home page')
  .by('opening new page', async () => {
    await page.goto('http://localhost:8080/logout');
    await page.goto('http://localhost:8080');

    return {page};
  });

////////////////////////////
// Define Transform Nodes //
////////////////////////////

turning
  .turn(['page:home'])
  .to(['page:login'])
  .alias('click home page login link')
  .by('clicking login link', async ({page}) => {
    await page.click('.login-button');
  });

turning
  .turn(['session:*', 'page:login'])
  .to(['session:account:logged-in', 'session:user:selected', 'page:app'])
  .alias('submit login form (lion)')
  .by('submitting username and password (lion)', async ({page}) => {
    await page.type('.mobile-input input', '18600000001');
    await page.type('.password-input input', 'abc123');

    await page.click('.submit-button');

    await page.waitForNavigation();
  });

turning
  .spawn(['page:app'])
  .to(['page:app:workbench', 'page:app:sidebar:default'])
  .alias('restore workbench')
  .by('goto', async ({page}) => {
    await page.click('.header-logo');

    return {page};
  });

turning
  .turn(['page:app:*'], {excludes: ['page:app:kanban-list']})
  .to(['page:app:kanban-list'])
  .alias('click navbar kanban list link')
  .by('clicking task hub link in navbar', async ({page}) => {
    await page.click('.header-nav .kanban-list-link');
  });

turning
  .turn(['page:app:*'], {excludes: ['page:app:task-hub']})
  .to(['page:app:task-hub'])
  .alias('click navbar task hub link')
  .by('clicking task hub link in navbar', async ({page}) => {
    await page.click('.header-nav .task-hub-link');
  });

turning
  .turn(['page:app:sidebar:*'], {excludes: ['page:app:sidebar:achievements']})
  .to(['page:app:sidebar:achievements'])
  .by('clicking sidebar avatar', async ({page}) => {
    await page.click('.normal-sidebar-nav-link.achievements-link');
  });

turning
  .turn(['page:app:sidebar:*'], {excludes: ['page:app:sidebar:idea']})
  .to(['page:app:sidebar:idea'])
  .by('clicking sidebar avatar', async ({page}) => {
    await page.click('.normal-sidebar-nav-link.idea-link');
  });

turning
  .spawn([], {includes: ['page:app:sidebar:idea']})
  .to([])
  .by('creating new idea', async ({page}) => {
    let text = `这是一个忧伤的故事 ${Math.random()}`;

    await page.type('.idea-list > .idea-list-new-item input', `${text}\n`);

    await waitForSyncing(page);

    await expect(page).toMatchElement('.idea-list-item', {text});

    return {page};
  });

///////////////////////
// Manual Test Cases //
///////////////////////

turning.case('click click click 1', [
  'open home page',
  'click home page login link',
  'submit login form (lion)',
  'restore workbench',
  'click navbar kanban list link',
  'click navbar task hub link',
  'click navbar kanban list link',
  'click navbar task hub link',
  'click navbar kanban list link',
  'click navbar task hub link',
]);

turning.case('click click click 2', [
  'open home page',
  'click home page login link',
  'submit login form (lion)',
  'restore workbench',
  'click navbar task hub link',
  'click navbar kanban list link',
  'click navbar task hub link',
  'click navbar kanban list link',
  'click navbar task hub link',
  'click navbar kanban list link',
]);

////////////////////
// Generate Tests //
////////////////////

turning.test();

///////////////
// Utilities //
///////////////

async function waitForSyncing(page: Page): Promise<void> {
  await page.waitFor('.syncing-info:not(.syncing)');
}
