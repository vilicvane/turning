import * as URL from 'url';

import {Browser, Page, launch} from 'puppeteer-core';

import {Turning} from '../../bld/library';

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
  // ...
});

turning.define('session:user:selected').test(async ({page}) => {
  // ...
});

turning.define('page:home').test(async ({page}) => {
  await page.waitFor('.home-view');
});

turning.define('page:login').test(async ({page}) => {
  await page.waitFor('.login-view');
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

turning
  .initialize([
    'session:account:not-logged-in',
    'session:user:not-selected',
    'page:home',
    'context:not-spawned',
  ])
  .by('opening new page', async () => {
    await page.goto('http://localhost:8080/logout');
    await page.goto('http://localhost:8080');

    return {
      page,
    };
  });

turning
  .turn(['page:home'])
  .to(['page:login'])
  .by('clicking login link', async ({page}) => {
    await page.click('.login-button');
  })
  .test(async ({page}) => {});

turning
  .turn(['session:*', 'page:login'])
  .to(['session:account:logged-in', 'session:user:selected', 'page:app'])
  .by('submitting username and password (lion)', async ({page}) => {
    await page.type('.mobile-input input', '18600000001');
    await page.type('.password-input input', 'abc123');

    await page.click('.submit-button');
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .spawn(['page:app'])
  .to(['page:app:workbench', 'page:app:sidebar:default'])
  .by('goto', async ({page}) => {
    await page.goto('http://localhost:8080/app/workbench');
    return {page};
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .turn(['page:app:!(kanban-list)'])
  .to(['page:app:kanban-list'])
  .by('clicking task hub link in navigation bar', async ({page}) => {
    await page.click('.header-nav .kanban-list-link');
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .turn(['page:app:!(task-hub)'])
  .to(['page:app:task-hub'])
  .by('clicking task hub link in navigation bar', async ({page}) => {
    await page.click('.header-nav .task-hub-link');
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .turn(['page:app:sidebar:!(achievements)'])
  .to(['page:app:sidebar:achievements'])
  .by('clicking sidebar avatar', async ({page}) => {
    await page.click('.normal-sidebar-nav-link.achievements-link');
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .turn(['page:app:sidebar:!(idea)'])
  .to(['page:app:sidebar:idea'])
  .by('clicking sidebar avatar', async ({page}) => {
    await page.click('.normal-sidebar-nav-link.idea-link');
  })
  .test(async ({page}) => {
    // ...
  });

turning.ensure(['page:app:workbench.task', 'page:app:sidebar.achievement']);

// expect(turning.search()).toMatchInlineSnapshot();

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
