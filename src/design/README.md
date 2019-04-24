- page:/
- page:/login
- page:/user/select-organization
- session:account
- session:user

```ts
turning
  .define('sidebar', {
    requires: ['page:app'],
  })
  .test(async ({page}) => {
    // ...
  });
```
