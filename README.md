# Turning

> This project is currently just a proof of concept, any feedback is welcome.

State-based test case generator.

## Why & How

Writing E2E test cases is frustrating, and the best we can do in practice usually is just very limited test cases for every single feature.

The scenario that triggers this idea was testing a package manager similar to `npm`, but it should apply to varieties of scenarios including E2E tests for web apps.

Turning splits the composition of test cases into two parts: **states** and **transformations**.

The state definitions can verify whether the current context complies the states it's claimed to be; and the transformation definitions tell possible paths of how the states transforms from one to another in context.

### Example

Assuming we need two states to represent the a web session:

```ts
turning.define('session:not-logged-in').test(async ({page}) => {
  await expect(page).not.toMatchElement('.profile');
  await expect(page).toMatchElement('.login-link');
});

turning.define('session:logged-in').test(async ({page}) => {
  await expect(page).not.toMatchElement('.login-link');
  await expect(page).toMatchElement('.profile');
});
```

And we can transform those two states by two transformations:

```ts
turning
  .turn(['session:not-logged-in'])
  .to(['session:logged-in'])
  .alias('login')
  .by(async ({page}) => {
    await page.click('.login-link');

    await page.type('input.username', 'admin');
    await page.type('input.password', '123456');

    await page.click('.login-submit-button');

    await page.waitForNavigation();
  });

turning
  .turn(['session:logged-in'])
  .to(['session:not-logged-in'])
  .alias('logout')
  .by(async ({page}) => {
    await page.click('.logout-link');

    await page.waitForNavigation();
  });
```

Thus a test case can be automatically generated:

- `login` -> `logout`

And with different `maxDepth` and `maxRepeat` options, the test case generated could look like:

- `login` -> `logout` -> `login` -> `logout`

By introducing more states and transformations, plentiful test cases could be generated without your spending time struggling thinking of different compositions. And the generated test cases would easily cover some edge cases you would never want to write by hand.

Also, as the test cases are automatically generated based on options, we can use smaller depth and repeat options for local development and CI for commits, and use greater depth and repeat options for daily or release builds.

## Installation

```sh
yarn add turning --dev
```

A test runner (e.g., `jest`) is required.

```sh
yarn add jest
```

## Usage

```ts
// Function `describe` and `test` is defined by your test runner.
let turning = new Turning({describe, test});

// Define states:

turning.define('state-a');

turning.define('state-b').test(async context => {
  // Assert the context.
});

// Define initialize nodes:

turning
  .initialize(['state-a'])
  .alias('initialize a')
  .by(async () => {
    // Initialize the context to `state-a` and return the context object.
    return {};
  });

// Define transformation nodes:

// Check out the content below for differences about `turn` and `spawn`.

turning
  .turn(['state-a'])
  .to(['state-b'])
  .alias('a to b')
  .by(async context => {
    // Mutate the context or return a new one.
  });

turning
  .spawn(['state-b'])
  .to(['state-a'])
  .alias('b to a')
  .by(async context => {
    // Spawn transformation must return new context object.
    return {};
  });

// Generate test cases with `describe` and `test` provided.
turning.test();
```

For now, you can checkout [makeflow-e2e](https://github.com/makeflow/makeflow-e2e) for more usages.

## Transformations

Turning provides two different concepts of transformation: `turn` and `spawn`.

- `turn`: transform a context from states to states.
- `spawn`: duplicate a context and transform the states.

So basically if you are using `turn`, every leaf would result in a new test case from the initialization (or recent spawning); and if you are using `spawn`, the spawned branches would begin with the same context before spawn.

## Manual Cases

Turning also provides a way to manually add test cases, and this ignores `maxDepth` and `maxRepeat` options.

```ts
turning.case('manual case 1', ['initialize a', 'a to b', 'b to a', 'a to b']);

turning.test();
```

## License

MIT License.
