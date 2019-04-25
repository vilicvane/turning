- page:/
- page:/login
- page:/user/select-organization
- session:account
- session:user

```ts
turning
  .define('page:app:workbench', {
    requires: ['page:app'],
  })
  .test(async ({page}) => {
    // ...
  });

turning
  .define('page:app:sidebar', {
    requires: ['page:app'],
  })
  .test(async ({page}) => {
    // ...
  });
```

```ts
let paths = [
  {
    node: InitializeNodeA,
    turn: {
      node: TurnNodeA1,
      turn: {
        node: TurnNodeB1,
        spawns: [
          {
            node: SpawnNodeA1,
            turn: {
              node: TurnNodeC1,
            },
          },
          {
            node: SpawnNodeA1,
            turn: {
              node: TurnNodeC2,
            },
          },
        ],
      },
    },
  },
  {
    node: InitializeNodeA,
    turn: {
      node: TurnNodeA1,
      turn: {
        node: TurnNodeB2,
        spawns: [
          {
            node: SpawnNodeA1,
            turn: {
              node: TurnNodeC1,
            },
          },
        ],
      },
    },
  },
];
```
